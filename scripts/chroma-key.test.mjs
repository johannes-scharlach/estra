import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import sharp from "sharp";

const exec = promisify(execFile);
const command = fileURLToPath(new URL("./chroma-key.js", import.meta.url));

async function workspace(t) {
  const directory = await mkdtemp(join(tmpdir(), "magpie-matting-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return {
    source: join(directory, "original render.png"),
    mask: join(directory, "foreground mask.png"),
    output: join(directory, "experimental cutout.png"),
  };
}

// A known opaque render: a warm object with a soft edge mixed over a screen.
// The supplied alpha mask has definite foreground/background and a 50% border.
async function renderFixture({ source, mask }, foreground, background) {
  const pixels = Buffer.alloc(160 * 120 * 3);
  const matte = Buffer.alloc(160 * 120);
  for (let y = 0; y < 120; y++) {
    for (let x = 0; x < 160; x++) {
      const inside = x >= 49 && x <= 110 && y >= 41 && y <= 78;
      const border = x >= 47 && x <= 112 && y >= 39 && y <= 80;
      const alpha = inside ? 1 : border ? 0.5 : 0;
      const offset = y * 160 + x;
      matte[offset] = inside ? 255 : border ? 128 : 0;
      for (let channel = 0; channel < 3; channel++) {
        pixels[offset * 3 + channel] = Math.round(
          foreground[channel] * alpha + background[channel] * (1 - alpha),
        );
      }
    }
  }
  await sharp(pixels, { raw: { width: 160, height: 120, channels: 3 } }).png().toFile(source);
  await sharp(matte, { raw: { width: 160, height: 120, channels: 1 } }).png().toFile(mask);
}

function matte({ source, output, mask }) {
  return exec(process.execPath, [command, source, output, "--experimental-matting", "--mask", mask]);
}

test("experimental matting recovers soft edge colours instead of retaining the blue screen", async (t) => {
  const files = await workspace(t);
  await renderFixture(files, [200, 160, 120], [0, 71, 255]);
  const original = await readFile(files.source);

  await matte(files);

  const { data, info } = await sharp(files.output).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, 98);
  assert.equal(info.height, 74);
  assert.equal(data[3], 0);
  // The crop retains 16px padding; this pixel is on the left soft edge.
  const edge = (37 * info.width + 16) * 4;
  for (const [channel, expected] of [200, 160, 120, 128].entries()) {
    assert.ok(Math.abs(data[edge + channel] - expected) <= 6,
      `edge channel ${channel}: expected ${expected}, got ${data[edge + channel]}`);
  }
  assert.deepEqual(await readFile(files.source), original);
});

test("the experiment refuses to overwrite originals or existing exports", async (t) => {
  const files = await workspace(t);
  await renderFixture(files, [40, 100, 200], [128, 128, 128]);
  const original = await readFile(files.source);
  await writeFile(files.output, "keep this existing export");

  for (const output of [files.source, files.output]) {
    await assert.rejects(matte({ ...files, output }), (error) => {
      assert.equal(error.code, 1);
      assert.match(error.stderr, /Output already exists/);
      return true;
    });
  }

  assert.deepEqual(await readFile(files.source), original);
  assert.equal(await readFile(files.output, "utf8"), "keep this existing export");
});

test("rejects already-transparent masters rather than recalculating their alpha", async (t) => {
  const files = await workspace(t);
  await renderFixture(files, [40, 100, 200], [128, 128, 128]);
  const image = await sharp(files.source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  image.data[(60 * image.info.width + 60) * 4 + 3] = 128;
  await sharp(image.data, { raw: image.info }).png().toFile(files.source);
  const original = await readFile(files.source);

  await assert.rejects(matte(files), (error) => {
    assert.equal(error.code, 1);
    assert.match(error.stderr, /already contains transparency/);
    return true;
  });

  assert.deepEqual(await readFile(files.source), original);
});
