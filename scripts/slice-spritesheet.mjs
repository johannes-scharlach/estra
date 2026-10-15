import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultOutputDir = fileURLToPath(new URL("../apps/mobile/src/features/onboarding/art/", import.meta.url));

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

export async function sliceSpritesheet({
  inputPath,
  outputDir = defaultOutputDir,
  rows = 3,
  cols = 3,
  ids,
  experimentalMatting = true,
  blueKey = false,
  padding = 16,
}) {
  if (!ids || ids.length !== rows * cols) {
    throw new Error(`Expected exactly ${rows * cols} IDs for a ${rows}x${cols} grid, got ${ids ? ids.length : 0}.`);
  }

  const original = await readFile(inputPath);
  let image = await sharp(original).rotate().ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  const hasTransparency = image.data.some((_, idx) => idx % 4 === 3 && image.data[idx] < 255);

  if (!hasTransparency) {
    if (experimentalMatting) {
      console.log("Running experimental foreground matting on spritesheet...");
      const normalized = await sharp(image.data, { raw: image.info }).png().toBuffer();
      const args = ["run", "--no-project", "--python", "3.12", "--script", join(__dirname, "experimental-art-matting.py")];
      const cutout = execFileSync("uv", args, {
        input: normalized,
        maxBuffer: 256 * 1024 * 1024,
        stdio: ["pipe", "pipe", "inherit"],
      });
      image = await sharp(cutout).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    } else if (blueKey) {
      console.log("Running blue-screen keying on spritesheet...");
      keyBlue(image.data);
    }
  }

  const { width, height } = image.info;
  const cellW = Math.floor(width / cols);
  const cellH = Math.floor(height / rows);
  await mkdir(outputDir, { recursive: true });

  const results = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const index = r * cols + c;
      const id = ids[index];
      const minCellX = c * cellW;
      const maxCellX = c === cols - 1 ? width - 1 : (c + 1) * cellW - 1;
      const minCellY = r * cellH;
      const maxCellY = r === rows - 1 ? height - 1 : (r + 1) * cellH - 1;

      let minX = maxCellX;
      let maxX = minCellX;
      let minY = maxCellY;
      let maxY = minCellY;
      let foundForeground = false;

      for (let y = minCellY; y <= maxCellY; y++) {
        for (let x = minCellX; x <= maxCellX; x++) {
          const alpha = image.data[(y * width + x) * 4 + 3];
          if (alpha > 10) {
            foundForeground = true;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }

      if (!foundForeground) {
        console.warn(`Warning: No visible foreground found for cell (${r}, ${c}) [${id}]`);
        continue;
      }

      const left = Math.max(0, minX - padding);
      const top = Math.max(0, minY - padding);
      const right = Math.min(width - 1, maxX + padding);
      const bottom = Math.min(height - 1, maxY + padding);
      const extractWidth = right - left + 1;
      const extractHeight = bottom - top + 1;

      const cellImage = await sharp(image.data, { raw: image.info })
        .extract({ left, top, width: extractWidth, height: extractHeight })
        .png()
        .toBuffer();

      const outPath = join(outputDir, `${id}.png`);
      await writeFile(outPath, cellImage);
      console.log(`Saved sliced asset ${id}.png (${extractWidth}x${extractHeight}) -> ${outPath}`);
      results.push({ id, path: outPath, width: extractWidth, height: extractHeight });
    }
  }

  return results;
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      rows: { type: "string", default: "3" },
      cols: { type: "string", default: "3" },
      ids: { type: "string" },
      output: { type: "string" },
      matting: { type: "boolean", default: true },
      "blue-key": { type: "boolean", default: false },
    },
  });

  const inputPath = positionals[0];
  if (!inputPath) {
    throw new Error("Usage: node scripts/slice-spritesheet.mjs <spritesheet.png|jpg> --ids id1,id2,... [--rows 3] [--cols 3] [--output dir] [--matting]");
  }
  if (!values.ids) {
    throw new Error("--ids is required (comma-separated list of asset IDs in row-major order)");
  }

  const ids = values.ids.split(",").map((s) => s.trim());
  const rows = parseInt(values.rows, 10);
  const cols = parseInt(values.cols, 10);

  await sliceSpritesheet({
    inputPath: resolve(inputPath),
    outputDir: values.output ? resolve(values.output) : defaultOutputDir,
    rows,
    cols,
    ids,
    experimentalMatting: values.matting && !values["blue-key"],
    blueKey: values["blue-key"],
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
