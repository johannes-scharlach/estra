const fs = require("fs");
const { execSync } = require("child_process");
const { PNG } = require("pngjs");

function trimTransparent(png, padding = 16) {
  let minX = png.width;
  let maxX = 0;
  let minY = png.height;
  let maxY = 0;

  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const idx = (png.width * y + x) << 2;
      const alpha = png.data[idx + 3];
      if (alpha > 10) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (minX > maxX || minY > maxY) {
    return png; // empty image, return as is
  }

  minX = Math.max(0, minX - padding);
  minY = Math.max(0, minY - padding);
  maxX = Math.min(png.width - 1, maxX + padding);
  maxY = Math.min(png.height - 1, maxY + padding);

  const croppedWidth = maxX - minX + 1;
  const croppedHeight = maxY - minY + 1;
  const cropped = new PNG({ width: croppedWidth, height: croppedHeight });

  for (let y = 0; y < croppedHeight; y++) {
    for (let x = 0; x < croppedWidth; x++) {
      const srcIdx = (png.width * (minY + y) + (minX + x)) << 2;
      const destIdx = (croppedWidth * y + x) << 2;
      cropped.data[destIdx] = png.data[srcIdx];
      cropped.data[destIdx + 1] = png.data[srcIdx + 1];
      cropped.data[destIdx + 2] = png.data[srcIdx + 2];
      cropped.data[destIdx + 3] = png.data[srcIdx + 3];
    }
  }

  return cropped;
}

/**
 * Chroma keys a blue-screen (#0047FF) clay render into a transparent PNG.
 * Includes soft edge feathering, blue despill along edges, and autocropping
 * to remove excessive dead margin.
 */
function chromaKey(inputPath, outputPath) {
  const tempPng = `/tmp/temp_key_${Date.now()}.png`;
  execSync(`sips -s format png "${inputPath}" --out "${tempPng}"`);

  const data = fs.readFileSync(tempPng);
  const png = PNG.sync.read(data);
  const { width, height } = png;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (width * y + x) << 2;
      const r = png.data[idx];
      const g = png.data[idx + 1];
      const b = png.data[idx + 2];

      const maxRG = Math.max(r, g);
      const diff = b - maxRG;

      // Soft thresholding for smooth edges
      const k1 = 25; // edge transition start
      const k2 = 80; // definite blue background

      if (diff >= k2) {
        png.data[idx + 3] = 0;
      } else if (diff <= k1) {
        png.data[idx + 3] = 255;
      } else {
        const alphaFraction = 1 - (diff - k1) / (k2 - k1);
        png.data[idx + 3] = Math.round(255 * alphaFraction);
        png.data[idx + 2] = Math.min(b, maxRG); // despill
      }

      // Despill remaining edge pixels where blue reflection lingers
      if (png.data[idx + 3] > 0 && b > maxRG) {
        png.data[idx + 2] = maxRG;
      }
    }
  }

  // Trim transparent whitespace so the subject fills its bounding frame cleanly
  const trimmed = trimTransparent(png, 16);

  const outBuffer = PNG.sync.write(trimmed);
  fs.writeFileSync(outputPath, outBuffer);
  try {
    fs.unlinkSync(tempPng);
  } catch {}
  console.log(`Saved transparent cropped image (${trimmed.width}x${trimmed.height}): ${outputPath}`);
}

const [, , inputPath, outputPath] = process.argv;
if (!inputPath || !outputPath) {
  console.error("Usage: node scripts/chroma-key.js <input.jpg|png> <output.png>");
  process.exit(1);
}
chromaKey(inputPath, outputPath);
