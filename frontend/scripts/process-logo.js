const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const inputPath = "C:/Users/KS/.gemini/antigravity-ide/brain/4451d9fd-4801-474f-a377-b6aaaf90d930/.user_uploaded/media_1789310526414.png";
const outputPath = path.join(__dirname, '../public/somepharm-logo.png');

async function processLogo() {
  const image = sharp(inputPath);
  const metadata = await image.metadata();
  console.log('Metadata:', metadata);

  // Get raw pixel data
  const { data, info } = await image
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  console.log(`Image size: ${width}x${height}, channels: ${channels}`);

  // Inspect corners and background color
  const samplePixels = [];
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 10; x++) {
      const idx = (y * width + x) * channels;
      samplePixels.push({ r: data[idx], g: data[idx + 1], b: data[idx + 2], a: data[idx + 3] });
    }
  }
  console.log('Corner sample (first 5):', samplePixels.slice(0, 5));
}

processLogo().catch(err => console.error(err));
