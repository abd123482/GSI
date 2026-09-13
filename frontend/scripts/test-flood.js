const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const inputPath = "C:/Users/KS/.gemini/antigravity-ide/brain/4451d9fd-4801-474f-a377-b6aaaf90d930/.user_uploaded/media_1789310526414.png";

async function generateVariants() {
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;

  // Let's create two buffers:
  // Variant 1: Pure transparent background (all white pixels become transparent with smooth anti-aliased edge)
  // Variant 2: Outer background transparent via flood-fill from (0,0), keeping any internal enclosed area
  // Variant 3: Transparent background + slight contrast / vibrance adjustment for dark navbar

  // Let's first test what flood fill from borders reaches:
  const visited = new Uint8Array(width * height);
  const queue = [];

  function isWhite(x, y) {
    const idx = (y * width + x) * channels;
    const r = data[idx], g = data[idx + 1], b = data[idx + 2];
    // Threshold for background white
    return r > 240 && g > 240 && b > 240;
  }

  // Add all border pixels that are white to queue
  for (let x = 0; x < width; x++) {
    if (isWhite(x, 0)) { visited[0 * width + x] = 1; queue.push([x, 0]); }
    if (isWhite(x, height - 1)) { visited[(height - 1) * width + x] = 1; queue.push([x, height - 1]); }
  }
  for (let y = 0; y < height; y++) {
    if (isWhite(0, y)) { visited[y * width + 0] = 1; queue.push([0, y]); }
    if (isWhite(width - 1, y)) { visited[y * width + (width - 1)] = 1; queue.push([width - 1, y]); }
  }

  let head = 0;
  while (head < queue.length) {
    const [cx, cy] = queue[head++];
    const neighbors = [
      [cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]
    ];
    for (const [nx, ny] of neighbors) {
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const nidx = ny * width + nx;
        if (!visited[nidx] && isWhite(nx, ny)) {
          visited[nidx] = 1;
          queue.push([nx, ny]);
        }
      }
    }
  }

  let unreachedWhite = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (isWhite(x, y) && !visited[idx]) {
        unreachedWhite++;
      }
    }
  }

  console.log(`Flood-fill reached ${queue.length} pixels out of ${width * height}`);
  console.log(`Unreached white pixels (enclosed islands): ${unreachedWhite}`);
}

generateVariants().catch(console.error);
