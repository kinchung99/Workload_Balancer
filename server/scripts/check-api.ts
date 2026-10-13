/**
 * Proves the API does what it claims, the way the app's own checks do.
 *
 * The Expo side has `model:check`, `behaviour:check` and `render:check`; this is
 * the same idea for the server. It drives the **real** routes through the **real**
 * middleware against **real** Postgres — PGlite, which is Postgres compiled to
 * WebAssembly and running in this process. No Docker, no service, no mocks.
 *
 * Mocking a database is how you ship a schema that has never once been executed.
 * Everything below hits actual SQL: actual constraints, actual `jsonb`, actual
 * foreign keys, actual `ON CONFLICT`. The migrations in `drizzle/` are applied
 * first, so they are covered too.
 *
 * Run: `npm run api:check`.
 */
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../src/app.js';
import { geminiWriter, type Writer } from '../src/routes/compose.js';
import { ApiError as GeminiApiError, FinishReason, type GoogleGenAI } from '@google/genai';
import { makeAuth } from '../src/lib/auth.js';
import * as schema from '../src/db/schema.js';
import type { Database } from '../src/db/client.js';
import type { CalendarEventsResponse, CalendarStatusDTO, GroupDTO } from '../../shared/contract.js';
import { GoogleGone, type GoogleCalendarClient } from '../src/lib/google.js';
import { eq } from 'drizzle-orm';

process.env.NODE_ENV = 'test';
process.env.AUTH_SECRET = 'test-secret-at-least-32-characters-long!!';
process.env.BASE_URL = 'http://localhost';
// The default app must not reach a real model from a test run, whatever the shell has set.
delete process.env.ANTHROPIC_API_KEY;
delete process.env.GEMINI_API_KEY;

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

let failures = 0;
let checks = 0;
const check = (label: string, actual: unknown, expected: unknown) => {
  checks += 1;
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label.padEnd(58)}${ok ? '' : ` got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`}`);
};
const section = (name: string) => console.log(`\n${name}`);

/* ------------------------------------------------------------ the database */

const client = new PGlite();
const db = drizzle(client, { schema }) as unknown as Database;

/*
 * Apply the generated migrations, in order.
 *
 * Deliberately the same SQL that runs against Neon rather than a `push` from the
 * schema object: a migration that has never been executed is a deploy that fails
 * on a Friday.
 */
const migrationsDir = join(root, 'drizzle');
if (!existsSync(migrationsDir)) {
  console.error('\n  No migrations. Run `npm run db:generate` first.\n');
  process.exit(1);
}
for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()) {
  const sql = readFileSync(join(migrationsDir, file), 'utf8');
  // drizzle-kit separates statements with this marker; PGlite wants them one at a time.
  for (const statement of sql.split('--> statement-breakpoint')) {
    const trimmed = statement.trim();
    if (trimmed) await client.exec(trimmed);
  }
}

const auth = makeAuth(db);
const app = createApp(db, auth);

/* --------------------------------------------------------------- utilities */

/** One signed-in person, with their cookie jar. */
interface Person { id: string; email: string; name: string; cookie: string; }

const call = (path: string, init: RequestInit = {}, cookie?: string) =>
  app.request(`http://localhost${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {}),
      ...(init.headers ?? {}),
    },
  });

const post = (path: string, body: unknown, cookie?: string) =>
  call(path, { method: 'POST', body: JSON.stringify(body) }, cookie);

async function signUp(name: string, email: string): Promise<Person> {
  const res = await post('/api/auth/sign-up/email', { name, email, password: 'correct-horse-battery' });
  if (!res.ok) throw new Error(`sign-up failed for ${email}: ${res.status} ${await res.text()}`);
  const setCookie = res.headers.get('set-cookie') ?? '';
  const cookie = setCookie.split(',').map((c) => c.split(';')[0].trim()).join('; ');
  const me = await (await call('/api/me', {}, cookie)).json() as { id: string };
  return { id: me.id, email, name, cookie };
}

const iso = (offsetMs = 0) => new Date(Date.now() + offsetMs).toISOString();

/* =========================================================== the checks === */

console.log('\nBallast API');

section('Health and the gate');
{
  const health = await call('/health');
  check('health answers without a session', health.status, 200);
  const deep = await call('/health/db');
  check('the deep check reaches the database', [deep.status, ((await deep.json()) as { db: boolean }).db], [200, true]);

  for (const path of ['/api/me', '/api/sync', '/api/circle', '/api/sharing/presence', '/api/invites']) {
    const res = await call(path);
    check(`${path} is closed to strangers`, res.status, 401);
  }
}

section('Accounts');
const amira = await signUp('Amira Hassan', 'amira@example.edu');
const ravi = await signUp('Ravi Patel', 'ravi@example.edu');
const jo = await signUp('Jo Okafor', 'jo@example.edu');
{
  const me = await (await call('/api/me', {}, amira.cookie)).json() as Record<string, unknown>;
  check('signing up returns a usable session', me.email, 'amira@example.edu');
  check('initials are derived from the name', me.initials, 'AH');
  check('and evenings is the sharing default', me.visibility, 'evenings');

  const dupe = await post('/api/auth/sign-up/email', { name: 'Someone Else', email: 'amira@example.edu', password: 'correct-horse-battery' });
  check('the same address cannot be taken twice', dupe.ok, false);

  await post('/api/me', { phone: '60123456701' }, amira.cookie);
  const after = await (await call('/api/me', {}, amira.cookie)).json() as Record<string, unknown>;
  check('a phone number can be stored for wa.me links', after.phone, '60123456701');
}

