import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import sharp from "sharp";

const TILE_SIZE = 512;
const HERO_SIZE = 1024;
const QUALITY = 82;
const retiredBanners = new Set(["art-diet.png", "art-kitchen.png", "art-pantry.png", "art-fresh.png"]);
const defaultInput = fileURLToPath(new URL("../apps/mobile/src/features/onboarding/art/", import.meta.url));

async function main() {
  const { values } = parseArgs({
    options: {
      input: { type: "string" },
      output: { type: "string" },
    },
  });
  const input = resolve(values.input ?? defaultInput);
  const output = resolve(values.output ?? join(input, "optimized"));
  const entries = await readdir(input, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".png") && !retiredBanners.has(entry.name))
    .map((entry) => entry.name)
    .sort();
  if (!files.length) throw new Error(`No current PNG masters found in ${input}.`);
  await mkdir(output, { recursive: true });
  let sourceBytes = 0;
  let optimizedBytes = 0;

  for (const file of files) {
    const size = file === "art-welcome.png" || file.startsWith("welcome-") ? HERO_SIZE : TILE_SIZE;
    const original = await readFile(join(input, file));
    const { data, info } = await sharp(original)
      .rotate()
      .resize({ width: size, height: size, fit: "inside", withoutEnlargement: true })
      .webp({ quality: QUALITY, alphaQuality: 100, effort: 6 })
      .toBuffer({ resolveWithObject: true });
    const destination = join(output, file.replace(/\.png$/, ".webp"));
    const previous = await readFile(destination).catch((error) => {
      if (error.code !== "ENOENT") throw error;
      return null;
    });
    if (!previous?.equals(data)) await writeFile(destination, data);
    sourceBytes += original.length;
    optimizedBytes += data.length;
    console.log(`${file}: ${info.width}x${info.height}, ${(original.length / 1024).toFixed(1)} KiB -> ${(data.length / 1024).toFixed(1)} KiB`);
  }

  const savings = ((1 - optimizedBytes / sourceBytes) * 100).toFixed(1);
  console.log(`Total: ${files.length} images, ${(sourceBytes / 1024 / 1024).toFixed(2)} MiB -> ${(optimizedBytes / 1024 / 1024).toFixed(2)} MiB (${savings}% smaller)`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
