import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const publicDir = resolve(__dirname, '..', 'public');
const sourceSvg = resolve(publicDir, 'icon.svg');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

async function generateIcons() {
  for (const size of sizes) {
    const outputFile = resolve(publicDir, `icon-${size}x${size}.png`);
    await sharp(sourceSvg, { density: 300 })
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(outputFile);
    console.log(`Generated ${outputFile}`);
  }
}

generateIcons().catch((err) => {
  console.error(err);
  process.exit(1);
});
