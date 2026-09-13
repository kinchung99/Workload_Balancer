#!/usr/bin/env node
/**
 * Records the demo halves of the video, so the narration can be rehearsed
 * against real footage instead of a stopwatch and an imagination.
 *
 * `npm run shots` photographs still screens. This drives the app — taps the
 * timetable flags, presses "Book 2 sittings for me", toggles the sharing screen
 * — and captures frames while it happens, at the exact per-beat timings in
 * docs/video/plan.html. The output is a player you open in a browser: press
 * space, read the script aloud, and find out on the spot whether you are ahead
 * or behind.
 *
 * Why this rather than a screen recorder: the timings in the plan are the whole
 * point. A human recording their own screen produces footage of some length,
 * and then the edit has to bend to it. This produces footage of *exactly* the
 * scripted length, so if the read fits the player, it fits the video.
 *
 * Three things worth knowing.
 *
 * **Chrome is driven over DevTools Protocol**, not `--screenshot`. That is the
 * only way to click anything — and it also fixes the 500px minimum window width
 * that `shots` has to crop around, because `Emulation.setDeviceMetricsOverride`
 * takes any viewport you ask for.
 *
 * **The clock is faked to 21:00.** Home's evening question is the one time-gated
 * thing in the app, and a capture run at two in the afternoon would silently
 * miss the beat that proves the ranking learns.
 *
 * **`window.open` is stubbed.** Two beats hand a message to WhatsApp, and in a
 * headless browser that would navigate away mid-capture. The button still does
 * everything else it does, so the UI still says "Opened in WhatsApp".
 */
import { execFileSync, spawn } from 'node:child_process';
import { get } from 'node:http';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, '..', 'docs', 'video', 'clips');
const build = join(root, '.clips-build');
const PORT = 8097;
const DEBUG_PORT = 9222;

/** Frames a second. Five is smooth enough to read a scroll and cheap enough to keep. */
const FPS = 5;
const WIDTH = 390;
const HEIGHT = 844;
/** Evening, so Home shows the review card. See the header. */
const FAKE_HOUR = 21;

const CHROME = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
].find((path) => existsSync(path));
if (!CHROME) {
  console.error('\n  No Chrome found. Install Google Chrome, or set CHROME= in this script.\n');
  process.exit(1);
}

/* ------------------------------------------------------------------ script */
/*
 * The eight scenes, exactly as timed in docs/video/plan.html.
 *
 * Camera scenes carry no footage - they are a card in the player holding for
 * their real length, so the whole 4:37 can be rehearsed end to end rather than
 * only the parts that happen to be screen capture.
 *
 * Every `secs` below is asserted against its parent before anything is
 * captured, so this file and the plan cannot quietly drift apart.
 */