section('Sync — push, pull, and the conflict rule');
{
  const first = await post('/api/sync', {
    since: null,
    changes: [
      { collection: 'items', id: 'algo-set', data: { title: 'Algorithms problem set', hours: 4 }, updatedAt: iso(-60_000), deleted: false },
      { collection: 'items', id: 'os-lecture', data: { title: 'Operating Systems lecture', hours: 2 }, updatedAt: iso(-60_000), deleted: false },
      { collection: 'settings', id: 'ceilings', data: { mental: 160, time: 160 }, updatedAt: iso(-60_000), deleted: false },
    ],
  }, amira.cookie);
  const body = await first.json() as { now: string; changes: Array<Record<string, unknown>>; more: boolean };
  check('a first sync returns everything it was given', body.changes.length, 3);
  check('and is not truncated', body.more, false);

  const cursor = body.now;
  const quiet = await (await post('/api/sync', { since: cursor, changes: [] }, amira.cookie)).json() as { changes: unknown[] };
  check('a pull with nothing new is empty', quiet.changes.length, 0);

  // The rule that makes offline safe: an older write must not beat a newer one.
  await post('/api/sync', { since: cursor, changes: [{ collection: 'items', id: 'algo-set', data: { title: 'Algorithms problem set', hours: 9 }, updatedAt: iso(0), deleted: false }] }, amira.cookie);
  await post('/api/sync', { since: cursor, changes: [{ collection: 'items', id: 'algo-set', data: { title: 'STALE', hours: 1 }, updatedAt: iso(-600_000), deleted: false }] }, amira.cookie);
  const merged = await (await post('/api/sync', { since: null, changes: [] }, amira.cookie)).json() as { changes: Array<{ id: string; data: { hours: number } }> };
  const algo = merged.changes.find((d) => d.id === 'algo-set')!;
  check('a stale write loses to a newer one', algo.data.hours, 9);

  const tomb = await post('/api/sync', { since: null, changes: [{ collection: 'items', id: 'os-lecture', data: {}, updatedAt: iso(0), deleted: true }] }, amira.cookie);
  const withTomb = await tomb.json() as { changes: Array<{ id: string; deleted: boolean }> };
  check('a delete comes back as a tombstone, not an absence',
    withTomb.changes.find((d) => d.id === 'os-lecture')?.deleted, true);

  const theirs = await (await post('/api/sync', { since: null, changes: [] }, ravi.cookie)).json() as { changes: unknown[] };
  check('another account sees none of it', theirs.changes.length, 0);

  const bad = await post('/api/sync', { since: null, changes: [{ collection: 'not-a-collection', id: 'x', data: {}, updatedAt: iso(), deleted: false }] }, amira.cookie);
  check('an unknown collection is refused', bad.status, 400);

  const exported = await (await call('/api/sync/export', {}, amira.cookie)).json() as { documents: unknown[] };
  check('everything can be exported in one file', exported.documents.length, 3);
}

section('The circle');
{
  const nobody = await (await call('/api/circle', {}, amira.cookie)).json() as { circle: unknown[] };
  check('a new account has an empty circle', nobody.circle.length, 0);

  const ghost = await post('/api/circle/request', { email: 'nobody@example.edu' }, amira.cookie);
  check('asking for an address that does not exist says nothing', await ghost.json(), { sent: true });

  await post('/api/circle/request', { email: ravi.email }, amira.cookie);
  const pendingForRavi = await (await call('/api/circle/requests', {}, ravi.cookie)).json() as { requests: Array<Record<string, unknown>> };
  check('the request reaches the other person', pendingForRavi.requests.length, 1);
  check('and is marked as theirs to answer', pendingForRavi.requests[0].direction, 'incoming');

  const mine = await (await call('/api/circle/requests', {}, amira.cookie)).json() as { requests: Array<Record<string, unknown>> };
  check('the asker sees it as outgoing', mine.requests[0].direction, 'outgoing');

  const stillEmpty = await (await call('/api/circle', {}, amira.cookie)).json() as { circle: unknown[] };
  check('pending is not yet in the circle', stillEmpty.circle.length, 0);

  // The asker must not be able to accept on the other person's behalf.
  const selfAccept = await post('/api/circle/respond', { userId: ravi.id, action: 'accept' }, amira.cookie);
  check('you cannot accept your own request', selfAccept.status, 409);

  await post('/api/circle/respond', { userId: amira.id, action: 'accept' }, ravi.cookie);
  const hers = await (await call('/api/circle', {}, amira.cookie)).json() as { circle: Array<Record<string, unknown>> };
  const his = await (await call('/api/circle', {}, ravi.cookie)).json() as { circle: Array<Record<string, unknown>> };
  check('accepting puts them in her circle', hers.circle.length, 1);
  check('and her in his — it is mutual', his.circle.length, 1);
  check('with a name and initials', [hers.circle[0].name, hers.circle[0].initials], ['Ravi Patel', 'RP']);
  check('no reading yet, and it says so', hers.circle[0].updatedMinsAgo, null);

  const gone = await (await call('/api/circle/requests', {}, ravi.cookie)).json() as { requests: unknown[] };
  check('the request is no longer pending', gone.requests.length, 0);
}

section('Groups, by invitation');
{
  const groupsOf = async (cookie: string) => ((await (await call('/api/groups', {}, cookie)).json()) as { groups: GroupDTO[] }).groups;
  check('groups need an account', (await call('/api/groups')).status, 401);

  // Amira and Ravi are friends by now; Jo is a stranger to her.
  const made = await (await post('/api/groups', { name: 'Study crew', emoji: '📚', invite: [ravi.id, jo.id] }, amira.cookie)).json() as { id: string; invited: number };
  check('a group is made with its maker in it', (await groupsOf(amira.cookie)).map((g) => [g.name, g.you]), [['Study crew', 'member']]);
  check('only friends can be invited', made.invited, 1);
  check('a stranger gets nothing', (await groupsOf(jo.cookie)).length, 0);

  const asked = await groupsOf(ravi.cookie);
  check('the invitation reaches the friend, saying who asked', asked.map((g) => [g.name, g.you, g.invitedBy]), [['Study crew', 'invited', 'Amira Hassan']]);
  check('and shows nobody inside until they say yes', asked[0].people.length, 0);
  check('the maker sees them as invited, not in', (await groupsOf(amira.cookie))[0].people.map((p) => [p.name, p.status]), [['Ravi Patel', 'invited']]);
  check('nobody can accept for somebody else', (await post(`/api/groups/${made.id}/respond`, { action: 'accept' }, amira.cookie)).status, 409);

  await post(`/api/groups/${made.id}/respond`, { action: 'accept' }, ravi.cookie);
  check('saying yes makes them a member', (await groupsOf(amira.cookie))[0].people.map((p) => p.status), ['member']);
  check('and they see who is in it', (await groupsOf(ravi.cookie))[0].people.map((p) => p.name), ['Amira Hassan']);

  check('a member cannot remove others', (await post(`/api/groups/${made.id}/remove`, { userId: amira.id }, ravi.cookie)).status, 403);
  check('someone outside cannot invite into it', (await post(`/api/groups/${made.id}/invite`, { userIds: [jo.id] }, jo.cookie)).status, 404);
  check('a member who did not make it cannot delete it', (await call(`/api/groups/${made.id}`, { method: 'DELETE' }, ravi.cookie)).status, 403);

  check('but anyone can leave', (await post(`/api/groups/${made.id}/remove`, { userId: ravi.id }, ravi.cookie)).status, 200);
  check('and is gone from it', (await groupsOf(ravi.cookie)).length, 0);

  await post(`/api/groups/${made.id}/invite`, { userIds: [ravi.id] }, amira.cookie);
  await post(`/api/groups/${made.id}/respond`, { action: 'decline' }, ravi.cookie);
  check('saying no leaves no trace', [(await groupsOf(ravi.cookie)).length, (await groupsOf(amira.cookie))[0].people.length], [0, 0]);

  await post(`/api/groups/${made.id}/invite`, { userIds: [ravi.id] }, amira.cookie);
  await post(`/api/groups/${made.id}/remove`, { userId: ravi.id }, amira.cookie);
  check('the maker can take an invitation back', (await groupsOf(ravi.cookie)).length, 0);

  check('the maker can delete it', (await call(`/api/groups/${made.id}`, { method: 'DELETE' }, amira.cookie)).status, 200);
  check('and it is gone for everyone', (await groupsOf(amira.cookie)).length, 0);
}

