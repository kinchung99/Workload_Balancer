/**
 * The circle — the only part of this product that is between people.
 *
 * Everything else measures one student's week and could run with the network
 * off forever. This cannot: you cannot compute your friend's battery on your own
 * phone, which is exactly why it is the half that needs a server and the half
 * where a bug leaks somebody else's life.
 *
 * So every read here is filtered by an accepted friendship, checked on the
 * server, on every request. Not "the client only asks for friends" — the client
 * is not trusted to decide that.
 */
import { Hono } from 'hono';
import { and, eq, inArray } from 'drizzle-orm';
import {
  friendActionSchema, friendRequestSchema, initialsFrom,
  type CircleMemberDTO, type PendingRequestDTO,
} from '../../../shared/contract.ts';
import { freeWindows, friendships, presence, profiles, user } from '../db/schema.ts';
import { normaliseCode } from '../lib/code.ts';
import type { Env } from '../types.ts';

export const circle = new Hono<Env>();

/** Ids of everyone whose reading I am allowed to see. The gate for every read. */
async function acceptedIds(db: Env['Variables']['db'], userId: string): Promise<string[]> {
  const rows = await db
    .select({ friendId: friendships.friendId })
    .from(friendships)
    .where(and(eq(friendships.userId, userId), eq(friendships.status, 'accepted')));
  return rows.map((r) => r.friendId);
}

/**
 * Your circle, with each person's reading and published windows.
 *
 * `updatedMinsAgo` is the number the whole screen is built on: a battery nobody
 * has confirmed in three days is not the same claim as one from this morning,
 * and the app shows it greyed rather than inventing news.
 */
circle.get('/', async (c) => {
  const db = c.get('db');
  const me = c.get('userId');

  const ids = await acceptedIds(db, me);
  if (!ids.length) return c.json({ circle: [] as CircleMemberDTO[] });

  const people = await db
    .select({
      id: user.id, name: user.name,
      initials: profiles.initials, visibility: profiles.visibility,
      band: presence.band, charge: presence.charge, status: presence.status,
      heavyForDays: presence.heavyForDays, updatedAt: presence.updatedAt,
    })
    .from(user)
    .leftJoin(profiles, eq(profiles.userId, user.id))
    .leftJoin(presence, eq(presence.userId, user.id))
    .where(inArray(user.id, ids));

  const windows = await db
    .select()
    .from(freeWindows)
    .where(inArray(freeWindows.userId, ids));

  const now = Date.now();
  const out: CircleMemberDTO[] = people.map((p) => ({
    id: p.id,
    name: p.name,
    initials: p.initials ?? initialsFrom(p.name),
    band: (p.band ?? 'steady') as CircleMemberDTO['band'],
    charge: p.charge ?? null,
    status: p.status ?? null,
    heavyForDays: p.heavyForDays ?? 0,
    updatedMinsAgo: p.updatedAt ? Math.round((now - p.updatedAt.getTime()) / 60000) : null,
    /*
     * Windows are already filtered by the publisher's own setting when they were
     * written, so 'off' simply has no rows. Filtering here as well would be a
     * second place for the rule to live and a second place to get it wrong.
     */
    free: windows.filter((w) => w.userId === p.id).map((w) => ({ date: w.date, start: w.start, end: w.end })),
  }));

  return c.json({ circle: out });
});

/** Requests waiting on you, and the ones you are waiting on. */
circle.get('/requests', async (c) => {
  const db = c.get('db');
  const me = c.get('userId');

  const rows = await db
    .select({
      friendId: friendships.friendId, initiatedByMe: friendships.initiatedByMe,
      createdAt: friendships.createdAt, name: user.name, initials: profiles.initials,
    })
    .from(friendships)
    .innerJoin(user, eq(user.id, friendships.friendId))
    .leftJoin(profiles, eq(profiles.userId, user.id))
    .where(and(eq(friendships.userId, me), eq(friendships.status, 'pending')));

  const out: PendingRequestDTO[] = rows.map((r) => ({
    userId: r.friendId,
    name: r.name,
    initials: r.initials ?? initialsFrom(r.name),
    direction: r.initiatedByMe ? 'outgoing' : 'incoming',
    at: r.createdAt.toISOString(),
  }));
  return c.json({ requests: out });
});

/**
 * Ask to be in someone's circle, by email.
 *
 * The reply is the same whether or not the address exists. An endpoint that says
 * "no such user" is an endpoint that tells a stranger which of their guesses are
 * real accounts, and this one is unauthenticated against other people's data by
 * design — it has to be, to be useful.
 */
circle.post('/request', async (c) => {
  const db = c.get('db');
  const me = c.get('userId');

  const parsed = friendRequestSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'bad_request' }, 400);
  const { email, code } = parsed.data;

  /*
   * A code wins when both are given.
   *
   * It is the more deliberate of the two: an email can be guessed at, a code was
   * shown to you by the person it belongs to.
   */
  const [them] = code
    ? await db.select({ id: profiles.userId })
        .from(profiles).where(eq(profiles.code, normaliseCode(code))).limit(1)
        .then((rows) => rows.map((r) => ({ id: r.id })))
    : await db.select({ id: user.id })
        .from(user).where(eq(user.email, email!.toLowerCase())).limit(1);

  const sent = { sent: true } as const;
  if (!them || them.id === me) return c.json(sent);

  const [existing] = await db
    .select({ status: friendships.status })
    .from(friendships)
    .where(and(eq(friendships.userId, me), eq(friendships.friendId, them.id)))
    .limit(1);
  if (existing) return c.json(sent);

  /*
   * Both directions are written at once, so accepting is a status change rather
   * than an insert, and a race between two people adding each other cannot leave
   * one row without its opposite.
   */
  await db.insert(friendships).values([
    { userId: me, friendId: them.id, status: 'pending', initiatedByMe: true },
    { userId: them.id, friendId: me, status: 'pending', initiatedByMe: false },
  ]).onConflictDoNothing();

  return c.json(sent);
});

/** Accept, decline, or remove. All three are the same two-row update. */
circle.post('/respond', async (c) => {
  const db = c.get('db');
  const me = c.get('userId');

  const parsed = friendActionSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'bad_request' }, 400);
  const { userId: them, action } = parsed.data;

  const [mine] = await db
    .select({ status: friendships.status, initiatedByMe: friendships.initiatedByMe })
    .from(friendships)
    .where(and(eq(friendships.userId, me), eq(friendships.friendId, them)))
    .limit(1);
  if (!mine) return c.json({ error: 'not_found' }, 404);

  if (action === 'accept') {
    // Only the person who was asked can accept. Otherwise the asker could accept
    // on the other's behalf and add themselves to any circle they liked.
    if (mine.initiatedByMe || mine.status !== 'pending') return c.json({ error: 'not_pending' }, 409);
    await db.update(friendships).set({ status: 'accepted' })
      .where(and(eq(friendships.userId, me), eq(friendships.friendId, them)));
    await db.update(friendships).set({ status: 'accepted' })
      .where(and(eq(friendships.userId, them), eq(friendships.friendId, me)));
    return c.json({ ok: true, status: 'accepted' });
  }

  // Decline and remove are the same act from different moments: both rows go, so
  // neither side keeps a reading they are no longer allowed to see.
  await db.delete(friendships).where(and(eq(friendships.userId, me), eq(friendships.friendId, them)));
  await db.delete(friendships).where(and(eq(friendships.userId, them), eq(friendships.friendId, me)));
  return c.json({ ok: true, status: 'removed' });
});