const SCENES = [
  {
    n: 1, secs: 14, kind: 'camera', title: 'Drama — Sunday, 01:47',
    shot: 'Desk, night. Clock close-up · blank doc over-shoulder · wide of stillness.',
    say: 'First five seconds: no narration, room tone only.\n\n"It’s Sunday night. Your planner says three tasks.\n\nIt doesn’t say one of them is a presentation you’ve dreaded all week. It doesn’t know you’re the only one who hasn’t seen anybody in a fortnight."',
  },
  {
    n: 2, secs: 20, kind: 'camera', title: 'Presenter — the flaw, the idea',
    shot: 'Outdoor / plain wall, daylight. Mid-shot, eyes on the lens.',
    say: '"I’m [NAME]. Every planner ever made counts hours.\n\nBut an hour of laundry is not an hour of a group presentation. So Ballast counts hours times dread — and that one change makes four things possible.\n\nYour timetable. Your assignments. What to do first. And your friends."',
  },
  {
    n: 3, secs: 40, kind: 'demo', title: '🎓 Timetable',
    say: '"Start with the biggest thing in a student’s week — and the thing every planner makes you type by hand.\n\nPaste your timetable straight from your portal. Any format. Anything it can’t read, it hands back rather than quietly dropping.\n\nThen flag the lectures that matter more. This one gives exam tips. This one takes a register.\n\nBecause a lecture is just an hour in a box until it’s the one where the hints get given. Flag it, and nothing here will ever move it.\n\nAnd the arithmetic runs underneath: you’re on seventy-eight percent. You need eighty."',
    beats: [
      { id: 'a', secs: 10, label: 'paste the timetable', steps: [
        { do: 'goto', arg: '/timetable/import', secs: 2 },
        { do: 'type', arg: ['Paste your timetable', 'Mon 09:00-11:00 Operating Systems Kilburn LT1\nMon 11:00-12:00 Networks IT407\nTue 14:00-16:00 Algorithms lab Kilburn 2.19\nWed 10:00-11:00 Distributed Systems seminar'], secs: 5 },
        { do: 'hold', secs: 3 },
      ] },
      /*
       * Click the *grey* chips, not the lit ones.
       *
       * The seeded Operating Systems lecture already carries "Gives exam tips"
       * and "Attendance counted", so clicking those labels turned two flags off
       * and recorded the exact opposite of what the narration says. The Networks
       * tutorial has both of them unset, so tapping its short labels is the beat
       * the script actually describes: two chips lighting up.
       */
      { id: 'b', secs: 14, label: 'flag the two lectures', steps: [
        { do: 'goto', arg: '/timetable', secs: 2 },
        { do: 'scroll', arg: 620, secs: 3 },
        { do: 'click', arg: 'Tips', secs: 4 },
        { do: 'click', arg: 'Register', secs: 5 },
      ] },
      { id: 'c', secs: 10, label: 'the 78% card', steps: [
        { do: 'scroll', arg: 0, secs: 4 },
        { do: 'hold', secs: 6 },
      ] },
      { id: 'd', secs: 6, label: 'view these in my week', steps: [
        { do: 'click', arg: 'View these in my week', secs: 6 },
      ] },
    ],
  },
  {
    n: 4, secs: 45, kind: 'demo', title: '📄 Owing',
    say: '"Here’s what every to-do list gets wrong. An assignment due Thursday isn’t a task on Thursday. It’s nine hours spread across the days before Thursday.\n\nSo it sits on every single day until it’s done. It can’t hide at the bottom of a list.\n\nAnd it tracks three things, because they’re genuinely different: hours finished, hours booked, and hours still loose. Loose hours are the ones that become a Wednesday night.\n\nThen this. It books your sittings for you — two hours at a time, into gaps that actually exist. Never on top of a lecture.\n\nAnd it tells you the hours it can’t fit."',
    beats: [
      { id: 'a', secs: 10, label: 'the owing band', steps: [
        { do: 'goto', arg: '/plan', secs: 2 },
        { do: 'scrollTo', arg: 1180, secs: 5 },
        { do: 'hold', secs: 3 },
      ] },
      { id: 'b', secs: 10, label: 'done · booked · loose', steps: [
        { do: 'scrollTo', arg: 1340, secs: 4 },
        { do: 'hold', secs: 6 },
      ] },
      { id: 'c', secs: 8, label: 'open the assignment', steps: [
        { do: 'goto', arg: '/item/algo-set', secs: 3 },
        { do: 'scroll', arg: 220, secs: 5 },
      ] },
      { id: 'd', secs: 12, label: 'book 2 sittings for me', steps: [
        { do: 'click', arg: 'Book 2 sittings for me', secs: 8 },
        { do: 'scroll', arg: 420, secs: 4 },
      ] },
      { id: 'e', secs: 5, label: 'did some without booking it', steps: [
        { do: 'click', arg: '+1h', secs: 5 },
      ] },
    ],
  },
  {
    n: 5, secs: 45, kind: 'demo', title: '⭐ What to do first',
    say: '"Twelve things, no idea where to start. A list sorts by what you typed first. A calendar sorts by the clock. Neither of those is importance.\n\nSo everything goes on one scale — how close the deadline is, who you promised, and whether it can still be finished at all. And every row says why it’s there.\n\nThen the half nobody asks: what are you actually allowed to move?\n\nAnd once a day, late, it asks one question. Say your days were too full often enough, and the ranking itself changes.\n\nKeep to your plan and it asks less often. It has to earn the interruption."',
    beats: [
      { id: 'a', secs: 12, label: 'the ranked list', steps: [
        { do: 'goto', arg: '/priority', secs: 2 },
        { do: 'scrollTo', arg: 560, secs: 6 },
        { do: 'hold', secs: 4 },
      ] },
      { id: 'b', secs: 10, label: 'row one', steps: [
        { do: 'scrollTo', arg: 760, secs: 4 },
        { do: 'hold', secs: 6 },
      ] },
      { id: 'c', secs: 10, label: 'could move', steps: [
        { do: 'scrollTo', arg: 2100, secs: 6 },
        { do: 'hold', secs: 4 },
      ] },
      { id: 'd', secs: 13, label: 'the evening question', steps: [
        { do: 'goto', arg: '/', secs: 2 },
        { do: 'scroll', arg: 330, secs: 3 },
        { do: 'click', arg: 'Too full', secs: 4 },
        { do: 'goto', arg: '/priority', secs: 1 },
        { do: 'scrollTo', arg: 3000, secs: 3 },
      ] },
    ],
  },
  {
    n: 6, secs: 65, kind: 'demo', title: '👥 Friends',
    say: '"And then the one that isn’t about work at all.\n\nNobody sees their friends in week ten, because everyone assumes everyone else is busier. So nobody asks.\n\nFour people, four batteries — and how old each reading is. Jo at twenty-four percent three days ago is not the same claim as twenty-four percent this morning.\n\nOne person to check on. Ever. Aisyah has been running empty for eleven days — so it writes the message and opens WhatsApp.\n\nTap anyone and you see their week — but only the free parts. Filled blocks are time they chose to give you. Empty ones just say ‘taken’. There’s no field for what they’re doing.\n\nAnd this is your side of it. This is exactly what Ravi sees. ‘Nothing’ means nothing.\n\nThen it finds the evenings that work for everybody.\n\nFound from your contacts, matched on your phone."',
    beats: [
      { id: 'a', secs: 8, kind: 'camera', label: 'drama — the deleted message',
        shot: 'Desk, night. STUDENT A types "you free this week?" into a group chat, hovers, deletes it.' },
      { id: 'b', secs: 12, label: 'the circle', steps: [
        { do: 'goto', arg: '/friends', secs: 3 },
        { do: 'scrollTo', arg: 430, secs: 4 },
        { do: 'hold', secs: 5 },
      ] },
      { id: 'c', secs: 7, label: 'the one nudge', steps: [
        { do: 'scrollTo', arg: 180, secs: 2 },
        { do: 'click', arg: 'Send "thinking of you"', secs: 5 },
      ] },
      { id: 'd', secs: 14, label: 'a friend’s published week', steps: [
        { do: 'goto', arg: '/friend/ravi', secs: 3 },
        { do: 'scrollTo', arg: 300, secs: 5 },
        { do: 'hold', secs: 6 },
      ] },
      { id: 'e', secs: 12, label: 'what they see of you', steps: [
        { do: 'goto', arg: '/sharing', secs: 2 },
        { do: 'scrollTo', arg: 260, secs: 2 },
        { do: 'click', arg: 'Nothing. They see your battery. No times at all.', secs: 4 },
        { do: 'click', arg: 'Evenings only. Free evenings, after 5pm. Nothing daytime.', secs: 4 },
      ] },
      { id: 'f', secs: 8, label: 'three shared evenings', steps: [
        { do: 'goto', arg: '/plan-together', secs: 2 },
        { do: 'scrollTo', arg: 340, secs: 2 },
        { do: 'click', arg: 'Aisyah, heavy, 8% battery', secs: 2 },
        { do: 'click', arg: 'Aisyah, heavy, 8% battery', secs: 2 },
      ] },
      { id: 'g', secs: 4, label: 'find friends', steps: [
        { do: 'goto', arg: '/find-friends', secs: 4 },
      ] },
    ],
  },
  {
    n: 7, secs: 30, kind: 'camera', title: 'Presenter — how it gets built',
    shot: 'Laptop / desk, daylight. a) live URL + preflight green  b) the three-week graphic  c) weeks 4–8, back to presenter.',
    say: '"Everything you just saw is live today, works with no network, and passes eight hundred and eighty-one automated checks.\n\nWhat it doesn’t have is accounts. So the three weeks after finals are one thing only — a Node and Postgres API, Firebase sign-in, and local-first sync.\n\nThen weeks four to eight: the timetable feed, notifications, and friends syncing between real accounts."',
  },
  {
    n: 8, secs: 18, kind: 'camera', title: 'Presenter — the close',
    shot: 'Wall, tighter than scene 2, then cut to the desk. Last 3s is the end card in silence.',
    say: '"Every wellbeing app tells a drowning student to breathe. Ballast tells them which three things to put down — then asks when they last saw their friends.\n\nNothing else does both.\n\nBallast. The weight you carry on purpose."',
  },
];