section('Guests, and friend codes');
{
  // One tap, no form. The path a judge with ninety seconds actually takes.
  const res = await post('/api/auth/sign-in/anonymous', {});
  check('a guest can sign in with no form', res.status, 200);
  const cookie = (res.headers.get('set-cookie') ?? '').split(',').map((c) => c.split(';')[0].trim()).join('; ');
  const guest = await (await call('/api/me', {}, cookie)).json() as Record<string, unknown>;

  check('and gets a real account', typeof guest.id, 'string');
  check('flagged as a guest', guest.isGuest, true);
  check('with a name a person can recognise', (guest.name as string).includes(' '), true);
  check('and initials from it', (guest.initials as string).length, 2);

  /*
   * The reason codes exist at all.
   *
   * A guest's address is `temp-9tupaer0dt8…@guest.ballast.app`. Nobody can read
   * that across a table, so email is not a usable handle for the one situation
   * this feature is for: two people standing next to each other.
   */
  check('their email is unusable as a handle', (guest.email as string).startsWith('temp-'), true);
  check('so they get a code that is sayable', (guest.code as string).length, 6);
  check('with no letters that look like digits',
    /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]+$/.test(guest.code as string), true);

  const amiraMe = await (await call('/api/me', {}, amira.cookie)).json() as { code: string };
  check('everybody has one, not only guests', amiraMe.code.length, 6);
  check('and two people never share one', amiraMe.code === guest.code, false);

  // Adding by code, which is the demo path.
  await post('/api/circle/request', { code: guest.code }, amira.cookie);
  const waiting = await (await call('/api/circle/requests', {}, cookie)).json() as { requests: unknown[] };
  check('a request by code reaches them', waiting.requests.length, 1);

  check('the code is case- and dash-insensitive', (await post(
    '/api/circle/request',
    { code: amiraMe.code.toLowerCase().slice(0, 3) + '-' + amiraMe.code.toLowerCase().slice(3) },
    cookie,
  )).status, 200);

  check('a code nobody has says nothing, like an unknown email',
    await (await post('/api/circle/request', { code: 'ZZZZZZ' }, amira.cookie)).json(), { sent: true });
  check('a request with neither handle is refused',
    (await post('/api/circle/request', {}, amira.cookie)).status, 400);
}

section('What friends can see');
{
  await post('/api/sharing/presence', { band: 'heavy', charge: 8, status: 'Two labs and a shift', heavyForDays: 11 }, ravi.cookie);
  const hers = await (await call('/api/circle', {}, amira.cookie)).json() as { circle: Array<Record<string, unknown>> };
  const r = hers.circle[0];
  check('his battery reaches her', [r.band, r.charge], ['heavy', 8]);
  check('so does the line he wrote', r.status, 'Two labs and a shift');
  check('and how long he has been empty', r.heavyForDays, 11);
  check('the reading is fresh', (r.updatedMinsAgo as number) < 2, true);

  // The privacy promise, as arithmetic: there is no field for a task. The
  // picture is the one addition, and only ever the one they chose to show.
  check('a friend row carries nothing but a reading, windows and their picture',
    Object.keys(r).sort(),
    ['band', 'charge', 'free', 'heavyForDays', 'id', 'initials', 'name', 'pic', 'status', 'updatedMinsAgo']);

  check('a stranger cannot see him at all',
    ((await (await call('/api/circle', {}, jo.cookie)).json()) as { circle: unknown[] }).circle.length, 0);

  const bad = await post('/api/sharing/presence', { band: 'sleepy', charge: 8 }, ravi.cookie);
  check('an invented band is refused', bad.status, 400);
  const overflow = await post('/api/sharing/presence', { band: 'steady', charge: 140 }, ravi.cookie);
  check('so is a charge over 100', overflow.status, 400);
}

section('Publishing a calendar');
{
  const windows = [
    { date: '2026-11-12', start: 9, end: 23 },
    { date: '2026-11-13', start: 14, end: 15.5 },
    { date: '2026-11-15', start: 12, end: 22 },
  ];

  await post('/api/sharing/publish', { visibility: 'busy', windows }, ravi.cookie);
  let seen = ((await (await call('/api/circle', {}, amira.cookie)).json()) as { circle: Array<{ free: Array<{ start: number }> }> }).circle[0].free;
  check('free/busy publishes the whole day', seen.length, 3);

  // Evenings is enforced on the server too, not only in the app that sends it.
  await post('/api/sharing/publish', { visibility: 'evenings', windows }, ravi.cookie);
  seen = ((await (await call('/api/circle', {}, amira.cookie)).json()) as { circle: Array<{ free: Array<{ start: number }> }> }).circle[0].free;
  check('evenings-only drops the daytime window', seen.length, 2);
  check('and never starts before five', seen.every((w) => w.start >= 17), true);

  await post('/api/sharing/publish', { visibility: 'off', windows }, ravi.cookie);
  seen = ((await (await call('/api/circle', {}, amira.cookie)).json()) as { circle: Array<{ free: Array<{ start: number }> }> }).circle[0].free;
  check('off publishes nothing at all', seen.length, 0);

  const rows = await db.select().from(schema.freeWindows);
  check('and leaves no row behind to leak later', rows.length, 0);

  await post('/api/sharing/publish', { visibility: 'evenings', windows }, ravi.cookie);
  check('turning it back on republishes',
    ((await (await call('/api/circle', {}, amira.cookie)).json()) as { circle: Array<{ free: unknown[] }> }).circle[0].free.length, 2);

  // Hidden from one person: they see no times, and the windows still exist for everyone else.
  const freeFor = async (cookie: string) =>
    ((await (await call('/api/circle', {}, cookie)).json()) as { circle: Array<{ free: unknown[] }> }).circle[0].free.length;
  await post('/api/sharing/publish', { visibility: 'busy', windows, hiddenFrom: [amira.id] }, ravi.cookie);
  check('a friend you hide from sees no times', await freeFor(amira.cookie), 0);
  check('while the windows themselves are still published', (await db.select().from(schema.freeWindows)).length, 3);
  await post('/api/sharing/publish', { visibility: 'busy', windows }, ravi.cookie);
  check('an older client sending no list does not unhide anyone', await freeFor(amira.cookie), 0);
  await post('/api/sharing/publish', { visibility: 'busy', windows, hiddenFrom: [] }, ravi.cookie);
  check('an empty list shows them again', await freeFor(amira.cookie), 3);
  await post('/api/sharing/publish', { visibility: 'evenings', windows, hiddenFrom: [] }, ravi.cookie);
}

