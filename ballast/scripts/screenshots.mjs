#!/usr/bin/env node
/**
 * Renders the app to PNGs for the README.
 *
 * Screenshots in a submission go stale the moment the UI moves, so this makes
 * them a build step rather than a chore: `npm run shots` exports the web build,
 * serves it, and photographs every screen at phone size through headless Chrome.
 *
 * Two wrinkles worth knowing about.
 *
 * Chrome will not open a window narrower than about 500px, so `--window-size=390`
 * silently gives you a 534px viewport cropped to 390 - which looks like a broken
 * layout and is not. We render wide, let `max-w-frame` hold the column at 390,
 * and crop the middle out with `sips`.
 *
 * Home redirects first-time visitors to the intro, so the export is built with
 * the intro already marked done. That edit is reverted in a `finally`.
 *
 * And the little server runs in its own process on purpose: `execFileSync` blocks
 * this one's event loop for as long as Chrome is open, so a server sharing it
 * would sit there unable to answer the page it is being asked for.
 */
import { execFileSync, spawn } from 'node:child_process';
import { get } from 'node:http';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, '..', 'docs', 'shots');
const build = join(root, '.shots-build');
const PORT = 8099;
const SCALE = 2;
const WIDE = 900;         // comfortably above Chrome's minimum window width
const FRAME = 390;        // what we keep

const CHROME = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
].find((path) => existsSync(path));

if (!CHROME) {
  console.error('\n  No Chrome found. Install Google Chrome, or set CHROME= in this script.\n');
  process.exit(1);
}

/**
 * [route, file, window height in points, crop height?, crop offset?].
 *
 * The last two are for the parts of a screen you have to scroll to: headless
 * Chrome only ever photographs the top of a page, so we open a very tall window
 * and cut the band we want out of the result.
 */
const SHOTS = [
  ['/',                       'home',       1560],
  ['/add',                    'add-what',    880],
  ['/add/takes',              'add-takes',  1120, 750, 230],
  ['/add/when',               'add-when',   1080],
  ['/priority',               'priority',   1500, 850, 1],
  ['/priority',               'priority-move', 2900, 750, 1410],
  ['/plan',                   'plan',       1000],
  ['/plan',                   'day-bands',  1700, 700, 450],
  ['/plan',                   'owing-card', 1700, 430, 1125],
  ['/rebalance',              'rebalance',  1160],
  ['/actions',                'tonight',     880],
  ['/tonight/what',           'tonight-what', 1180],
  ['/tonight/book',           'tonight-book', 940],
  ['/timetable',              'timetable',  1040, 720, 1],
  ['/timetable/modules',      'modules',     980, 650, 260],
  ['/timetable/import',       'import',      880],
  ['/areas',                  'areas',       940],
  ['/areas/social',           'social',     1280, 660, 440],
  ['/areas/mental',           'mental',     1060],
  ['/areas/errands',          'errands',     980],
  ['/areas/physical',         'physical',    980],
  ['/prescription',           'prescribe',   940],
  ['/prescription/when',      'prescribe-when', 1180],
  ['/recover',                'recover',    1040],
  ['/decline/w11-birthday',   'decline',    1040],
  ['/welcome',                'welcome',    1000],
  ['/calm',                   'calm',        880],
  ['/widget',                 'widget',      880],
];

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
};

const storePath = join(root, 'src/state/store.ts');
const original = readFileSync(storePath, 'utf8');
let server;

try {
  // 1. Build with the intro already seen, so "/" renders Home.
  if (!original.includes('onboarded: false,')) throw new Error('store.ts no longer has `onboarded: false,`');
  writeFileSync(storePath, original.replace('onboarded: false,', 'onboarded: true,'));

  console.log('  exporting...');
  rmSync(build, { recursive: true, force: true });
  execFileSync('npx', ['expo', 'export', '--platform', 'web', '--output-dir', build], { cwd: root, stdio: 'pipe' });

  // 2. Serve it with clean URLs: "/plan" -> plan.html, "/add" -> add.html.
  const serverFile = join(build, 'serve.mjs');
  writeFileSync(serverFile, `
import { createServer } from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { extname, join } from 'node:path';
const root = ${JSON.stringify(build)};
const MIME = ${JSON.stringify(MIME)};
createServer((req, res) => {
  const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
  const names = url === '/' ? ['index.html'] : [url.slice(1), url.slice(1) + '.html', join(url.slice(1), 'index.html')];
  const file = names.map((n) => join(root, n)).find((p) => existsSync(p) && extname(p));
  if (!file) return void res.writeHead(404).end('not found');
  res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
}).listen(${PORT});
`);
  server = spawn(process.execPath, [serverFile], { stdio: 'ignore' });
  await new Promise((resolve, reject) => {
    let tries = 0;
    const ping = () => get({ host: 'localhost', port: PORT, path: '/' }, (res) => {
      res.resume();
      resolve();
    }).on('error', () => (tries += 1) > 50 ? reject(new Error('server never came up')) : setTimeout(ping, 100));
    ping();
  });

  // 3. Photograph each screen, then crop the artboard out of the middle.
  mkdirSync(out, { recursive: true });
  for (const [route, name, height, cropHeight, cropOffset] of SHOTS) {
    const file = join(out, `${name}.png`);
    execFileSync(CHROME, [
      '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-sandbox',
      '--virtual-time-budget=4000',
      `--force-device-scale-factor=${SCALE}`,
      `--window-size=${WIDE},${height}`,
      `--screenshot=${file}`,
      `http://localhost:${PORT}${route}`,
    ], { stdio: 'pipe' });
    const keep = cropHeight ?? height;
    const crop = ['-c', String(keep * SCALE), String(FRAME * SCALE)];
    // Two sips quirks. The offset is (y, x) and x defaults to zero, which lands
    // on the blank margin rather than the artboard - so centre x by hand. And an
    // offset of exactly zero is read as "no offset given" and centres the crop
    // vertically too, which silently photographs the middle of a screen when you
    // asked for the top. One point from the top is close enough and unambiguous.
    if (cropOffset !== undefined) {
      crop.push('--cropOffset', String(Math.max(1, cropOffset) * SCALE), String(((WIDE - FRAME) / 2) * SCALE));
    }
    execFileSync('sips', [...crop, file, '--out', file], { stdio: 'pipe' });
    console.log(`  ${name}.png  ${FRAME}x${keep}`);
  }
  console.log(`\n  ${SHOTS.length} screenshots in docs/shots/\n`);
} finally {
  writeFileSync(storePath, original);
  server?.kill();
  rmSync(build, { recursive: true, force: true });
}