// The plan and this file must agree, or the footage is the wrong length.
for (const scene of SCENES) {
  if (!scene.beats) continue;
  const sum = scene.beats.reduce((t, b) => t + b.secs, 0);
  if (sum !== scene.secs) throw new Error(`scene ${scene.n}: beats total ${sum}s, scene is ${scene.secs}s`);
  for (const beat of scene.beats) {
    if (!beat.steps) continue;
    const steps = beat.steps.reduce((t, s) => t + s.secs, 0);
    if (steps !== beat.secs) throw new Error(`scene ${scene.n}${beat.id}: steps total ${steps}s, beat is ${beat.secs}s`);
  }
}
const TOTAL = SCENES.reduce((t, s) => t + s.secs, 0);

/* ------------------------------------------------------- browser plumbing */

const fetchJSON = (url) => new Promise((resolve, reject) => {
  get(url, (res) => {
    let body = '';
    res.on('data', (d) => (body += d));
    res.on('end', () => { try { resolve(JSON.parse(body)); } catch (e) { reject(e); } });
  }).on('error', reject);
});

/** The smallest DevTools client that does this job. */
class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); }

  static async attach(port) {
    let targets;
    for (let i = 0; i < 60; i += 1) {
      try { targets = await fetchJSON(`http://localhost:${port}/json/list`); break; }
      catch { await new Promise((r) => setTimeout(r, 150)); }
    }
    const page = (targets ?? []).find((t) => t.type === 'page');
    if (!page) throw new Error('Chrome came up but exposed no page to drive');
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
    const cdp = new CDP(ws);
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      const waiting = cdp.pending.get(msg.id);
      if (!waiting) return;
      cdp.pending.delete(msg.id);
      msg.error ? waiting.reject(new Error(msg.error.message)) : waiting.resolve(msg.result);
    };
    return cdp;
  }

  send(method, params = {}) {
    const id = (this.id += 1);
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }

  async eval(fn, ...args) {
    const expression = `(${fn.toString()})(${args.map((a) => JSON.stringify(a)).join(',')})`;
    const { result } = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    return result.value;
  }
}

