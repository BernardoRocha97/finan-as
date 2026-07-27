const sharp = require("sharp");
const path = require("path");

const publicDir = path.join(__dirname, "../public");

const svg = (size) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${Math.round(size * 0.2)}" fill="#1e40af"/>
  <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle"
    font-family="Arial, sans-serif" font-weight="bold" font-size="${Math.round(size * 0.55)}" fill="white">€</text>
</svg>`);

async function generate() {
  for (const size of [192, 512]) {
    await sharp(svg(size)).png().toFile(path.join(publicDir, `icon-${size}.png`));
    console.log(`icon-${size}.png gerado`);
  }
  // Apple touch icon (180x180)
  await sharp(svg(180)).png().toFile(path.join(publicDir, "apple-touch-icon.png"));
  console.log("apple-touch-icon.png gerado");
}

generate().catch(console.error);
