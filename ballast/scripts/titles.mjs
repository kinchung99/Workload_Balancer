#!/usr/bin/env node
/**
 * The title cards, at 1920x1080 — one per feature, plus the build plan.
 *
 * One card sits in front of each feature block in the video, so a viewer always
 * knows which of the four things they are being shown. They are generated rather
 * than drawn for the same reason the screenshots are: the wording comes from the
 * script, and a card that disagrees with the narration is worse than no card.
 *
 * Built from the app's own tokens — same cream, same ink, same decor hues as the
 * screen that follows each one, so the cut into the demo does not look like a cut
 * into a different product.
 *
 * Run: `npm run titles`.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, '..', 'docs', 'video', 'titles');
const tmp = join(root, '.titles-build');

const CHROME = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
].find((p) => existsSync(p));
if (!CHROME) { console.error('\n  No Chrome found.\n'); process.exit(1); }

/** Straight from src/design/tokens.ts. */
const ink = '#14161A';
const cream = '#FFF7EC';

/**
 * The glyph inside each disc, drawn rather than typed.
 *
 * Emoji were the fast option and looked it: the platform renders them in its own
 * palette, so a blue-grey 👥 landed on a mint disc and the card stopped looking
 * like this app. These are the same bold black line-art the stickers use.
 */
const GLYPH = {
  cap: `<path d="M6 26 44 12l38 14-38 14z"/><path d="M20 32v18c0 5 11 9 24 9s24-4 24-9V32"/><path d="M78 26v20"/><circle cx="78" cy="50" r="4" fill="currentColor" stroke="none"/>`,
  doc: `<path d="M22 8h30l16 16v56a4 4 0 0 1-4 4H22a4 4 0 0 1-4-4V12a4 4 0 0 1 4-4z"/><path d="M52 8v18h16"/><path d="M30 44h30M30 56h30M30 68h20"/>`,
  star: `<path d="M44 8l11 23 25 3-18 18 4 25-22-12-22 12 4-25L8 34l25-3z"/>`,
  people: `<circle cx="32" cy="28" r="13"/><path d="M10 76c0-13 10-22 22-22s22 9 22 22"/><circle cx="62" cy="32" r="10"/><path d="M58 56c10-3 24 4 24 20"/>`,
  build: `<path d="M10 74h68"/><rect x="18" y="46" width="16" height="28" rx="4" fill="currentColor" stroke="none"/><rect x="38" y="32" width="16" height="42" rx="4" fill="currentColor" stroke="none"/><rect x="58" y="18" width="16" height="56" rx="4"/>`,
};
const disc = (name) => `<svg viewBox="0 0 88 88" width="150" height="150" fill="none" stroke="${ink}" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round">${GLYPH[name]}</svg>`;

const CARDS = [
  {
    file: '1-timetable', at: '0:34', glyph: 'cap',
    kicker: 'Feature one', title: 'Timetable',
    line: 'Paste it once. Flag what actually matters.',
    wash: '#C4A9F0', tint: '#F0EAFC',
  },
  {
    file: '2-owing', at: '1:14', glyph: 'doc',
    kicker: 'Feature two', title: 'Owing',
    line: 'Not a task on Thursday. Hours owed before it.',
    wash: '#FFB3D1', tint: '#FBE9EC',
  },
  {
    file: '3-first', at: '1:59', glyph: 'star',
    kicker: 'Feature three', title: 'What to do first',
    line: 'One scale. A reason on every row.',
    wash: '#FFD37A', tint: '#FBF0DC',
  },
  {
    file: '4-friends', at: '2:44', glyph: 'people',
    kicker: 'Feature four', title: 'Friends',
    line: 'Who has room left — and when you are both free.',
    wash: '#8FE0C2', tint: '#E8F2ED',
  },
  {
    file: '5-build', at: '3:49', glyph: 'build',
    kicker: 'What happens next', title: 'The build plan',
    line: 'Three weeks to accounts and sync. Then the rest.',
    wash: '#9CCDF5', tint: '#E2F1F7',
  },
];

const card = (c) => `<!doctype html><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; }
  body { width: 1920px; height: 1080px; overflow: hidden; background: ${cream}; color: ${ink};
         font: 400 20px/1.4 -apple-system, "Segoe UI", Roboto, Helvetica, sans-serif;
         display: flex; align-items: center; justify-content: center; position: relative; }
  /* Two soft discs, the same shapes the app puts behind its headings. */
  .blob { position: absolute; border-radius: 999px; }
  .b1 { width: 940px; height: 940px; background: ${c.tint}; right: -230px; top: -320px; }
  .b2 { width: 560px; height: 560px; background: ${c.wash}; opacity: .34; left: -170px; bottom: -230px; }
  .card { position: relative; display: flex; align-items: center; gap: 92px; padding: 0 130px; }
  .disc { width: 320px; height: 320px; border-radius: 999px; background: ${c.wash};
          display: flex; align-items: center; justify-content: center;
          flex: none;
          border: 7px solid ${ink}; box-shadow: 16px 18px 0 ${ink}; }
  .kicker { font-size: 25px; font-weight: 800; letter-spacing: 6.5px; text-transform: uppercase; opacity: .58; margin-bottom: 20px; }
  h1 { font-size: 132px; line-height: .98; letter-spacing: -4.5px; font-weight: 800; }
  .rule { width: 132px; height: 11px; background: ${ink}; border-radius: 99px; margin: 34px 0 30px; }
  .line { font-size: 40px; line-height: 1.32; max-width: 830px; opacity: .82; }
  .foot { position: absolute; left: 130px; bottom: 74px; display: flex; align-items: center; gap: 20px;
          font-size: 23px; font-weight: 700; letter-spacing: 3px; text-transform: uppercase; opacity: .42; }
  .dot { width: 13px; height: 13px; border-radius: 99px; background: ${ink}; opacity: .5; }
</style>
<div class="blob b1"></div><div class="blob b2"></div>
<div class="card">
  <div class="disc">${disc(c.glyph)}</div>
  <div>
    <div class="kicker">${c.kicker}</div>
    <h1>${c.title}</h1>
    <div class="rule"></div>
    <div class="line">${c.line}</div>
  </div>
</div>
<div class="foot">Ballast<span class="dot"></span>${c.at}</div>`;

rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });
mkdirSync(out, { recursive: true });

try {
  for (const c of CARDS) {
    const html = join(tmp, `${c.file}.html`);
    writeFileSync(html, card(c));
    const png = join(out, `${c.file}.png`);
    execFileSync(CHROME, [
      '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-sandbox',
      '--force-device-scale-factor=1', '--window-size=1920,1080',
      '--default-background-color=00000000',
      `--screenshot=${png}`, `file://${html}`,
    ], { stdio: 'pipe' });
    console.log(`  ${c.file}.png  1920x1080  ${c.at}  ${c.title}`);
  }
  console.log(`\n  ${CARDS.length} title cards in docs/video/titles/\n`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
