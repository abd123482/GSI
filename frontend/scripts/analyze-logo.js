const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const inputPath = "C:/Users/KS/.gemini/antigravity-ide/brain/4451d9fd-4801-474f-a377-b6aaaf90d930/.user_uploaded/media_1789310526414.png";

async function analyzeConnectivity() {
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;

  // Let's find bounding box of non-white pixels
  // Define white as: r > 240 && g > 240 && b > 240
  let minX = width, maxX = 0, minY = height, maxY = 0;
  let nonWhiteCount = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * channels;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      
      const isWhite = (r > 235 && g > 235 && b > 235);
      if (!isWhite) {
        nonWhiteCount++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  console.log(`Non-white pixels: ${nonWhiteCount} / ${width * height} (${((nonWhiteCount / (width * height)) * 100).toFixed(1)}%)`);
  console.log(`Bounding box: x: [${minX}, ${maxX}], y: [${minY}, ${maxY}] (width: ${maxX - minX + 1}, height: ${maxY - minY + 1})`);
}

analyzeConnectivity().catch(console.error);
