import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const resDir = resolve(__dirname, '..', 'android', 'app', 'src', 'main', 'res');
const sourceSvg = resolve(__dirname, '..', 'public', 'icon.svg');

const densities = [
  { name: 'mdpi', size: 108, iconSize: 66 },
  { name: 'hdpi', size: 162, iconSize: 100 },
  { name: 'xhdpi', size: 216, iconSize: 132 },
  { name: 'xxhdpi', size: 324, iconSize: 198 },
  { name: 'xxxhdpi', size: 432, iconSize: 264 },
];

async function generateForegrounds() {
  for (const { name, size, iconSize } of densities) {
    const outputFile = resolve(resDir, `mipmap-${name}`, 'ic_launcher_foreground.png');
    const padding = Math.round((size - iconSize) / 2);
    await sharp(sourceSvg, { density: 300 })
      .resize(iconSize, iconSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .extend({
        top: padding,
        bottom: size - iconSize - padding,
        left: padding,
        right: size - iconSize - padding,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toFile(outputFile);
    console.log(`Generated ${outputFile}`);
  }
}

generateForegrounds().catch((err) => {
  console.error(err);
  process.exit(1);
});
