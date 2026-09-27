/**
 * Gatherings.
 *
 * The one write in this app that lands in somebody else's week, so it is the one
 * that has to check a relationship before it writes: you may only invite people
 * whose circle you are actually in, verified here rather than assumed from the
 * fact that the client only offered you friends.
 *
 * Ballast still has no inbox. An invite creates a row and the app hands the words
 * to WhatsApp — this exists so that a gathering has one shared record of who was
 * asked and who said yes, not so people have a fourth place to check messages.
 */
import { Hono } from 'hono';
import { and, eq, gte, inArray, or } from 'drizzle-orm';
import { inviteReplySchema, inviteSchema, type InviteDTO } from '../../../shared/contract';
import { friendships, inviteGuests, invites as invitesTable, user } from '../db/schema';
import type { Env } from '../types';

export const invites = new Hono<Env>();

/** Everything still ahead of you, hosted or received. */
invites.get('/', async (c) => {
  const db = c.get('db');
  const me = c.get('userId');
  const today = new Date().toISOString().slice(0, 10);

  const mine = await db
    .select({ id: invitesTable.id })
    .from(invitesTable)
    .leftJoin(inviteGuests, eq(inviteGuests.inviteId, invitesTable.id))
    .where(and(
      gte(invitesTable.date, today),
      or(eq(invitesTable.hostId, me), eq(inviteGuests.userId, me)),
    ));

  const ids = [...new Set(mine.map((r) => r.id))];
  if (!ids.length) return c.json({ invites: [] as InviteDTO[] });

  const rows = await db
    .select({
      id: invitesTable.id, title: invitesTable.title, date: invitesTable.date,
      startHour: invitesTable.startHour, hours: invitesTable.hours,
      hostId: invitesTable.hostId, hostName: user.name,
    })
    .from(invitesTable)
    .innerJoin(user, eq(user.id, invitesTable.hostId))
    .where(inArray(invitesTable.id, ids));

  const guests = await db
    .select({ inviteId: inviteGuests.inviteId, userId: inviteGuests.userId, response: inviteGuests.response, name: user.name })
    .from(inviteGuests)
    .innerJoin(user, eq(user.id, inviteGuests.userId))
    .where(inArray(inviteGuests.inviteId, ids));

  const out: InviteDTO[] = rows.map((r) => ({
    id: r.id, title: r.title, date: r.date, startHour: r.startHour, hours: r.hours,
    fromMe: r.hostId === me,
    host: { id: r.hostId, name: r.hostName },
    guests: guests.filter((g) => g.inviteId === r.id)
      .map((g) => ({ id: g.userId, name: g.name, response: g.response as 'pending' | 'yes' | 'no' })),
  }));

  return c.json({ invites: out.sort((a, b) => a.date.localeCompare(b.date) || a.startHour - b.startHour) });
});

invites.post('/', async (c) => {
  const db = c.get('db');
  const me = c.get('userId');

  const parsed = inviteSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'bad_request', detail: parsed.error.issues[0]?.message }, 400);
  const { title, date, startHour, hours, people } = parsed.data;

  /*
   * The check that matters: every guest must already be in my circle.
   *
   * Without it this endpoint is a way to write a row into a stranger's week by
   * guessing a user id, which is both a nuisance vector and the exact thing the
   * friends model promises cannot happen.
   */
  const allowed = await db
    .select({ friendId: friendships.friendId })
    .from(friendships)
    .where(and(
      eq(friendships.userId, me),
      eq(friendships.status, 'accepted'),
      inArray(friendships.friendId, people),
    ));

  if (allowed.length !== people.length) {
    return c.json({ error: 'not_in_circle', detail: 'You can only invite people in your circle.' }, 403);
  }

  const id = `inv-${crypto.randomUUID()}`;
  await db.insert(invitesTable).values({ id, hostId: me, title, date, startHour, hours });
  await db.insert(inviteGuests).values(people.map((userId) => ({ inviteId: id, userId, response: 'pending' as const })));

  return c.json({ ok: true, id }, 201);
});

/** Yes or no. Only a guest of that gathering may answer it. */
invites.post('/respond', async (c) => {
  const db = c.get('db');
  const me = c.get('userId');

  const parsed = inviteReplySchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'bad_request' }, 400);
  const { inviteId, response } = parsed.data;

  const [guest] = await db
    .select({ userId: inviteGuests.userId })
    .from(inviteGuests)
    .where(and(eq(inviteGuests.inviteId, inviteId), eq(inviteGuests.userId, me)))
    .limit(1);
  if (!guest) return c.json({ error: 'not_found' }, 404);

  await db.update(inviteGuests).set({ response })
    .where(and(eq(inviteGuests.inviteId, inviteId), eq(inviteGuests.userId, me)));

  return c.json({ ok: true });
});

/** Called off. Host only — a guest declines, they do not delete. */
invites.delete('/:id', async (c) => {
  const db = c.get('db');
  const me = c.get('userId');
  const id = c.req.param('id');

  const [row] = await db.select({ hostId: invitesTable.hostId }).from(invitesTable).where(eq(invitesTable.id, id)).limit(1);
  if (!row) return c.json({ error: 'not_found' }, 404);
  if (row.hostId !== me) return c.json({ error: 'not_host' }, 403);

  await db.delete(invitesTable).where(eq(invitesTable.id, id));
  return c.json({ ok: true });
});