section('Writing a message');
{
  const context = { kind: 'decline', subject: "Aisyah's birthday dinner", to: 'Aisyah', when: 'Thu 20 Nov', commitment: 'soft', dread: 3 };
  const unconfigured = await post('/api/compose/ideas', { context }, amira.cookie);
  check('with no key configured it says so, not 500', unconfigured.status, 503);
  check('in words the app can act on', ((await unconfigured.json()) as { error: string }).error, 'ai_not_configured');

  const seen: unknown[] = [];
  const fake: Writer = {
    ideas: async (ctx) => { seen.push(ctx); return [{ id: 'ai-0', title: 'Say no, kindly', emoji: '💛', detail: 'Keeps the friendship' }]; },
    draft: async (req) => `${req.intent.title} · ${req.tone} · ${req.length}`,
    rest: async (ctx) => {
      seen.push(ctx);
      return [{ id: 'idea-walk', title: 'Walk somewhere green', detail: 'Physical has room', emoji: '🌳', area: 'physical', minutes: 30, from: 12, to: 19, tags: ['Costs nothing'] }];
    },
    priority: async (ctx) => { seen.push(ctx); return { headline: 'Essay first, while you are fresh', picks: [{ id: ctx.tasks[0].id, why: 'Due tomorrow' }] }; },
    rebalance: async (ctx) => { seen.push(ctx); return { headline: 'Drop the shift', picks: [{ id: ctx.options[0].id, why: 'Gives back the most', take: true }] }; },
  };
  const withWriter = createApp(db, auth, fake);
  const ask = (path: string, body: unknown, cookie?: string) =>
    withWriter.request(`http://localhost${path}`, {
      method: 'POST', body: JSON.stringify(body),
      headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    });

  check('signed-out cannot spend anybody\'s model calls', (await ask('/api/compose/ideas', { context })).status, 401);

  const ideas = await ask('/api/compose/ideas', { context }, amira.cookie);
  check('ideas come back for a signed-in student', ideas.status, 200);
  check('as cards with a title and an emoji',
    ((await ideas.json()) as { ideas: Array<{ title: string; emoji: string }> }).ideas[0], { id: 'ai-0', title: 'Say no, kindly', emoji: '💛', detail: 'Keeps the friendship' });
  check('the writer sees only the fields the contract allows',
    Object.keys(seen[0] as object).sort(), ['commitment', 'dread', 'kind', 'subject', 'to', 'when']);

  const extra = await ask('/api/compose/ideas', { context: { ...context, tasks: ['OS coursework'] } }, amira.cookie);
  check('anything else sent along is dropped before the model', Object.keys(seen[1] as object).includes('tasks'), false);
  check('and the request still works', extra.status, 200);

  const draft = await ask('/api/compose/draft', { context, intent: { title: 'Say no, kindly' }, tone: 'warm' }, amira.cookie);
  check('a draft comes back in the tone asked for', ((await draft.json()) as { message: string }).message, 'Say no, kindly · warm · medium');

  check('an unknown tone is refused', (await ask('/api/compose/draft', { context, intent: { title: 'x' }, tone: 'sarcastic' }, amira.cookie)).status, 400);
  check('so is a context with no subject', (await ask('/api/compose/ideas', { context: { ...context, subject: '' } }, amira.cookie)).status, 400);

  // What might help: numbers and taps only.
  const restContext = {
    areas: { mental: 118, time: 64, physical: 22, social: 40, errands: 51 },
    charge: 47, sleepHours: 6, free: [{ start: 17, end: 23 }], vibes: ['outside', 'alone'], exclude: ['Nap, 25 minutes'],
  };
  check('recovery ideas need an account too', (await ask('/api/suggest/recovery', { context: restContext })).status, 401);
  const rest = await ask('/api/suggest/recovery', { context: restContext }, amira.cookie);
  check('recovery ideas come back for a signed-in student', rest.status, 200);
  check('as cards with an area and a length',
    ((await rest.json()) as { ideas: Array<{ area: string; minutes: number }> }).ideas.map((i) => [i.area, i.minutes]), [['physical', 30]]);
  const restSeen = seen[seen.length - 1] as Record<string, unknown>;
  check('the model sees numbers and taps, never a task', Object.keys(restSeen).sort(), ['areas', 'charge', 'exclude', 'free', 'sleepHours', 'vibes']);
  check('and what was already shown, so a refresh is new', restSeen.exclude, ['Nap, 25 minutes']);
  check('an unknown mood is refused', (await ask('/api/suggest/recovery', { context: { ...restContext, vibes: ['rave'] } }, amira.cookie)).status, 400);
  check('so is an area missing its number', (await ask('/api/suggest/recovery', { context: { ...restContext, areas: { mental: 10 } } }, amira.cookie)).status, 400);

  // The coach: what to do first, what to put down, when to rest.
  const priorityContext = {
    now: 'Tue 3pm', charge: 47, restOwed: 11,
    tasks: [{ id: 'essay', title: 'Essay draft', kind: 'owing', due: 'tomorrow', hoursLeft: 4, percentLeft: 60, dread: 4, hardness: 'hard' }],
  };
  check('what to do first needs an account', (await ask('/api/suggest/priority', { context: priorityContext })).status, 401);
  const priority = await ask('/api/suggest/priority', { context: priorityContext }, amira.cookie);
  check('what to do first comes back as a headline and picks',
    (await priority.json()), { headline: 'Essay first, while you are fresh', picks: [{ id: 'essay', why: 'Due tomorrow' }] });
  check('a task with no title is refused',
    (await ask('/api/suggest/priority', { context: { ...priorityContext, tasks: [{ ...priorityContext.tasks[0], title: '' }] } }, amira.cookie)).status, 400);
  const rebalanceContext = { charge: 22, options: [{ id: 't1', title: 'Pick up the shift', detail: 'Move it to someone else', saves: 12, day: 'Wed 12 Nov' }] };
  const rebalance = await ask('/api/suggest/rebalance', { context: rebalanceContext }, amira.cookie);
  check('what to put down comes back with a reason and a verdict',
    ((await rebalance.json()) as { picks: unknown[] }).picks, [{ id: 't1', why: 'Gives back the most', take: true }]);
  check('a swap with no names is refused',
    (await ask('/api/suggest/rebalance', { context: { ...rebalanceContext, swap: { keep: '', drop: 'x', day: 'Wed' } } }, amira.cookie)).status, 400);

  // Thirty per ten minutes, per person. Jo has made none yet.
  let last = 0;
  for (let i = 0; i < 31; i += 1) last = (await ask('/api/compose/ideas', { context }, jo.cookie)).status;
  check('the thirty-first call in ten minutes is slowed down', last, 429);
  check('without affecting anyone else', (await ask('/api/compose/ideas', { context }, ravi.cookie)).status, 200);
}

