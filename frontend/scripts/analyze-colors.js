const sharp = require('sharp');

async function analyzeColors() {
  const inputPath = "C:/Users/KS/.gemini/antigravity-ide/brain/4451d9fd-4801-474f-a377-b6aaaf90d930/.user_uploaded/media_1789310526414.png";
  const { data, info } = await sharp(inputPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  let cyanSum = [0, 0, 0], cyanCount = 0;
  let navySum = [0, 0, 0], navyCount = 0;

  for (let i = 0; i < data.length; i += channels) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (r > 240 && g > 240 && b > 240) continue; // skip white
    
    // Distinguish cyan vs navy:
    // Cyan has high blue & high green (e.g. b > 180, g > 150)
    // Navy has low r, g, and moderate/low b (e.g. r < 50, g < 70, b < 120)
    if (g > 120 && b > 160) {
      cyanSum[0] += r; cyanSum[1] += g; cyanSum[2] += b;
      cyanCount++;
    } else {
      navySum[0] += r; navySum[1] += g; navySum[2] += b;
      navyCount++;
    }
  }

  console.log(`Cyan pixels: ${cyanCount}, avg color: rgb(${Math.round(cyanSum[0]/cyanCount)}, ${Math.round(cyanSum[1]/cyanCount)}, ${Math.round(cyanSum[2]/cyanCount)})`);
  console.log(`Navy pixels: ${navyCount}, avg color: rgb(${Math.round(navySum[0]/navyCount)}, ${Math.round(navySum[1]/navyCount)}, ${Math.round(navySum[2]/navyCount)})`);
}

analyzeColors().catch(console.error);