/* ---- the three functions that run inside the page ---- */

/**
 * Click something by what it says.
 *
 * React Native Web renders Pressables as plain divs with an aria-label, so the
 * label is the only stable handle - class names are generated. Matching climbs
 * from the text node to the nearest thing that owns a role, because the text is
 * usually two levels inside the control.
 */
function pageClick(label) {
  const all = Array.from(document.querySelectorAll('*'));
  const aria = (e) => (e.getAttribute && e.getAttribute('aria-label')) || '';
  const leaves = all.filter((e) => e.children.length === 0);
  /*
   * Every exact match is tried before any partial one.
   *
   * Ordering matters more than it looks. With `includes` ahead of exact text,
   * asking for "+1h" found the sitting labelled "Done · +1h" instead of the
   * chip, and the beat silently recorded five seconds of nothing happening.
   */
  let el = all.find((e) => aria(e) === label)
    || leaves.find((e) => (e.textContent || '').trim() === label)
    || all.find((e) => aria(e).includes(label))
    || leaves.find((e) => (e.textContent || '').includes(label));
  if (!el) return `MISS: ${label}`;
  let target = el;
  for (let i = 0; i < 8 && target; i += 1) {
    const role = target.getAttribute && target.getAttribute('role');
    if (role === 'button' || role === 'radio' || role === 'checkbox' || target.tagName === 'BUTTON') break;
    target = target.parentElement;
  }
  target = target || el;
  const box = target.getBoundingClientRect();
  const init = { bubbles: true, cancelable: true, clientX: box.left + box.width / 2, clientY: box.top + box.height / 2 };
  target.dispatchEvent(new PointerEvent('pointerdown', { ...init, pointerId: 1, isPrimary: true }));
  target.dispatchEvent(new MouseEvent('mousedown', init));
  target.dispatchEvent(new PointerEvent('pointerup', { ...init, pointerId: 1, isPrimary: true }));
  target.dispatchEvent(new MouseEvent('mouseup', init));
  target.dispatchEvent(new MouseEvent('click', init));
  return 'ok';
}

/** The tallest scrolling box on the page is always the screen's own list. */
function pageScroll(y) {
  const boxes = Array.from(document.querySelectorAll('div'))
    .filter((e) => e.scrollHeight > e.clientHeight + 20)
    .sort((a, b) => (b.scrollHeight - b.clientHeight) - (a.scrollHeight - a.clientHeight));
  if (boxes[0]) { boxes[0].scrollTop = y; return boxes[0].scrollTop; }
  window.scrollTo(0, y);
  return window.scrollY;
}

