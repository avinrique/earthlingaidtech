/**
 * One-off asset generator: rasterizes brand SVGs into the PNGs referenced by
 * the site (OG image + apple touch icon). Run with: node scripts/gen-images.mjs
 * Requires `sharp` (bundled via Astro's image pipeline).
 */
import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const pub = `${root}public/`;

/** Nested isometric cube group (brand mark), centered at (cx,cy), scaled. */
function cube(cx, cy, s) {
  const p = (pts) => pts.map(([x, y]) => `${cx + x * s},${cy + y * s}`).join(' ');
  return `
  <g stroke="#0D0D0D" stroke-width="${7 * s}" stroke-linejoin="round">
    <polygon points="${p([[0,-148],[128,-74],[0,0],[-128,-74]])}" fill="#2E2E2E"/>
    <polygon points="${p([[128,-74],[128,74],[0,148],[0,0]])}" fill="#1C1C1C"/>
    <polygon points="${p([[-128,-74],[0,0],[0,148],[-128,74]])}" fill="#111111"/>
    <polygon points="${p([[0,-92],[80,-46],[0,0],[-80,-46]])}" fill="#5E6B7A"/>
    <polygon points="${p([[80,-46],[80,46],[0,92],[0,0]])}" fill="#3C4654"/>
    <polygon points="${p([[-80,-46],[0,0],[0,92],[-80,46]])}" fill="#2A3340"/>
    <polygon points="${p([[0,-40],[35,-20],[0,0],[-35,-20]])}" fill="#7FBEFF"/>
    <polygon points="${p([[35,-20],[35,20],[0,40],[0,0]])}" fill="#4A9EFF"/>
    <polygon points="${p([[-35,-20],[0,0],[0,40],[-35,20]])}" fill="#2E7BD6"/>
  </g>`;
}

const ogSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0B0D10"/>
      <stop offset="1" stop-color="#07080A"/>
    </linearGradient>
    <radialGradient id="glow" cx="78%" cy="30%" r="55%">
      <stop offset="0" stop-color="#4A9EFF" stop-opacity="0.28"/>
      <stop offset="1" stop-color="#4A9EFF" stop-opacity="0"/>
    </radialGradient>
    <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
      <path d="M48 0H0V48" fill="none" stroke="#FFFFFF" stroke-opacity="0.045" stroke-width="1"/>
    </pattern>
  </defs>

  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#grid)"/>
  <rect width="1200" height="630" fill="url(#glow)"/>
  <rect x="0" y="0" width="1200" height="6" fill="#4A9EFF" opacity="0.9"/>

  ${cube(940, 300, 1.18)}

  <g font-family="'Space Grotesk','Inter',Arial,sans-serif">
    <text x="90" y="150" font-size="26" letter-spacing="6" fill="#8AC2FF" font-weight="600">EARTHLINGAIDTECH</text>
    <text x="86" y="300" font-size="92" fill="#F4F7FB" font-weight="700">Engineering</text>
    <text x="86" y="400" font-size="92" fill="#F4F7FB" font-weight="700">intelligence.</text>
    <text x="90" y="500" font-size="34" fill="#AEB7C4" font-weight="400">Empowering humans across AI, software &amp; hardware.</text>
    <text x="90" y="560" font-size="26" fill="#5A636F" font-family="'JetBrains Mono',monospace">earthlingaidtech.com</text>
  </g>
</svg>`;

async function main() {
  await writeFile(`${pub}og.svg`, ogSvg);
  await sharp(Buffer.from(ogSvg)).png().toFile(`${pub}og.png`);
  console.log('✓ og.png (1200×630)');

  const favicon = await import('node:fs').then((fs) => fs.promises.readFile(`${pub}favicon.svg`));
  await sharp(favicon).resize(180, 180).png().toFile(`${pub}icon-apple.png`);
  console.log('✓ icon-apple.png (180×180)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