section('Gemini, through Google AI Studio');
{
  const context = { kind: 'decline', subject: "Aisyah's birthday dinner", to: 'Aisyah', when: 'Thu 20 Nov', commitment: 'soft', dread: 3 };
  const calls: Array<Record<string, any>> = [];
  let reply: () => unknown = () => ({ text: JSON.stringify({ message: 'Hey, I can’t make it tonight - next week?' }), candidates: [{ finishReason: FinishReason.STOP }] });
  const fakeGemini = { models: { generateContent: async (req: Record<string, any>) => { calls.push(req); return reply(); } } } as unknown as GoogleGenAI;
  const gemini = createApp(db, auth, geminiWriter(fakeGemini, 'gemini-test'));
  const ask = (path: string, body: unknown) =>
    gemini.request(`http://localhost${path}`, {
      method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json', cookie: ravi.cookie },
    });

  const draft = await ask('/api/compose/draft', { context, intent: { title: 'Say no, kindly' }, tone: 'warm' });
  check('a Gemini draft comes back like any other', ((await draft.json()) as { message: string }).message, 'Hey, I can’t make it tonight - next week?');
  check('on the model configured', calls[0].model, 'gemini-test');
  check('with the same rules as Claude', String(calls[0].config.systemInstruction).startsWith('You help a stressed university student'), true);
  check('asking for JSON back', calls[0].config.responseMimeType, 'application/json');
  check('in the draft\'s shape', calls[0].config.responseJsonSchema, { type: 'object', properties: { message: { type: 'string' } }, required: ['message'] });

  reply = () => ({ text: JSON.stringify({ ideas: [{ title: 'Walk by the river', emoji: '🌳', detail: 'Physical has room', area: 'physical', minutes: 30, from: 12, to: 19, tags: ['Costs nothing'] }] }) });
  const rest = await ask('/api/suggest/recovery', { context: { areas: { mental: 118, time: 64, physical: 22, social: 40, errands: 51 }, charge: 47, vibes: [], exclude: [] } });
  check('recovery ideas parse from Gemini too', ((await rest.json()) as { ideas: Array<{ area: string }> }).ideas.map((i) => i.area), ['physical']);

  // The order is the phone's; the model only explains it.
  reply = () => ({ text: JSON.stringify({ headline: 'Essay, then the labs', picks: [
    { id: 'made-up', why: 'Invented' }, { id: 'labs', why: 'Due Thursday.' }, { id: 'essay', why: 'Due tomorrow' }, { id: 'essay', why: 'Twice' },
  ] }) });
  const tasks = ['essay', 'labs'].map((id) => ({ id, title: id, kind: 'owing', hoursLeft: 3, dread: 3, hardness: 'hard' }));
  const advice = (await (await ask('/api/suggest/priority', { context: { now: 'Tue 3pm', charge: 40, tasks } })).json()) as { picks: Array<{ id: string; why: string }> };
  check('a reason naming nothing on the list is dropped, and repeats too', advice.picks.map((p) => p.id).sort(), ['essay', 'labs']);
  check('and the reasons come back in the phone\'s order, not the model\'s', advice.picks.map((p) => p.id), ['essay', 'labs']);
  check('short, with no full stop', advice.picks[1].why, 'Due Thursday');

  reply = () => ({ text: JSON.stringify({ headline: 'Lighter', swap: 'You wanted the seminar more.', picks: [
    { id: 'locked', why: 'x', take: true }, { id: 'open', why: 'Frees Wednesday evening', take: true }, { id: 'keep', why: 'Cheap to keep', take: false },
  ] }) });
  const options = [
    { id: 'locked', title: 'Presentation', detail: 'Hard deadline', saves: 9, day: 'Thu', locked: true },
    { id: 'open', title: 'Extra shift', detail: 'Swap it', saves: 6, day: 'Wed' },
    { id: 'keep', title: 'Gym', detail: 'Move it', saves: 1, day: 'Fri' },
  ];
  const trade = (await (await ask('/api/suggest/rebalance', { context: { charge: 20, options } })).json()) as { picks: Array<{ id: string; take: boolean }>; swap?: string };
  check('every trade gets a reason', trade.picks.map((p) => p.id), ['locked', 'open', 'keep']);
  check('a locked trade is never taken, whatever the model says', trade.picks.map((p) => p.take), [false, true, false]);
  check('no swap was asked about, so none is answered', trade.swap, undefined);
  const withSwap = (await (await ask('/api/suggest/rebalance', { context: { charge: 20, options, swap: { keep: 'Seminar', drop: 'Shift', day: 'Wed' } } })).json()) as { swap?: string };
  check('a swap gets its one line', withSwap.swap, 'You wanted the seminar more');

  reply = () => ({ text: undefined, candidates: [{ finishReason: FinishReason.SAFETY }] });
  check('a blocked answer is a decline the app can draft around', (await ask('/api/compose/ideas', { context })).status, 422);
  reply = () => ({ text: 'not json at all' });
  check('so is an answer that is not the shape asked for', (await ask('/api/compose/ideas', { context })).status, 422);
  reply = () => { throw new GeminiApiError({ message: 'Resource exhausted', status: 429 }); };
  const busy = await ask('/api/compose/ideas', { context });
  check('a used-up free tier reads as busy, not broken', [busy.status, ((await busy.json()) as { error: string }).error], [503, 'busy']);
  reply = () => { throw new GeminiApiError({ message: 'Bad key', status: 400 }); };
  check('and any other Gemini failure as unavailable', (await ask('/api/compose/ideas', { context })).status, 502);
}

