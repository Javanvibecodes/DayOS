const sharp = require('sharp');
const toIco = require('to-ico');
const fs = require('fs');
const path = require('path');

const input = 'DayOS Logo Vector.png';
const outDir = 'src-tauri/icons';

async function generate() {
  if (!fs.existsSync(input)) {
    console.error('Source not found:', input);
    process.exit(1);
  }
  
  const img = sharp(input);
  const meta = await img.metadata();
  console.log('Source:', meta.width, 'x', meta.height);
  
  // Ensure output dir
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  
  // Generate PNG sizes we need for ICO
  const png16 = await img.resize(16, 16).png().toBuffer();
  const png32 = await img.resize(32, 32).png().toBuffer();
  const png48 = await img.resize(48, 48).png().toBuffer();
  const png256 = await img.resize(256, 256).png().toBuffer();
  
  // Write individual PNGs
  fs.writeFileSync(path.join(outDir, '32x32.png'), png32);
  console.log('Generated 32x32.png');
  
  fs.writeFileSync(path.join(outDir, '128x128.png'), await img.resize(128, 128).png().toBuffer());
  console.log('Generated 128x128.png');
  
  fs.writeFileSync(path.join(outDir, '128x128@2x.png'), await img.resize(256, 256).png().toBuffer());
  console.log('Generated 128x128@2x.png');
  
  // Generate proper multi-size ICO
  const icoBuffer = await toIco([png16, png32, png48, png256]);
  fs.writeFileSync(path.join(outDir, 'icon.ico'), icoBuffer);
  console.log('Generated icon.ico (multi-size: 16,32,48,256)');
  
  // ICNS (macOS) - 1024x1024 png for iconset
  fs.writeFileSync(path.join(outDir, 'icon.png'), await img.resize(1024, 1024).png().toBuffer());
  console.log('Generated icon.png (1024x1024 for ICNS)');
  
  // Windows tile logos
  const sizes = [
    ['Square30x30Logo.png', 30],
    ['Square44x44Logo.png', 44],
    ['Square71x71Logo.png', 71],
    ['Square89x89Logo.png', 89],
    ['Square107x107Logo.png', 107],
    ['Square142x142Logo.png', 142],
    ['Square150x150Logo.png', 150],
    ['Square284x284Logo.png', 284],
    ['Square310x310Logo.png', 310],
    ['StoreLogo.png', 50],
  ];
  
  for (const [name, size] of sizes) {
    fs.writeFileSync(path.join(outDir, name), await img.resize(size, size).png().toBuffer());
    console.log('Generated', name);
  }
  
  console.log('Done!');
}

generate().catch(e => { console.error(e); process.exit(1); });