import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import sharp from "sharp";

const exec = promisify(execFile);
const command = fileURLToPath(new URL("./optimize-onboarding-art.mjs", import.meta.url));

async function workspace(t) {
  const directory = await mkdtemp(join(tmpdir(), "magpie-art-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const input = join(directory, "PNG masters");
  const output = join(directory, "WebP exports");
  await mkdir(input);
  return { input, output };
}

function optimize({ input, output }, ...options) {
  return exec(process.execPath, [command, "--input", input, "--output", output, ...options]);
}

test("generates a resized transparent WebP and leaves its PNG master untouched", async (t) => {
  const directories = await workspace(t);
  const source = join(directories.input, "equipment-oven.png");
  const pixels = Buffer.alloc(1024 * 512 * 4);
  for (let y = 0; y < 512; y++) {
    for (let x = 0; x < 1024; x++) {
      const offset = (y * 1024 + x) * 4;
      pixels[offset] = 200;
      pixels[offset + 1] = 100;
      pixels[offset + 2] = 50;
      pixels[offset + 3] = x < 512 ? 0 : 128;
    }
  }
  await sharp(pixels, { raw: { width: 1024, height: 512, channels: 4 } }).png().toFile(source);
  const original = await readFile(source);

  const { stdout } = await optimize(directories);

  const result = sharp(join(directories.output, "equipment-oven.webp"));
  const metadata = await result.metadata();
  assert.equal(metadata.format, "webp");
  assert.equal(metadata.width, 512);
  assert.equal(metadata.height, 256);
  assert.equal(metadata.hasAlpha, true);
  const { data, info } = await result.raw().toBuffer({ resolveWithObject: true });
  assert.equal(data[3], 0);
  assert.equal(data[(info.width - 1) * info.channels + 3], 128);
  assert.deepEqual(await readFile(source), original);
  assert.match(stdout, /equipment-oven\.png/);
  assert.match(stdout, /Total:/);
});

test("uses a larger limit for welcome art without upscaling small masters", async (t) => {
  const directories = await workspace(t);
  for (const [file, width, height] of [
    ["welcome-market-find.png", 1536, 1024],
    ["art-welcome.png", 1600, 1000],
    ["fresh-onions.png", 64, 32],
  ]) {
    await sharp({ create: { width, height, channels: 4, background: "#FBF8F4" } })
      .png()
      .toFile(join(directories.input, file));
  }

  await optimize(directories);

  for (const [file, width, height] of [
    ["welcome-market-find.webp", 1024, 683],
    ["art-welcome.webp", 1024, 640],
    ["fresh-onions.webp", 64, 32],
  ]) {
    const metadata = await sharp(join(directories.output, file)).metadata();
    assert.equal(metadata.width, width, file);
    assert.equal(metadata.height, height, file);
  }
});

test("does not export retired banners or remove their masters", async (t) => {
  const directories = await workspace(t);
  const retired = ["art-diet.png", "art-kitchen.png", "art-pantry.png", "art-fresh.png"];
  for (const file of retired) {
    await writeFile(join(directories.input, file), "retained reference artwork");
  }
  await sharp({ create: { width: 32, height: 32, channels: 4, background: "white" } })
    .png()
    .toFile(join(directories.input, "fresh-eggs.png"));

  await optimize(directories);

  assert.deepEqual(await readdir(directories.output), ["fresh-eggs.webp"]);
  for (const file of retired) {
    assert.equal(await readFile(join(directories.input, file), "utf8"), "retained reference artwork");
  }
});

test("repeat generation leaves unchanged exports and unrelated files alone", async (t) => {
  const directories = await workspace(t);
  await sharp({ create: { width: 32, height: 32, channels: 4, background: "white" } })
    .png()
    .toFile(join(directories.input, "fresh-eggs.png"));
  await optimize(directories);
  const exported = join(directories.output, "fresh-eggs.webp");
  const original = await readFile(exported);
  const modified = (await stat(exported)).mtimeMs;
  const unrelated = join(directories.output, "keep.txt");
  await writeFile(unrelated, "do not remove");

  await optimize(directories);

  assert.deepEqual(await readFile(exported), original);
  assert.equal((await stat(exported)).mtimeMs, modified);
  assert.equal(await readFile(unrelated, "utf8"), "do not remove");
});

test("fails clearly when there are no current PNG masters to process", async (t) => {
  const directories = await workspace(t);

  await assert.rejects(optimize(directories), (error) => {
    assert.equal(error.code, 1);
    assert.match(error.stderr, /No current PNG masters/);
    return true;
  });
});
