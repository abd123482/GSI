const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

async function createSvg() {
  const logoBuf = await sharp(path.join(__dirname, '../public/icon-512.png')).png().toBuffer();
  const b64 = logoBuf.toString('base64');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <image href="data:image/png;base64,${b64}" x="0" y="0" width="512" height="512"/>
</svg>
`;

  fs.writeFileSync(path.join(__dirname, '../public/icon.svg'), svg, 'utf-8');
  console.log('Saved public/icon.svg');
}

createSvg().catch(console.error);
