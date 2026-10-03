const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const pngToIco = require('png-to-ico');

const root = path.join(__dirname, '..');
const src = ['icon.jpg', 'icon.jpeg', 'icon.png'].map(f => path.join(root, f)).find(fs.existsSync);

if (!src) { 
  console.error('Source icon not found in project root!'); 
  process.exit(1); 
}

// Generate PNG with Lanczos resampling for maximum sharp clarity at small scales
const png = size => sharp(src)
  .resize(size, size, { 
    fit: 'contain', 
    kernel: 'lanczos3', // High-quality image filter
    background: { r: 0, g: 0, b: 0, alpha: 0 } 
  })
  .png()
  .toBuffer();

(async () => {
  fs.mkdirSync(path.join(root, 'build'), { recursive: true });
  
  // App UI & Installer icons
  fs.writeFileSync(path.join(root, 'renderer', 'icon.png'), await png(256));
  fs.writeFileSync(path.join(root, 'build', 'icon.png'), await png(512));

  // Multi-resolution ICO with all essential sizes
  const icoSizes = [256, 128, 64, 48, 32, 24, 16];
  const icoBuffers = await Promise.all(icoSizes.map(png));
  
  fs.writeFileSync(path.join(root, 'build', 'icon.ico'), await pngToIco(icoBuffers));
  console.log('High-quality icons successfully built in /build and /renderer!');
})();