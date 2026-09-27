/**
 * What leaves your phone: a reading, and some free windows.
 *
 * Both are pushed by the client rather than derived here, and that is the point.
 * The battery comes from a model that runs on the device; the windows are the
 * gaps left in a week the server never sees. All this endpoint does is store two
 * small facts and enforce who may read them.
 *
 * The visibility setting is applied **on write**, not on read. Publishing with
 * `off` deletes the rows outright rather than hiding them behind a flag, so
 * "nothing" is nothing in the database too — there is no row for a later bug to
 * reveal, and no read path that has to remember to check.
 */
import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { presenceSchema, publishSchema } from '../../../shared/contract.ts';
import { freeWindows, presence, profiles } from '../db/schema.ts';
import { makeCode } from '../lib/code.ts';
import type { Env } from '../types.ts';

/** Evening starts here, matching the client's own EVENING_FROM. */
const EVENING_FROM = 17;
/** Below this a window is not a plan, and publishing it is noise. */
const MIN_WINDOW = 1;

export const sharing = new Hono<Env>();

/**
 * Your battery, as your circle sees it.
 *
 * Sent on every meaningful change rather than on a timer: the freshness of this
 * row is the entire friends feature, and a reading that updates hourly whether
 * or not anything happened is a reading nobody can interpret.
 */
sharing.post('/presence', async (c) => {
  const db = c.get('db');
  const me = c.get('userId');

  const parsed = presenceSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'bad_request', detail: parsed.error.issues[0]?.message }, 400);
  const p = parsed.data;

  await db.insert(presence)
    .values({ userId: me, band: p.band, charge: p.charge, status: p.status, heavyForDays: p.heavyForDays, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: presence.userId,
      set: { band: p.band, charge: p.charge, status: p.status, heavyForDays: p.heavyForDays, updatedAt: new Date() },
    });

  return c.json({ ok: true });
});

/**
 * Republish the whole calendar.
 *
 * Wholesale rather than a diff, because the client recomputes these from its own
 * week every time it changes. A partial update could leave yesterday's window
 * standing after the task that filled it moved — the one failure mode here that
 * over-shares rather than under-shares.
 */
sharing.post('/publish', async (c) => {
  const db = c.get('db');
  const me = c.get('userId');

  const parsed = publishSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'bad_request', detail: parsed.error.issues[0]?.message }, 400);
  const { visibility, windows } = parsed.data;

  await db.insert(profiles).values({ userId: me, visibility, code: makeCode() })
    .onConflictDoUpdate({ target: profiles.userId, set: { visibility } });

  await db.delete(freeWindows).where(eq(freeWindows.userId, me));

  if (visibility === 'off') return c.json({ ok: true, published: 0 });

  /*
   * The level is applied here, once, on the way in.
   *
   * Trimming to the evening on the server as well as the client is deliberate
   * duplication: the client is the thing a determined user can edit, and this is
   * a promise made to their friends rather than to them.
   */
  const trimmed = windows
    .map((w) => (visibility === 'evenings' ? { ...w, start: Math.max(w.start, EVENING_FROM) } : w))
    .filter((w) => w.end - w.start >= MIN_WINDOW);

  if (trimmed.length) {
    await db.insert(freeWindows).values(trimmed.map((w, i) => ({
      id: `${me}:${w.date}:${i}`,
      userId: me,
      date: w.date,
      start: w.start,
      end: w.end,
    })));
  }

  return c.json({ ok: true, published: trimmed.length });
});