/** React owns the value, so setting `.value` alone is ignored on the next render. */
function pageType(label, text) {
  const el = document.querySelector(`textarea[aria-label="${label}"]`) || document.querySelector('textarea');
  if (!el) return `MISS: ${label}`;
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
  setter.call(el, text);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  return 'ok';
}

/* ------------------------------------------------------------------ record */

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
};

/*
 * Rebuilding the page without re-recording.
 *
 * The capture takes a few minutes and the player is a single HTML file; being
 * forced to redo the first to tweak the second is the sort of friction that
 * stops people fixing small things.
 */
if (process.argv.includes('--player-only')) {
  const manifest = JSON.parse(readFileSync(join(out, 'manifest.json'), 'utf8'));
  writeFileSync(join(out, 'player.html'), player(manifest));
  console.log('\n  player.html rebuilt from the existing frames.\n');
  process.exit(0);
}

const storePath = join(root, 'src/state/store.ts');
const original = readFileSync(storePath, 'utf8');
let server;
let chrome;

try {
  if (!original.includes('onboarded: false,')) throw new Error('store.ts no longer has `onboarded: false,`');
  writeFileSync(storePath, original.replace('onboarded: false,', 'onboarded: true,'));

  console.log('  exporting...');
  rmSync(build, { recursive: true, force: true });
  execFileSync('npx', ['expo', 'export', '--platform', 'web', '--output-dir', build], { cwd: root, stdio: 'pipe' });

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
    const ping = () => get({ host: 'localhost', port: PORT, path: '/' }, (res) => { res.resume(); resolve(); })
      .on('error', () => ((tries += 1) > 50 ? reject(new Error('server never came up')) : setTimeout(ping, 100)));
    ping();
  });

  console.log('  driving chrome...');
  chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-sandbox',
    '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--window-size=${WIDTH},${HEIGHT}`,
    'about:blank',
  ], { stdio: 'ignore' });

  const cdp = await CDP.attach(DEBUG_PORT);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: WIDTH, height: HEIGHT, deviceScaleFactor: 2, mobile: true,
  });
  // Pin the clock to the evening, and keep WhatsApp from navigating us away.
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `
      (() => {
        const Real = Date;
        const shift = (d) => { d.setHours(${FAKE_HOUR}, 12, 0, 0); return d; };
        function Faked(...a) { return a.length ? new Real(...a) : shift(new Real()); }
        Faked.prototype = Real.prototype;
        Faked.now = () => shift(new Real()).getTime();
        Faked.parse = Real.parse; Faked.UTC = Real.UTC;
        window.Date = Faked;
        window.open = () => null;
      })();
    `,
  });

  mkdirSync(join(out, 'frames'), { recursive: true });
  const seen = new Map();
  let written = 0;
  let bytes = 0;

  /** One frame: capture, and only write it if we have not written it already. */
  const grab = async () => {
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 68 });
    const hash = createHash('sha1').update(data).digest('hex').slice(0, 12);
    if (!seen.has(hash)) {
      const name = `f${String(seen.size).padStart(4, '0')}.jpg`;
      const buf = Buffer.from(data, 'base64');
      writeFileSync(join(out, 'frames', name), buf);
      seen.set(hash, name);
      written += 1;
      bytes += buf.length;
    }
    return seen.get(hash);
  };

  const settle = (ms) => new Promise((r) => setTimeout(r, ms));

  const manifest = { fps: FPS, width: WIDTH, height: HEIGHT, total: TOTAL, scenes: [] };
  /** The last picture recorded, so a beat can be checked against what preceded it. */
  let lastFrame = null;

  for (const scene of SCENES) {
    const entry = {
      n: scene.n, secs: scene.secs, kind: scene.kind, title: scene.title,
      say: scene.say, shot: scene.shot ?? null, beats: [],
    };
    if (scene.kind === 'camera') {
      manifest.scenes.push(entry);
      console.log(`  scene ${scene.n}  ${String(scene.secs).padStart(2)}s  camera — no footage`);
      continue;
    }

    for (const beat of scene.beats) {
      if (beat.kind === 'camera') {
        entry.beats.push({ id: beat.id, secs: beat.secs, kind: 'camera', label: beat.label, shot: beat.shot, frames: [] });
        console.log(`  scene ${scene.n}${beat.id} ${String(beat.secs).padStart(2)}s  camera — ${beat.label}`);
        continue;
      }

      const frames = [];
      for (const step of beat.steps) {
        if (step.do === 'goto') {
          await cdp.send('Page.navigate', { url: `http://localhost:${PORT}${step.arg}` });
          await settle(900);
        } else if (step.do === 'click') {
          const result = await cdp.eval(pageClick, step.arg);
          if (String(result).startsWith('MISS')) console.log(`     ! ${scene.n}${beat.id}: ${result}`);
          await settle(220);
        } else if (step.do === 'type') {
          const result = await cdp.eval(pageType, step.arg[0], step.arg[1]);
          if (String(result).startsWith('MISS')) console.log(`     ! ${scene.n}${beat.id}: ${result}`);
          await settle(220);
        }

        // Capture the step's whole duration, easing any scroll across it so the
        // movement reads as a scroll rather than a jump cut.
        const count = Math.max(1, Math.round(step.secs * FPS));
        const from = step.do === 'scrollTo' ? await cdp.eval(pageScroll, null) : null;
        for (let i = 0; i < count; i += 1) {
          if (step.do === 'scroll') {
            await cdp.eval(pageScroll, Math.round((step.arg * (i + 1)) / count));
          } else if (step.do === 'scrollTo') {
            const start = typeof from === 'number' ? from : 0;
            await cdp.eval(pageScroll, Math.round(start + ((step.arg - start) * (i + 1)) / count));
          }
          frames.push(await grab());
        }
      }
      entry.beats.push({ id: beat.id, secs: beat.secs, kind: 'demo', label: beat.label, frames });
      /*
       * A beat that clicks something and never changes a pixel is a silent
       * failure: the run still "succeeds" and the footage shows nothing.
       *
       * The test has to reach across the beat boundary. Judged within a beat
       * alone it cries wolf at every click that lands on a page which then sits
       * still - pressing "View these in my week" changes everything and then
       * holds, which is one unique frame and perfectly correct.
       */
      const unique = new Set(frames).size;
      const acts = beat.steps.some((s) => s.do === 'click' || s.do === 'type');
      const moved = unique > 1 || (lastFrame !== null && frames[0] !== lastFrame);
      const flat = acts && !moved ? '   ← CLICKED BUT NOTHING MOVED' : '';
      lastFrame = frames[frames.length - 1] ?? lastFrame;
      console.log(`  scene ${scene.n}${beat.id} ${String(beat.secs).padStart(2)}s  ${String(unique).padStart(3)} unique — ${beat.label}${flat}`);
    }
    manifest.scenes.push(entry);
  }

  writeFileSync(join(out, 'manifest.json'), JSON.stringify(manifest, null, 1));
  writeFileSync(join(out, 'player.html'), player(manifest));

  const mb = (bytes / 1024 / 1024).toFixed(1);
  console.log(`\n  ${written} unique frames, ${mb} MB`);
  console.log(`  runtime ${Math.floor(TOTAL / 60)}:${String(TOTAL % 60).padStart(2, '0')}`);
  console.log(`\n  open docs/video/clips/player.html and press space.\n`);
} finally {
  writeFileSync(storePath, original);
  chrome?.kill();
  server?.kill();
  rmSync(build, { recursive: true, force: true });
}

