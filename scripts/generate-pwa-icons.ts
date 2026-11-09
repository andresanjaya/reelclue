import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const publicIconsDir = path.resolve(process.cwd(), "public", "icons");
if (!fs.existsSync(publicIconsDir)) {
  fs.mkdirSync(publicIconsDir, { recursive: true });
}

// ReelClue SVG Icon Design (Film Reel + Clue Magnifier Motif)
function getSvg(isMaskable = false) {
  const bg = isMaskable
    ? `<rect width="512" height="512" fill="#10131a" />`
    : `<rect width="512" height="512" rx="104" fill="#10131a" />`;

  // Scale and center for maskable safe zone (80% circle)
  const transform = isMaskable ? `transform="translate(51.2, 51.2) scale(0.8)"` : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
    ${bg}
    <g ${transform}>
      <!-- Outer Film Reel Rim -->
      <circle cx="256" cy="256" r="180" fill="#1a2030" stroke="#f4c95d" stroke-width="16" />
      
      <!-- Film Reel Spoke Holes -->
      <circle cx="256" cy="140" r="32" fill="#10131a" stroke="#f4c95d" stroke-width="6" />
      <circle cx="366" cy="220" r="32" fill="#10131a" stroke="#f4c95d" stroke-width="6" />
      <circle cx="324" cy="350" r="32" fill="#10131a" stroke="#f4c95d" stroke-width="6" />
      <circle cx="188" cy="350" r="32" fill="#10131a" stroke="#f4c95d" stroke-width="6" />
      <circle cx="146" cy="220" r="32" fill="#10131a" stroke="#f4c95d" stroke-width="6" />
      
      <!-- Reel Center Hub -->
      <circle cx="256" cy="256" r="64" fill="#252d40" stroke="#f4c95d" stroke-width="10" />
      
      <!-- Clue Magnifying Lens / Play Accent -->
      <path d="M 235 215 L 295 256 L 235 297 Z" fill="#f4c95d" />
      <circle cx="256" cy="256" r="28" fill="none" stroke="#f6f7fb" stroke-width="4" stroke-dasharray="6 4" />
    </g>
  </svg>`;
}

async function generate() {
  const standardSvg = Buffer.from(getSvg(false));
  const maskableSvg = Buffer.from(getSvg(true));

  // 1. 512x512 Standard
  await sharp(standardSvg)
    .resize(512, 512)
    .png()
    .toFile(path.join(publicIconsDir, "icon-512.png"));

  // 2. 512x512 Maskable
  await sharp(maskableSvg)
    .resize(512, 512)
    .png()
    .toFile(path.join(publicIconsDir, "icon-512-maskable.png"));

  // 3. 192x192 Standard
  await sharp(standardSvg)
    .resize(192, 192)
    .png()
    .toFile(path.join(publicIconsDir, "icon-192.png"));

  // 4. 180x180 Apple Touch Icon
  await sharp(maskableSvg)
    .resize(180, 180)
    .png()
    .toFile(path.join(publicIconsDir, "apple-touch-icon.png"));

  console.log("PWA Icons generated successfully in public/icons/");
}

generate().catch((err) => {
  console.error("Error generating icons:", err);
  process.exit(1);
});