section('Gatherings');
{
  const outsider = await post('/api/invites', { title: 'Dinner', date: '2026-11-12', startHour: 19, hours: 2, people: [jo.id] }, amira.cookie);
  check('you cannot invite someone outside your circle', outsider.status, 403);

  const made = await post('/api/invites', { title: 'Dinner with Ravi', date: '2026-11-12', startHour: 19, hours: 2, people: [ravi.id] }, amira.cookie);
  check('a friend can be invited', made.status, 201);
  const { id } = await made.json() as { id: string };

  const his = await (await call('/api/invites', {}, ravi.cookie)).json() as { invites: Array<Record<string, unknown>> };
  check('it appears in his list', his.invites.length, 1);
  check('marked as not his', his.invites[0].fromMe, false);
  check('with the host named', (his.invites[0].host as { name: string }).name, 'Amira Hassan');

  const uninvited = await post('/api/invites/respond', { inviteId: id, response: 'yes' }, jo.cookie);
  check('somebody who was not asked cannot answer', uninvited.status, 404);

  await post('/api/invites/respond', { inviteId: id, response: 'yes' }, ravi.cookie);
  const hers = await (await call('/api/invites', {}, amira.cookie)).json() as { invites: Array<{ guests: Array<{ response: string }> }> };
  check('his answer reaches the host', hers.invites[0].guests[0].response, 'yes');

  const notHost = await call(`/api/invites/${id}`, { method: 'DELETE' }, ravi.cookie);
  check('a guest cannot call off the host\'s gathering', notHost.status, 403);

  const cancelled = await call(`/api/invites/${id}`, { method: 'DELETE' }, amira.cookie);
  check('the host can', cancelled.status, 200);
  check('and it is gone for everyone',
    ((await (await call('/api/invites', {}, ravi.cookie)).json()) as { invites: unknown[] }).invites.length, 0);
}

section('Your picture, seen by your friends');
{
  const tiny = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';
  const ok = await post('/api/me', { pic: tiny }, amira.cookie);
  check('a small photo can be your picture', ok.status, 200);
  check('and it comes back on any device', ((await (await call('/api/me', {}, amira.cookie)).json()) as { pic: string }).pic, tiny);
  check('an emoji works too', (await post('/api/me', { pic: '🦊' }, amira.cookie)).status, 200);
  check('a link to somewhere else does not', (await post('/api/me', { pic: 'https://evil.example/x.png' }, amira.cookie)).status, 400);
  check('nor does anything enormous', (await post('/api/me', { pic: `data:image/jpeg;base64,${'A'.repeat(130_000)}` }, amira.cookie)).status, 400);
  await post('/api/me', { pic: tiny }, amira.cookie);
  // Ravi and Amira are friends until "Leaving", further down.
  const theirs = (await (await call('/api/circle', {}, ravi.cookie)).json()) as { circle: Array<{ id: string; pic: string | null }> };
  check('her friends see it in their circle', theirs.circle.find((p) => p.id === amira.id)?.pic, tiny);
}

section('Leaving');
{
  await post('/api/circle/respond', { userId: ravi.id, action: 'remove' }, amira.cookie);
  check('removing empties her circle',
    ((await (await call('/api/circle', {}, amira.cookie)).json()) as { circle: unknown[] }).circle.length, 0);
  check('and his, in the same act',
    ((await (await call('/api/circle', {}, ravi.cookie)).json()) as { circle: unknown[] }).circle.length, 0);

  // The point of removal: his reading stops being visible immediately, rather
  // than at the end of some cached session.
  await post('/api/sharing/presence', { band: 'steady', charge: 71 }, ravi.cookie);
  check('his new reading does not reach her either',
    ((await (await call('/api/circle', {}, amira.cookie)).json()) as { circle: unknown[] }).circle.length, 0);
}

