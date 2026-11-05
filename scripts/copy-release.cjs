const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const nsisDir = path.join(projectRoot, 'src-tauri', 'target', 'release', 'bundle', 'nsis');
const releasesDir = path.join(projectRoot, 'releases');

if (!fs.existsSync(releasesDir)) {
  fs.mkdirSync(releasesDir, { recursive: true });
}

if (!fs.existsSync(nsisDir)) {
  console.error(`NSIS bundle directory not found at: ${nsisDir}`);
  process.exit(1);
}

const files = fs.readdirSync(nsisDir);
const exeFile = files.find(f => f.endsWith('.exe') && !f.endsWith('.exe.sig'));

if (!exeFile) {
  console.error('No .exe installer found in ' + nsisDir);
  process.exit(1);
}

const sourceExe = path.join(nsisDir, exeFile);
const targetStandardExe = path.join(releasesDir, 'DayOS-Setup.exe');
const targetVersionedExe = path.join(releasesDir, exeFile);

fs.copyFileSync(sourceExe, targetStandardExe);
console.log(`Copied ${exeFile} -> releases/DayOS-Setup.exe`);

fs.copyFileSync(sourceExe, targetVersionedExe);
console.log(`Copied ${exeFile} -> releases/${exeFile}`);

const stats = fs.statSync(targetStandardExe);
const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);
console.log(`Release binary is ready: ${targetStandardExe} (${sizeMb} MB)`);

