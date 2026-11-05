const sharp = require('sharp');
const toIco = require('to-ico');
const fs = require('fs');
const path = require('path');

const input = 'DayOS Logo Vector.png';
const outDir = 'src-tauri/icons';
const publicDir = 'public';

async function generate() {
  if (!fs.existsSync(input)) {
    console.error('Source not found:', input);
    process.exit(1);
  }

  // 1. Trim the source image to extract the exact bounds of the logo
  console.log('Trimming source vector to content bounds...');
  const trimmed = await sharp(input).trim().toBuffer({ resolveWithObject: true });
  console.log(`Trimmed logo bounds: ${trimmed.info.width}x${trimmed.info.height}`);

  // 2. Create high-resolution master with black rounded-square background (1024x1024)
  const masterSize = 1024;
  const radius = Math.round(masterSize * 0.1875); // 192px radius (matches modern app squircles / rounded-xl)
  const svgBadge = Buffer.from(
    `<svg width="${masterSize}" height="${masterSize}" viewBox="0 0 ${masterSize} ${masterSize}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${masterSize}" height="${masterSize}" rx="${radius}" ry="${radius}" fill="#000000" />
    </svg>`
  );

  // Logo occupies ~75% of canvas height/width, centered with comfortable breathing room
  const logoTargetDim = Math.round(masterSize * 0.74); // ~758px
  const resizedLogo = await sharp(trimmed.data)
    .resize(logoTargetDim, logoTargetDim, {
      fit: 'inside',
      kernel: sharp.kernel.lanczos3,
    })
    .toBuffer();

  const masterBuffer = await sharp(svgBadge)
    .composite([{ input: resizedLogo, gravity: 'center' }])
    .png()
    .toBuffer();

  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

  // Function to resize master cleanly for various sizes with optional sharpening for small sizes
  async function makePng(size, sharpenAmount = 0) {
    let pipeline = sharp(masterBuffer).resize(size, size, {
      fit: 'contain',
      kernel: sharp.kernel.lanczos3,
    });
    if (sharpenAmount > 0) {
      pipeline = pipeline.sharpen({ sigma: sharpenAmount });
    }
    return pipeline.png().toBuffer();
  }

  console.log('Generating multi-resolution PNGs for Windows taskbar & ICO...');
  const icoSizes = [16, 20, 24, 30, 32, 40, 48, 64, 72, 96, 128, 256];
  const icoBuffers = [];

  for (const s of icoSizes) {
    // Apply slight sharpening to smaller sizes for maximum clarity
    const sharpen = s <= 32 ? 0.6 : s <= 64 ? 0.3 : 0;
    const buf = await makePng(s, sharpen);
    icoBuffers.push(buf);
  }

  // Windows ICO packaging with all standard DPI sizes
  const icoFileBuffer = await toIco(icoBuffers);
  fs.writeFileSync(path.join(outDir, 'icon.ico'), icoFileBuffer);
  fs.writeFileSync(path.join(publicDir, 'favicon.ico'), icoFileBuffer);
  console.log('Generated icon.ico & public/favicon.ico (multi-resolution with black background)');

  // Standard PNG sizes for Tauri & Web
  const png16 = await makePng(16, 0.6);
  const png32 = await makePng(32, 0.5);
  const png128 = await makePng(128);
  const png256 = await makePng(256);

  fs.writeFileSync(path.join(outDir, '32x32.png'), png32);
  fs.writeFileSync(path.join(outDir, '128x128.png'), png128);
  fs.writeFileSync(path.join(outDir, '128x128@2x.png'), png256);
  fs.writeFileSync(path.join(outDir, 'icon.png'), masterBuffer);

  fs.writeFileSync(path.join(publicDir, 'favicon-16x16.png'), png16);
  fs.writeFileSync(path.join(publicDir, 'favicon-32x32.png'), png32);
  fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), png256);
  fs.writeFileSync(path.join(publicDir, 'logo-256.png'), png256);

  // Windows tile logos
  const tileSizes = [
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

  for (const [name, size] of tileSizes) {
    const buf = await makePng(size, size <= 44 ? 0.5 : 0);
    fs.writeFileSync(path.join(outDir, name), buf);
    console.log(`Generated ${name} (${size}x${size})`);
  }

  console.log('All high-quality taskbar and app icons generated successfully with black background!');
}

generate().catch((e) => {
  console.error(e);
  process.exit(1);
});
