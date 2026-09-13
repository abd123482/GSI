const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

async function buildAssets() {
  const publicDir = path.join(__dirname, '../public');
  
  // The dark-mode optimized logo buffer
  const darkLogoPath = path.join(publicDir, 'somepharm-logo-dark.png');
  const mainLogoPath = path.join(publicDir, 'somepharm-logo.png');

  // Copy dark-mode optimized version to somepharm-logo.png as default
  fs.copyFileSync(darkLogoPath, mainLogoPath);
  console.log('Copied somepharm-logo-dark.png to somepharm-logo.png');

  // Create high-res square versions with slight padding for icons (192, 512, apple-icon)
  // Square container: 512x512, transparent
  await sharp(mainLogoPath)
    .resize(440, 440, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({
      top: 36,
      bottom: 36,
      left: 36,
      right: 36,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toFile(path.join(publicDir, 'icon-512.png'));

  // 192x192
  await sharp(path.join(publicDir, 'icon-512.png'))
    .resize(192, 192)
    .png()
    .toFile(path.join(publicDir, 'icon-192.png'));

  // apple-icon.png (180x180)
  await sharp(path.join(publicDir, 'icon-512.png'))
    .resize(180, 180)
    .png()
    .toFile(path.join(publicDir, 'apple-icon.png'));

  // 32x32 for favicon.ico
  await sharp(path.join(publicDir, 'icon-512.png'))
    .resize(32, 32)
    .png()
    .toFile(path.join(publicDir, 'favicon.png'));

  console.log('All branding assets generated successfully!');
}

buildAssets().catch(console.error);