section('Signed in without cookies (iPhone Safari, the phone app)');
{
  const email = `bearer-${Date.now()}@example.edu`;
  const made = await post('/api/auth/sign-up/email', { name: 'Bea Bearer', email, password: 'first-password-1' });
  const token = made.headers.get('set-auth-token') ?? '';
  check('signing up hands back a session token', token.length > 10, true);
  const bearerCall = (path: string, init: RequestInit = {}, t = token) =>
    app.request(`http://localhost${path}`, { ...init, headers: { 'content-type': 'application/json', authorization: `Bearer ${t}`, ...(init.headers ?? {}) } });
  const me = await bearerCall('/api/me');
  check('the token alone is enough to be signed in', me.status, 200);
  check('as the right person', ((await me.json()) as { email: string }).email, email);
  check('a made-up token is not', (await bearerCall('/api/me', {}, 'not-a-real-token')).status, 401);
  const exposed = await app.request('http://localhost/health', { headers: { origin: 'https://load-balancer-ballast.expo.app' } });
  check('browsers are allowed to read the token header', (exposed.headers.get('access-control-expose-headers') ?? '').toLowerCase().includes('set-auth-token'), true);

  const wrong = await bearerCall('/api/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword: 'not-it-at-all', newPassword: 'second-password-2' }) });
  check('changing the password needs the current one', wrong.status >= 400, true);
  const changed = await bearerCall('/api/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword: 'first-password-1', newPassword: 'second-password-2', revokeOtherSessions: true }) });
  check('with it, the password changes', changed.status, 200);
  const fresh = changed.headers.get('set-auth-token');
  check('and this device gets a fresh token', !!fresh && fresh !== token, true);
  check('which still works', (await bearerCall('/api/me', {}, fresh ?? '')).status, 200);
  check('while the old session is signed out', (await bearerCall('/api/me')).status, 401);
  check('the old password no longer signs in', (await post('/api/auth/sign-in/email', { email, password: 'first-password-1' })).status >= 400, true);
  check('the new one does', (await post('/api/auth/sign-in/email', { email, password: 'second-password-2' })).status, 200);
}

section('Google Calendar, read-only');
{
  const off = (await (await call('/api/calendar', {}, amira.cookie)).json()) as CalendarStatusDTO;
  check('without Google keys the app is told there is nothing to connect', off.available, false);
  check('and asking to connect says so', (await post('/api/calendar/connect', { returnTo: 'http://localhost:8081/calendar' }, amira.cookie)).status, 503);

  let gone = false;
  let exchanged = 0;
  const revoked: string[] = [];
  const timed = (day: number, hour: number) => `2026-11-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00:00+08:00`;
  const fakeGoogle: GoogleCalendarClient = {
    authUrl: (state, redirect) => `https://accounts.example/auth?state=${encodeURIComponent(state)}&redirect=${encodeURIComponent(redirect)}`,
    exchange: async (code) => {
      exchanged += 1;
      return code === 'good' ? { refreshToken: 'rt-amira', email: 'amira@gmail.com' } : { refreshToken: null, email: null };
    },
    access: async (token) => {
      if (gone) throw new GoogleGone();
      if (token !== 'rt-amira') throw new Error('wrong token');
      return 'at-1';
    },
    calendars: async () => [
      { id: 'primary-id', name: 'amira@gmail.com', color: '#4285f4', primary: true, selected: true },
      { id: 'uni-timetable', name: 'Uni timetable', color: '#0b8043', primary: false, selected: true },
      { id: 'en.malaysia#holiday@group.v.calendar.google.com', name: 'Holidays', color: null, primary: false, selected: true },
      { id: 'old-club', name: 'Old club', color: null, primary: false, selected: false },
    ],
    events: async (_access, calendarId) => {
      if (calendarId === 'uni-timetable') {
        return [
          { id: 'os_1', summary: 'CS2040 Lecture', start: { dateTime: timed(9, 9) }, end: { dateTime: timed(9, 11) }, recurringEventId: 'os', location: 'LT7' },
          { id: 'os_2', summary: 'CS2040 Lecture', start: { dateTime: timed(16, 9) }, end: { dateTime: timed(16, 11) }, recurringEventId: 'os', location: 'LT7' },
        ];
      }
      if (calendarId === 'primary-id') {
        return [
          { id: 'essay', summary: 'Ethics essay due', start: { date: '2026-11-12' }, end: { date: '2026-11-13' } },
          { id: 'trip', summary: 'Reading week trip', start: { date: '2026-11-14' }, end: { date: '2026-11-18' } },
          { id: 'gone', status: 'cancelled', summary: 'Called off', start: { dateTime: timed(10, 19) }, end: { dateTime: timed(10, 21) } },
          { id: 'no', summary: 'Party', start: { dateTime: timed(11, 20) }, end: { dateTime: timed(11, 23) }, attendees: [{ self: true, responseStatus: 'declined' }] },
          { id: 'ooo', summary: 'Out of office', eventType: 'outOfOffice', start: { dateTime: timed(13, 9) }, end: { dateTime: timed(13, 17) } },
        ];
      }
      return [{ id: 'hol', summary: 'Deepavali', start: { date: '2026-11-08' }, end: { date: '2026-11-09' } }];
    },
    revoke: async (token) => { revoked.push(token); },
  };
  const withGoogle = createApp(db, auth, null, fakeGoogle);
  const gcall = (path: string, init: RequestInit = {}, cookie?: string) =>
    withGoogle.request(`http://localhost${path}`, { ...init, headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) } });
  const gpost = (path: string, body: unknown, cookie?: string) => gcall(path, { method: 'POST', body: JSON.stringify(body) }, cookie);
  const home = 'http://localhost:8081/calendar';
  const stateOf = (url: string) => encodeURIComponent(new URL(url).searchParams.get('state') ?? '');

  check('connecting needs you signed in', (await gpost('/api/calendar/connect', { returnTo: home })).status, 401);
  check('the installed app can be sent back to (ballast://)', (await gpost('/api/calendar/connect', { returnTo: 'ballast://calendar' }, amira.cookie)).status, 200);
  check('it will not send you on to somebody else\'s site', (await gpost('/api/calendar/connect', { returnTo: 'https://evil.example/calendar' }, amira.cookie)).status, 400);
  const link = (await (await gpost('/api/calendar/connect', { returnTo: home }, amira.cookie)).json()) as { url: string };
  check('Google is told to come back to the API', new URL(link.url).searchParams.get('redirect'), 'http://localhost/api/calendar/callback');

  const state = new URL(link.url).searchParams.get('state') ?? '';
  const forged = `${state.slice(0, -3)}${state.endsWith('AAA') ? 'BBB' : 'AAA'}`;
  check('a forged state is refused', (await gcall(`/api/calendar/callback?code=good&state=${encodeURIComponent(forged)}`)).status, 400);
  check('and nothing is exchanged for it', exchanged, 0);

  const denied = await gcall(`/api/calendar/callback?error=access_denied&state=${stateOf(link.url)}`);
  check('saying no on Google comes back as cancelled', denied.headers.get('location'), `${home}?calendar=cancelled`);

  const back = await gcall(`/api/calendar/callback?code=good&state=${stateOf(link.url)}`);
  check('saying yes comes back into the app', [back.status, back.headers.get('location')], [302, `${home}?calendar=connected`]);
  const [stored] = await db.select().from(schema.calendarLinks).where(eq(schema.calendarLinks.userId, amira.id));
  check('the refresh token is sealed at rest', [stored?.refreshToken.includes('rt-amira'), stored?.refreshToken.startsWith('v1.')], [false, true]);

  const status = (await (await gcall('/api/calendar', {}, amira.cookie)).json()) as CalendarStatusDTO;
  check('connected, as her Google account', [status.connected, status.email], [true, 'amira@gmail.com']);
  check('nobody else sees her connection', ((await (await gcall('/api/calendar', {}, jo.cookie)).json()) as CalendarStatusDTO).connected, false);
  check('and nobody else can read her events', (await gcall('/api/calendar/events', {}, jo.cookie)).status, 404);

  const read = (await (await gcall('/api/calendar/events', {}, amira.cookie)).json()) as CalendarEventsResponse;
  check('her main calendar and timetable are read; holidays and hidden ones are not',
    read.calendars.filter((cal) => cal.on).map((cal) => cal.name), ['Main calendar', 'Uni timetable']);
  check('cancelled, declined, out-of-office and multi-day events stay out',
    read.events.map((e) => e.title), ['CS2040 Lecture', 'Ethics essay due', 'CS2040 Lecture']);
  check('every week of a class shares one series', new Set(read.events.map((e) => e.seriesId).filter(Boolean)).size, 1);
  check('an all-day event says so', read.events.find((e) => e.title === 'Ethics essay due')?.allDay, true);
  check('and the room comes along', read.events[0]?.location, 'LT7');
  check('the sync time is kept', typeof ((await (await gcall('/api/calendar', {}, amira.cookie)).json()) as CalendarStatusDTO).lastSyncedAt, 'string');

  await gpost('/api/calendar/calendars', { on: ['uni-timetable'] }, amira.cookie);
  const fewer = (await (await gcall('/api/calendar/events', {}, amira.cookie)).json()) as CalendarEventsResponse;
  check('switching a calendar off stops reading it', fewer.events.map((e) => e.title), ['CS2040 Lecture', 'CS2040 Lecture']);

  gone = true;
  check('a connection Google dropped asks for a reconnect', (await gcall('/api/calendar/events', {}, amira.cookie)).status, 409);
  check('and the status says so', ((await (await gcall('/api/calendar', {}, amira.cookie)).json()) as CalendarStatusDTO).status, 'expired');

  gone = false;
  const again = (await (await gpost('/api/calendar/connect', { returnTo: home }, amira.cookie)).json()) as { url: string };
  await gcall(`/api/calendar/callback?code=good&state=${stateOf(again.url)}`);
  const restored = (await (await gcall('/api/calendar/events', {}, amira.cookie)).json()) as CalendarEventsResponse;
  check('connecting again brings it back, with her choice of calendars', restored.events.length, 2);

  const dropped = await gcall('/api/calendar', { method: 'DELETE' }, amira.cookie);
  check('disconnecting tells Google to forget the token', [dropped.status, revoked], [200, ['rt-amira']]);
  check('and forgets it here', (await db.select().from(schema.calendarLinks).where(eq(schema.calendarLinks.userId, amira.id))).length, 0);
}