/* ------------------------------------------------------------------ player */

/**
 * The thing you actually use.
 *
 * A phone-shaped window playing the footage at the scripted rate, the narration
 * beside it at a readable size, and a clock that goes red the moment you are
 * behind. Camera scenes hold a card for their real length so the whole video can
 * be rehearsed, not only the demos.
 */
function player(manifest) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Ballast — rehearsal player</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #14161A; color: #F7F6F2; font: 15px/1.55 -apple-system, "Segoe UI", Roboto, sans-serif;
         display: grid; grid-template-columns: ${manifest.width + 40}px 1fr; gap: 28px; padding: 22px; min-height: 100vh; }
  .stage { position: sticky; top: 22px; align-self: start; }
  .phone { width: ${manifest.width}px; height: ${manifest.height}px; border-radius: 34px; overflow: hidden;
           border: 3px solid #3A3D42; background: #000; position: relative; }
  .phone img { width: 100%; height: 100%; display: block; object-fit: cover; }
  .card { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: center; gap: 14px;
          padding: 34px; background: #1C1F24; }
  .card .k { font-size: 11px; letter-spacing: 1.6px; text-transform: uppercase; color: #FFD37A; font-weight: 700; }
  .card h2 { margin: 0; font-size: 26px; line-height: 1.2; }
  .card p { margin: 0; color: #A8ABB2; font-size: 14px; }
  .bar { height: 6px; background: #2A2E34; border-radius: 99px; margin-top: 14px; overflow: hidden; }
  .bar i { display: block; height: 100%; background: #FFD37A; width: 0; }
  .hud { display: flex; align-items: baseline; gap: 14px; margin-top: 12px; }
  .clock { font-size: 30px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .clock.over { color: #E4607D; }
  .of { color: #6B7079; font-size: 14px; }
  .hint { color: #6B7079; font-size: 12px; margin-top: 8px; }
  button { background: #FFD37A; color: #14161A; border: 0; border-radius: 99px; padding: 9px 20px;
           font-weight: 700; font-size: 14px; cursor: pointer; }
  button.ghost { background: #2A2E34; color: #F7F6F2; }
  .controls { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
  .script { max-width: 720px; }
  .script h1 { font-size: 19px; margin: 0 0 4px; }
  .sub { color: #6B7079; font-size: 13px; margin-bottom: 18px; }
  .scene { border-left: 3px solid #2A2E34; padding: 10px 0 10px 16px; margin-bottom: 10px; cursor: pointer; opacity: .45; }
  .scene.on { opacity: 1; border-left-color: #FFD37A; }
  .scene.done { opacity: .3; }
  .scene .h { display: flex; align-items: baseline; gap: 10px; }
  .scene .t { font-weight: 700; font-size: 15px; }
  .scene .d { color: #6B7079; font-size: 12px; font-variant-numeric: tabular-nums; }
  .scene .say { white-space: pre-wrap; margin-top: 6px; font-size: 15px; line-height: 1.62; }
  .scene.on .say { font-size: 19px; line-height: 1.6; }
  .scene .shot { color: #A8ABB2; font-size: 12.5px; margin-top: 5px; font-style: italic; }
  .beats { display: flex; gap: 4px; margin-top: 8px; flex-wrap: wrap; }
  .beats b { font-weight: 600; font-size: 10.5px; padding: 2px 7px; border-radius: 99px; background: #2A2E34; color: #A8ABB2; }
  .beats b.on { background: #FFD37A; color: #14161A; }
</style></head><body>

<div class="stage">
  <div class="phone" id="phone"></div>
  <div class="bar"><i id="prog"></i></div>
  <div class="hud"><span class="clock" id="clock">0:00</span><span class="of" id="of"></span></div>
  <div class="controls">
    <button id="play">Play</button>
    <button class="ghost" id="back">&larr; Scene</button>
    <button class="ghost" id="next">Scene &rarr;</button>
    <button class="ghost" id="reset">Restart</button>
  </div>
  <p class="hint">Space play / pause &middot; &larr; &rarr; jump a scene &middot; click any scene to rehearse it alone</p>
</div>

<div class="script">
  <h1>Read this aloud while it plays</h1>
  <p class="sub">If you finish a scene before its bar does, you are too fast. If the clock turns red, the video is over five minutes.</p>
  <div id="list"></div>
</div>

<script>
const M = ${JSON.stringify(manifest)};
const LIMIT = 300;

// Flatten to one timeline of frames, one slot per 1/fps of a second.
const slots = [];
const marks = [];
for (const sc of M.scenes) {
  marks.push({ n: sc.n, at: slots.length / M.fps, secs: sc.secs });
  if (sc.kind === 'camera') {
    for (let i = 0; i < sc.secs * M.fps; i++) slots.push({ scene: sc.n, card: true });
  } else {
    for (const b of sc.beats) {
      const n = b.secs * M.fps;
      for (let i = 0; i < n; i++) {
        slots.push(b.kind === 'camera'
          ? { scene: sc.n, beat: b.id, card: true, shot: b.shot, label: b.label }
          : { scene: sc.n, beat: b.id, src: 'frames/' + (b.frames[Math.min(i, b.frames.length - 1)] || b.frames[b.frames.length - 1]) });
      }
    }
  }
}

const phone = document.getElementById('phone');
const clock = document.getElementById('clock');
const prog = document.getElementById('prog');
const of = document.getElementById('of');
const list = document.getElementById('list');

of.textContent = 'of ' + fmt(M.total);
function fmt(s) { s = Math.round(s); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }

for (const sc of M.scenes) {
  const el = document.createElement('div');
  el.className = 'scene'; el.dataset.n = sc.n;
  const beats = (sc.beats || []).filter(b => b.id).map(b => '<b data-b="' + b.id + '">' + b.id + ' &middot; ' + b.label + '</b>').join('');
  el.innerHTML = '<div class="h"><span class="t">' + sc.n + ' &middot; ' + sc.title + '</span><span class="d">' + sc.secs + 's</span></div>'
    + (sc.shot ? '<div class="shot">' + sc.shot + '</div>' : '')
    + '<div class="say">' + (sc.say || '') + '</div>'
    + (beats ? '<div class="beats">' + beats + '</div>' : '');
  el.onclick = () => { const m = marks.find(x => x.n === sc.n); seek(m.at); stop(); draw(); };
  list.appendChild(el);
}

let t = 0, timer = null;
const img = document.createElement('img');

function draw() {
  const i = Math.min(slots.length - 1, Math.floor(t * M.fps));
  const s = slots[i] || {};
  if (s.card) {
    const sc = M.scenes.find(x => x.n === s.scene);
    phone.innerHTML = '<div class="card"><div class="k">' + (s.beat ? 'Scene ' + s.scene + s.beat + ' &middot; camera' : 'Scene ' + s.scene + ' &middot; camera') + '</div>'
      + '<h2>' + (s.label || sc.title) + '</h2><p>' + (s.shot || sc.shot || '') + '</p></div>';
  } else {
    if (phone.firstChild !== img) { phone.innerHTML = ''; phone.appendChild(img); }
    if (!img.src.endsWith(s.src)) img.src = s.src;
  }
  clock.textContent = fmt(t);
  clock.className = 'clock' + (t > LIMIT ? ' over' : '');
  prog.style.width = (t / M.total * 100) + '%';
  document.querySelectorAll('.scene').forEach(el => {
    const n = +el.dataset.n;
    el.className = 'scene' + (n === s.scene ? ' on' : (n < s.scene ? ' done' : ''));
    el.querySelectorAll('.beats b').forEach(b => { b.className = (n === s.scene && b.dataset.b === s.beat) ? 'on' : ''; });
  });
  if (document.querySelector('.scene.on')) document.querySelector('.scene.on').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function step() { t += 1 / M.fps; if (t >= M.total) { t = M.total; stop(); } draw(); }
function play() { if (timer) return; if (t >= M.total) t = 0; timer = setInterval(step, 1000 / M.fps); document.getElementById('play').textContent = 'Pause'; }
function stop() { clearInterval(timer); timer = null; document.getElementById('play').textContent = 'Play'; }
function seek(x) { t = Math.max(0, Math.min(M.total, x)); draw(); }

document.getElementById('play').onclick = () => (timer ? stop() : play());
document.getElementById('reset').onclick = () => { stop(); seek(0); };
document.getElementById('next').onclick = () => { const m = marks.find(x => x.at > t + .01); seek(m ? m.at : M.total); };
document.getElementById('back').onclick = () => { const p = [...marks].reverse().find(x => x.at < t - .5); seek(p ? p.at : 0); };
addEventListener('keydown', (e) => {
  if (e.code === 'Space') { e.preventDefault(); timer ? stop() : play(); }
  if (e.code === 'ArrowRight') document.getElementById('next').click();
  if (e.code === 'ArrowLeft') document.getElementById('back').click();
});

// Warm the cache so the first play does not stutter.
[...new Set(slots.filter(s => s.src).map(s => s.src))].forEach(src => { const i = new Image(); i.src = src; });

/*
 * #t=200 opens part-way in, #scene=6 opens on a scene, #play starts it rolling.
 * Rehearsing one beat twenty times should not mean scrubbing to it twenty times.
 *
 * Read from the hash as well as the query, because this page is normally opened
 * straight off disk and Chrome will not load a file:// URL that carries a query
 * string - it looks for a file with the "?" in its name and gives you a blank
 * page instead.
 */
const q = new URLSearchParams(location.search.slice(1) + '&' + location.hash.slice(1));
if (q.has('scene')) { const m = marks.find(x => x.n === +q.get('scene')); if (m) t = m.at; }
if (q.has('t')) t = Math.max(0, Math.min(M.total, +q.get('t')));
draw();
if (q.has('play')) play();
</script>
</body></html>`;
}
