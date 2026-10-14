/* global __dirname */
const { execFileSync } = require("node:child_process");
const { access, readFile, writeFile } = require("node:fs/promises");
const { join } = require("node:path");
const { parseArgs } = require("node:util");
const sharp = require("sharp");

function cropBounds({ data, info: { width, height } }, padding = 16) {
  let minX = width;
  let maxX = 0;
  let minY = height;
  let maxY = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(width * y + x) * 4 + 3] > 10) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (minX > maxX || minY > maxY) throw new Error("No visible foreground found.");
  const left = Math.max(0, minX - padding);
  const top = Math.max(0, minY - padding);
  return {
    left,
    top,
    width: Math.min(width - 1, maxX + padding) - left + 1,
    height: Math.min(height - 1, maxY + padding) - top + 1,
  };
}

// Legacy blue-screen mode stays available for comparison. It is not matting:
// clamping the blue channel can still leave cyan/grey contamination at edges.
function keyBlue(data) {
  for (let offset = 0; offset < data.length; offset += 4) {
    const maxRG = Math.max(data[offset], data[offset + 1]);
    const blue = data[offset + 2];
    const difference = blue - maxRG;
    data[offset + 3] = difference >= 80 ? 0 : difference <= 25 ? 255
      : Math.round(255 * (1 - (difference - 25) / 55));
    if (data[offset + 3] > 0) data[offset + 2] = Math.min(blue, maxRG);
  }
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      "experimental-matting": { type: "boolean", default: false },
      mask: { type: "string" },
    },
  });
  if (positionals.length !== 2) {
    throw new Error("Usage: node scripts/chroma-key.js <input.jpg|png> <output.png> [--experimental-matting [--mask mask.png]]");
  }
  if (values.mask && !values["experimental-matting"]) {
    throw new Error("--mask requires --experimental-matting.");
  }
  const [inputPath, outputPath] = positionals;
  const exists = await access(outputPath).then(() => true).catch((error) => {
    if (error.code !== "ENOENT") throw error;
    return false;
  });
  if (exists) throw new Error("Output already exists; choose a fresh path to preserve originals and comparisons.");
  const original = await readFile(inputPath);
  let image = await sharp(original).rotate().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let offset = 3; offset < image.data.length; offset += 4) {
    if (image.data[offset] < 255) {
      throw new Error("Input already contains transparency; use the original unkeyed render, not a PNG master.");
    }
  }

  if (values["experimental-matting"]) {
    const normalized = await sharp(image.data, { raw: image.info }).png().toBuffer();
    const args = ["run", "--no-project", "--python", "3.12", "--script", join(__dirname, "experimental-art-matting.py")];
    if (values.mask) args.push("--mask", values.mask);
    const cutout = execFileSync("uv", args, {
      input: normalized,
      maxBuffer: 128 * 1024 * 1024,
      stdio: ["pipe", "pipe", "inherit"],
    });
    image = await sharp(cutout).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  } else {
    keyBlue(image.data);
  }

  const bounds = cropBounds(image);
  const result = await sharp(image.data, { raw: image.info }).extract(bounds).png().toBuffer();
  await writeFile(outputPath, result, { flag: "wx" });
  console.log(`Saved transparent cropped image (${bounds.width}x${bounds.height}): ${outputPath}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