section('From the app, the session is a token, not a cookie');
{
  const res = await call('/api/auth/sign-in/email', {
    method: 'POST',
    headers: { origin: 'https://load-balancer-ballast.expo.app' },
    body: JSON.stringify({ email: 'amira@example.edu', password: 'correct-horse-battery' }),
  });
  check('signing in from the app hands over a token', [res.status, !!res.headers.get('set-auth-token')], [200, true]);
  check('and no third-party cookie', res.headers.get('set-cookie'), null);
  const token = res.headers.get('set-auth-token');
  check('the token alone is a session', (await call('/api/me', { headers: { authorization: `Bearer ${token}` } })).status, 200);
}

section('The app reports its own errors');
{
  const crash = { kind: 'crash', message: 'TypeError: x is undefined', path: '/plans', build: 'test' };
  check('a crash report is taken without a session', (await post('/api/report', crash)).status, 204);
  check('one with no message is refused', (await post('/api/report', { kind: 'crash' })).status, 400);
  check('and a novel is refused', (await post('/api/report', { ...crash, message: 'x'.repeat(501) })).status, 400);
  let last = 204;
  for (let i = 0; i < 25; i += 1) last = (await call('/api/report', { method: 'POST', body: JSON.stringify(crash), headers: { 'x-forwarded-for': '203.0.113.9' } })).status;
  check('a crash loop is slowed down, per address', last, 429);
  check('without slowing anyone else', (await call('/api/report', { method: 'POST', body: JSON.stringify(crash), headers: { 'x-forwarded-for': '203.0.113.10' } })).status, 204);
}

section('The deployment routes every path to the function');
{
  /*
   * A guard against the failure that cost the most time.
   *
   * `vercel.json` decides which requests reach this code at all, and a mistake
   * there is invisible to every other check in this file: the app answered
   * `/health` perfectly while Vercel returned its own 404 for every `/api/*`
   * route, because a rewrite excluded them. The tests all passed. Nothing
   * worked.
   */
  const config = JSON.parse(readFileSync(join(root, '..', 'vercel.json'), 'utf8')) as {
    rewrites: Array<{ source: string; destination: string }>;
  };

  const reaches = (path: string): boolean =>
    config.rewrites.some((r) => new RegExp(`^${r.source}$`).test(path));

  for (const path of [
    '/', '/health', '/health/db', '/api/report',
    '/api/auth/sign-up/email', '/api/auth/sign-in/anonymous', '/api/auth/sign-out',
    '/api/me', '/api/sync', '/api/circle', '/api/circle/request',
    '/api/sharing/presence', '/api/invites', '/api/compose/ideas', '/api/compose/draft', '/api/calendar/callback', '/api/suggest/recovery',
  ]) {
    check(`${path} reaches the function`, reaches(path), true);
  }

  check('and they all land on the one entry point',
    [...new Set(config.rewrites.map((r) => r.destination))], ['/api/index']);

  /*
   * Vercel validates this file against a schema and refuses unknown keys.
   * A `"//"` comment is the obvious way to explain a config decision and it
   * fails the build with `should NOT have additional property '//'` - a minute
   * of deploy time to learn something a local check can say instantly.
   */
  const ALLOWED = new Set([
    '$schema', 'buildCommand', 'cleanUrls', 'crons', 'devCommand', 'framework',
    'functions', 'headers', 'ignoreCommand', 'images', 'installCommand',
    'outputDirectory', 'public', 'redirects', 'regions', 'rewrites',
    'trailingSlash', 'git', 'env', 'build',
  ]);
  const raw = JSON.parse(readFileSync(join(root, '..', 'vercel.json'), 'utf8')) as Record<string, unknown>;
  check('vercel.json has no keys the schema would reject',
    Object.keys(raw).filter((k) => !ALLOWED.has(k)), []);
}

/* ------------------------------------------------------------------ result */

console.log(`\n  ${checks} checks`);
if (failures) {
  console.error(`\n  ${failures} did not hold.\n`);
  process.exit(1);
}
console.log('\n  the api does what it says.\n');
await client.close();
