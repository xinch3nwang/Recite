import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const resDir = resolve(__dirname, '..', 'android', 'app', 'src', 'main', 'res');
const sourceSvg = resolve(__dirname, '..', 'public', 'icon.svg');

const densities = [
  { name: 'mdpi', size: 320, iconSize: 160 },
  { name: 'hdpi', size: 480, iconSize: 240 },
  { name: 'xhdpi', size: 640, iconSize: 320 },
  { name: 'xxhdpi', size: 960, iconSize: 480 },
  { name: 'xxxhdpi', size: 1280, iconSize: 640 },
];

async function generateSplashScreens() {
  for (const { name, size, iconSize } of densities) {
    const outputFile = resolve(resDir, `drawable-port-${name}`, 'splash.png');
    const outputFileLand = resolve(resDir, `drawable-land-${name}`, 'splash.png');

    const iconBuffer = await sharp(sourceSvg, { density: 300 })
      .resize(iconSize, iconSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();

    const baseImage = sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 249, g: 247, b: 242, alpha: 1 },
      },
    }).png();

    await baseImage
      .composite([{ input: iconBuffer, gravity: 'center' }])
      .toFile(outputFile);
    console.log(`Generated ${outputFile}`);

    await baseImage
      .composite([{ input: iconBuffer, gravity: 'center' }])
      .toFile(outputFileLand);
    console.log(`Generated ${outputFileLand}`);
  }
}

generateSplashScreens().catch((err) => {
  console.error(err);
  process.exit(1);
});
