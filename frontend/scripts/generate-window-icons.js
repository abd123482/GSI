const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

function createIco(pngBuffers) {
  // pngBuffers: array of { width, height, buffer }
  const count = pngBuffers.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  let offset = headerSize + count * dirEntrySize;

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // 1 = ICO
  header.writeUInt16LE(count, 4); // count

  const entries = [];
  const datas = [];

  for (const img of pngBuffers) {
    const entry = Buffer.alloc(dirEntrySize);
    entry.writeUInt8(img.width >= 256 ? 0 : img.width, 0);
    entry.writeUInt8(img.height >= 256 ? 0 : img.height, 1);
    entry.writeUInt8(0, 2); // palette
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(img.buffer.length, 8); // size
    entry.writeUInt32LE(offset, 12); // offset

    entries.push(entry);
    datas.push(img.buffer);
    offset += img.buffer.length;
  }

  return Buffer.concat([header, ...entries, ...datas]);
}

async function generateAllWindowIcons() {
  const publicDir = path.join(__dirname, '../public');
  const appDir = path.join(__dirname, '../src/app');

  // Use the transparent dark-mode optimized logo (with lifted sapphire navy and bright cyan)
  const sourceLogo = path.join(publicDir, 'somepharm-logo.png');

  // Let's create an icon master on transparent background:
  // We'll create a square canvas with the logo centered and a tiny padding so it looks great in browser tabs
  const iconBase512 = await sharp(sourceLogo)
    .resize(460, 460, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({
      top: 26,
      bottom: 26,
      left: 26,
      right: 26,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toBuffer();

  // Generate PNG sizes
  const buf512 = await sharp(iconBase512).resize(512, 512).png().toBuffer();
  const buf192 = await sharp(iconBase512).resize(192, 192).png().toBuffer();
  const buf180 = await sharp(iconBase512).resize(180, 180).png().toBuffer();
  const buf48 = await sharp(iconBase512).resize(48, 48).png().toBuffer();
  const buf32 = await sharp(iconBase512).resize(32, 32).png().toBuffer();
  const buf16 = await sharp(iconBase512).resize(16, 16).png().toBuffer();

  // Create .ico with 16, 32, 48
  const icoBuffer = createIco([
    { width: 16, height: 16, buffer: buf16 },
    { width: 32, height: 32, buffer: buf32 },
    { width: 48, height: 48, buffer: buf48 }
  ]);

  // Create SVG icon
  const b64_512 = buf512.toString('base64');
  const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <image href="data:image/png;base64,${b64_512}" x="0" y="0" width="512" height="512"/>
</svg>
`;

  // Write to src/app
  fs.writeFileSync(path.join(appDir, 'favicon.ico'), icoBuffer);
  fs.writeFileSync(path.join(appDir, 'icon.svg'), svgContent, 'utf-8');
  fs.writeFileSync(path.join(appDir, 'icon.png'), buf512);
  fs.writeFileSync(path.join(appDir, 'apple-icon.png'), buf180);

  // Write to public
  fs.writeFileSync(path.join(publicDir, 'favicon.ico'), icoBuffer);
  fs.writeFileSync(path.join(publicDir, 'icon.svg'), svgContent, 'utf-8');
  fs.writeFileSync(path.join(publicDir, 'apple-icon.png'), buf180);
  fs.writeFileSync(path.join(publicDir, 'icon-192.png'), buf192);
  fs.writeFileSync(path.join(publicDir, 'icon-512.png'), buf512);

  console.log('Successfully generated all window icons in src/app and public!');
}

generateAllWindowIcons().catch(console.error);
