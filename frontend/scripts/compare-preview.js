const sharp = require('sharp');

async function createComparison() {
  const bgWidth = 800;
  const bgHeight = 350;
  const navBg = { r: 43, g: 38, b: 34, alpha: 1 }; // #2b2622

  const logo1Buf = await sharp('public/somepharm-logo.png')
    .resize(120, 120, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  const logo2Buf = await sharp('public/somepharm-logo-dark.png')
    .resize(120, 120, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  await sharp({
    create: {
      width: bgWidth,
      height: bgHeight,
      channels: 4,
      background: navBg
    }
  })
    .composite([
      { input: logo1Buf, top: 110, left: 150 },
      { input: logo2Buf, top: 110, left: 450 }
    ])
    .png()
    .toFile('public/preview-comparison.png');

  console.log('Regenerated preview without black pillarbox!');
}

createComparison().catch(console.error);
