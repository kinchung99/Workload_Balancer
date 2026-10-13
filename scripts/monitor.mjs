/**
 * The live service, checked from the outside like a person would use it.
 *
 * Run every 30 minutes by .github/workflows/monitor.yml, and by hand with
 * `node scripts/monitor.mjs`. Each probe is one thing a judge would notice
 * breaking: the API is up, the database answers, the app and the demo load
 * their current build, and a real account can sign in, read its week and see
 * its friends. Prints a table, writes a GitHub step summary when there is one,
 * and exits non-zero if anything failed so the workflow can raise an issue.
 *
 * Read-only by design: it signs in, reads, and signs out again. It never writes
 * to anyone's week, so it can run forever against the judges' accounts.
 */
import { appendFileSync } from 'node:fs';

const API = process.env.MONITOR_API ?? 'https://ballast-ckc3.vercel.app';
const APP = process.env.MONITOR_APP ?? 'https://load-balancer-ballast.expo.app';
const DEMO = process.env.MONITOR_DEMO ?? 'https://load-balancer-ballast--demo.expo.app';
const EMAIL = process.env.MONITOR_EMAIL ?? 'meiling.ballast@example.com';
// The judges' password is published in the README; a secret overrides it if one is set.
const PASSWORD = process.env.MONITOR_PASSWORD || 'BallastDemo2026';
const ORIGIN = APP;
const SLOW_MS = 5000;

const results = [];
async function probe(name, run) {
  const started = Date.now();
  try {
    const detail = await run();
    const ms = Date.now() - started;
    results.push({ name, ok: ms < SLOW_MS * 2, ms, detail: ms >= SLOW_MS ? `${detail ?? ''} (slow)`.trim() : detail ?? '' });
  } catch (err) {
    results.push({ name, ok: false, ms: Date.now() - started, detail: err instanceof Error ? err.message : String(err) });
  }
}
const expect = (cond, message) => { if (!cond) throw new Error(message); };
const timed = (url, init = {}) => fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });

await probe('API is up', async () => {
  const res = await timed(`${API}/health`);
  expect(res.status === 200, `HTTP ${res.status}`);
});

await probe('Database answers', async () => {
  const res = await timed(`${API}/health/db`);
  const body = await res.json().catch(() => ({}));
  expect(res.status === 200 && body.db === true, `HTTP ${res.status}`);
  return `${body.ms} ms query`;
});

for (const [name, url] of [['App loads', APP], ['Demo loads', DEMO]]) {
  await probe(name, async () => {
    const res = await timed(`${url}/?monitor=${Date.now()}`);
    expect(res.status === 200, `HTTP ${res.status}`);
    const entry = (await res.text()).match(/\/_expo\/static\/js\/web\/entry-[a-f0-9]+\.js/)?.[0];
    expect(entry, 'no app bundle in the page');
    const js = await timed(`${url}${entry}`, { method: 'HEAD' });
    expect(js.status === 200, `bundle HTTP ${js.status}`);
    return entry.slice(-15, -3);
  });
}

let token = null;
await probe('Sign in', async () => {
  const res = await timed(`${API}/api/auth/sign-in/email`, {
    method: 'POST', headers: { 'content-type': 'application/json', origin: ORIGIN },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  token = res.headers.get('set-auth-token');
  expect(res.status === 200 && token, `HTTP ${res.status}`);
});

const authed = (path, init = {}) => timed(`${API}${path}`, {
  ...init, headers: { 'content-type': 'application/json', origin: ORIGIN, authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
});

if (token) {
  await probe('Account', async () => {
    const res = await authed('/api/me');
    const me = await res.json();
    expect(res.status === 200 && me.email === EMAIL, `HTTP ${res.status}`);
  });
  await probe('Week syncs', async () => {
    const since = new Date(Date.now() - 60_000).toISOString();
    const res = await authed('/api/sync', { method: 'POST', body: JSON.stringify({ since, changes: [] }) });
    expect(res.status === 200 && typeof (await res.json()).now === 'string', `HTTP ${res.status}`);
  });
  await probe('Friends', async () => {
    const res = await authed('/api/circle');
    const { circle } = await res.json();
    expect(res.status === 200 && Array.isArray(circle) && circle.length > 0, `HTTP ${res.status}, ${circle?.length ?? 0} friends`);
    return `${circle.length} friends`;
  });
  await probe('Plans and groups', async () => {
    const [plans, groups] = await Promise.all([authed('/api/invites'), authed('/api/groups')]);
    expect(plans.status === 200 && groups.status === 200, `HTTP ${plans.status}/${groups.status}`);
  });
  await probe('Sign out', async () => {
    const res = await authed('/api/auth/sign-out', { method: 'POST', body: '{}' });
    expect(res.status === 200, `HTTP ${res.status}`);
  });
}

const failed = results.filter((r) => !r.ok);
const table = ['| | Check | Time | Detail |', '|---|---|---|---|',
  ...results.map((r) => `| ${r.ok ? '✅' : '❌'} | ${r.name} | ${r.ms} ms | ${r.detail.replace(/\|/g, '/')} |`)].join('\n');
console.log(table);
console.log(failed.length ? `\n${failed.length} check(s) failed.` : '\nAll checks passed.');
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Ballast live checks\n\n${table}\n\n${failed.length ? `**${failed.length} failed**` : 'All passed'} · ${new Date().toISOString()}\n`);
}
if (process.env.MONITOR_REPORT) appendFileSync(process.env.MONITOR_REPORT, table);
process.exit(failed.length ? 1 : 0);
