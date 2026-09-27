#!/usr/bin/env node
/**
 * The home-screen icon, generated rather than drawn.
 *
 * Ballast installs from a browser — "Add to Home Screen" on iOS, "Install app"
 * on Android — which is the whole distribution strategy: no store, no review, no
 * developer programme, no ninety-nine dollars a year. An installed web app needs
 * exactly one thing the website does not, and this is it.
 *
 * Built from the app's own tokens so the icon on a phone's home screen is the
 * same object as the screen it opens. Run: `npm run icons`.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public');
const tmp = join(root, '.icons-build');

const CHROME = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
].find((p) => existsSync(p));
if (!CHROME) { console.error('\n  No Chrome found.\n'); process.exit(1); }

/** Straight from src/design/tokens.ts. */
const ink = '#14161A';
const cream = '#FFF7EC';
const mint = '#8FE0C2';

/**
 * The battery, with a face — the app's own mascot rather than a letter.
 *
 * `padded` leaves the safe margin Android's maskable icons crop into. Without it
 * a launcher that rounds icons into a circle slices the terminal off the end.
 */
const icon = (size, padded) => {
  const inset = padded ? size * 0.14 : size * 0.06;
  const w = size - inset * 2;
  const h = w * 0.62;
  const r = h * 0.28;
  const stroke = Math.max(3, size * 0.035);
  const fillW = w * 0.52;

  return `<!doctype html><meta charset="utf-8"><style>
  html,body{margin:0;padding:0}
  body{width:${size}px;height:${size}px;background:${cream};display:flex;align-items:center;justify-content:center}
</style>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect x="${inset}" y="${(size - h) / 2}" width="${w - h * 0.16}" height="${h}" rx="${r}"
        fill="#FFFFFF" stroke="${ink}" stroke-width="${stroke}"/>
  <rect x="${inset + stroke * 1.2}" y="${(size - h) / 2 + stroke * 1.2}"
        width="${fillW}" height="${h - stroke * 2.4}" rx="${r * 0.7}" fill="${mint}"/>
  <rect x="${inset + w - h * 0.16}" y="${size / 2 - h * 0.16}"
        width="${h * 0.16}" height="${h * 0.32}" rx="${h * 0.07}" fill="${ink}"/>
  <circle cx="${inset + fillW * 0.42}" cy="${size / 2 - h * 0.1}" r="${stroke * 0.62}" fill="${ink}"/>
  <circle cx="${inset + fillW * 0.78}" cy="${size / 2 - h * 0.1}" r="${stroke * 0.62}" fill="${ink}"/>
  <path d="M ${inset + fillW * 0.42} ${size / 2 + h * 0.12}
           q ${fillW * 0.18} ${h * 0.16} ${fillW * 0.36} 0"
        stroke="${ink}" stroke-width="${stroke * 0.82}" fill="none" stroke-linecap="round"/>
</svg>`;
};

rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });
mkdirSync(out, { recursive: true });

const SIZES = [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  // Android crops maskable icons into whatever shape the launcher uses.
  ['icon-maskable-512.png', 512, true],
  ['apple-touch-icon.png', 180, false],
  ['favicon.png', 48, false],
];

try {
  for (const [name, size, padded] of SIZES) {
    const html = join(tmp, `${name}.html`);
    writeFileSync(html, icon(size, padded));
    execFileSync(CHROME, [
      '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-sandbox',
      '--force-device-scale-factor=1', `--window-size=${size},${size}`,
      `--screenshot=${join(out, name)}`, `file://${html}`,
    ], { stdio: 'pipe' });
    console.log(`  ${name}  ${size}x${size}`);
  }
  console.log(`\n  ${SIZES.length} icons in public/\n`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
