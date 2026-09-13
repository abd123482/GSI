const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const inputPath = "C:/Users/KS/.gemini/antigravity-ide/brain/4451d9fd-4801-474f-a377-b6aaaf90d930/.user_uploaded/media_1789310526414.png";
const outDir = path.join(__dirname, '../public');

async function processLogoPerfect() {
  const img = sharp(inputPath);
  const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  // 1. Precise bounding box
  let minX = width, maxX = 0, minY = height, maxY = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * channels;
      const r = data[idx], g = data[idx + 1], b = data[idx + 2];
      // Check if not pure white
      const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
      const isWhite = (r > 248 && g > 248 && b > 248);
      if (!isWhite) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  console.log(`Bounds: [${minX}, ${maxX}] x [${minY}, ${maxY}]`);

  // Crop padding slightly (give 10px margin around logo)
  const pad = 12;
  const cropX = Math.max(0, minX - pad);
  const cropY = Math.max(0, minY - pad);
  const cropW = Math.min(width - cropX, (maxX - minX) + 2 * pad);
  const cropH = Math.min(height - cropY, (maxY - minY) + 2 * pad);

  // We will create cropped high-res image with smooth alpha transparency
  // For each pixel, compute alpha based on color distance from white (255, 255, 255).
  // If a pixel was anti-aliased against white, its original color C satisfies:
  // observed = alpha * C + (1 - alpha) * white
  // Therefore:
  // If observed is close to white (e.g. dist < threshold), alpha approaches 0.
  
  const croppedData = Buffer.alloc(cropW * cropH * 4);

  for (let cy = 0; cy < cropH; cy++) {
    const srcY = cropY + cy;
    for (let cx = 0; cx < cropW; cx++) {
      const srcX = cropX + cx;
      const srcIdx = (srcY * width + srcX) * channels;
      const dstIdx = (cy * cropW + cx) * 4;

      const r = data[srcIdx];
      const g = data[srcIdx + 1];
      const b = data[srcIdx + 2];

      // Distance from white
      const dr = 255 - r;
      const dg = 255 - g;
      const db = 255 - b;
      const dist = Math.sqrt(dr * dr + dg * dg + db * db);

      let alpha = 255;
      let newR = r;
      let newG = g;
      let newB = b;

      // Pure or near white threshold
      if (dist < 6) {
        alpha = 0;
      } else if (dist < 32) {
        // Smooth feathering on the edge to avoid white halo or jagged artifacts
        const factor = (dist - 6) / (32 - 6);
        alpha = Math.round(factor * 255);
        
        // De-bias the color towards the foreground so there's no white fringe:
        // C_fg = (observed - (1 - alpha_norm) * 255) / alpha_norm
        const aNorm = Math.max(0.05, factor);
        newR = Math.min(255, Math.max(0, Math.round((r - (1 - aNorm) * 255) / aNorm)));
        newG = Math.min(255, Math.max(0, Math.round((g - (1 - aNorm) * 255) / aNorm)));
        newB = Math.min(255, Math.max(0, Math.round((b - (1 - aNorm) * 255) / aNorm)));
      } else {
        alpha = 255;
      }

      croppedData[dstIdx] = newR;
      croppedData[dstIdx + 1] = newG;
      croppedData[dstIdx + 2] = newB;
      croppedData[dstIdx + 3] = alpha;
    }
  }

  // Save standard transparent logo
  const standardTransparent = path.join(outDir, 'somepharm-logo.png');
  await sharp(croppedData, {
    raw: { width: cropW, height: cropH, channels: 4 }
  })
    .png({ compressionLevel: 9 })
    .toFile(standardTransparent);

  console.log(`Saved transparent logo to: ${standardTransparent}`);

  // Also create a version optimized for dark backgrounds:
  // In the dark-mode optimized version:
  // The cyan remains vivid (#4fc1e4).
  // The dark navy is slightly lifted so it has rich contrast against #2b2622:
  // E.g. dark navy rgb(22, 46, 80) -> lifted to rgb(35, 78, 135) or similar rich indigo/sapphire.
  const darkModeData = Buffer.from(croppedData);
  for (let i = 0; i < darkModeData.length; i += 4) {
    const a = darkModeData[i + 3];
    if (a === 0) continue;
    const r = darkModeData[i];
    const g = darkModeData[i + 1];
    const b = darkModeData[i + 2];

    // Check if it's navy (low green, low red, moderate blue)
    if (g < 100 && r < 70 && b < 140) {
      // Lift navy brightness so it stands out beautifully on dark background
      darkModeData[i] = Math.min(255, Math.round(r * 1.5 + 20));     // e.g. 22 -> 53
      darkModeData[i + 1] = Math.min(255, Math.round(g * 1.5 + 25)); // e.g. 46 -> 94
      darkModeData[i + 2] = Math.min(255, Math.round(b * 1.4 + 40)); // e.g. 80 -> 152
    }
  }

  const darkTransparent = path.join(outDir, 'somepharm-logo-dark.png');
  await sharp(darkModeData, {
    raw: { width: cropW, height: cropH, channels: 4 }
  })
    .png({ compressionLevel: 9 })
    .toFile(darkTransparent);

  console.log(`Saved dark-mode optimized logo to: ${darkTransparent}`);
}

processLogoPerfect().catch(console.error);
