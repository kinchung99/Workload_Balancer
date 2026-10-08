/**
 * Groups - the people you plan with most, joined by invitation.
 *
 * A group is shared, so it lives here. Adding someone never makes them a
 * member: it writes an invitation that only they can accept. Three rules hold
 * on every request, checked here rather than trusted from the app:
 *
 *  - **Only friends can be invited.** An invitation is a way into somebody's
 *    plans, so it needs an accepted friendship with whoever sends it.
 *  - **Only members see a group's people.** Somebody invited sees who asked and
 *    what the group is called, and nothing else until they say yes.
 *  - **Only the person who made a group removes others.** Anyone can leave.
 */
import { Hono } from 'hono';
import { and, eq, inArray } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import {
  groupCreateSchema, groupInviteSchema, groupRemoveSchema, groupRespondSchema, groupUpdateSchema, initialsFrom,
  type GroupDTO,
} from '../../../shared/contract.js';
import { friendships, groupMembers, groups as groupsTable, profiles, user } from '../db/schema.js';
import type { Env } from '../types.js';

export const groups = new Hono<Env>();

type Db = Env['Variables']['db'];

/** Of these people, the ones I am actually friends with. */
async function friendsAmong(db: Db, me: string, ids: string[]): Promise<string[]> {
  if (!ids.length) return [];
  const rows = await db
    .select({ friendId: friendships.friendId })
    .from(friendships)
    .where(and(eq(friendships.userId, me), eq(friendships.status, 'accepted'), inArray(friendships.friendId, ids)));
  return rows.map((r) => r.friendId);
}

/** My row in a group, if I have one. */
async function myRow(db: Db, groupId: string, me: string) {
  const [row] = await db
    .select({ status: groupMembers.status })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, me)))
    .limit(1);
  return row ?? null;
}

/** Invite friends who are not already in, or already asked. */
async function invite(db: Db, groupId: string, me: string, ids: string[]): Promise<number> {
  const allowed = await friendsAmong(db, me, [...new Set(ids)].filter((id) => id !== me));
  if (!allowed.length) return 0;
  await db.insert(groupMembers)
    .values(allowed.map((userId) => ({ groupId, userId, status: 'invited', invitedBy: me })))
    .onConflictDoNothing();
  return allowed.length;
}

/** Every group I am in or invited to, with what I am allowed to see of each. */
groups.get('/', async (c) => {
  const db = c.get('db');
  const me = c.get('userId');

  const mine = await db
    .select({ groupId: groupMembers.groupId, status: groupMembers.status, invitedBy: groupMembers.invitedBy })
    .from(groupMembers)
    .where(eq(groupMembers.userId, me));
  if (!mine.length) return c.json({ groups: [] as GroupDTO[] });

  const ids = mine.map((row) => row.groupId);
  const meta = await db.select().from(groupsTable).where(inArray(groupsTable.id, ids));
  const rows = await db
    .select({
      groupId: groupMembers.groupId, userId: groupMembers.userId, status: groupMembers.status,
      name: user.name, initials: profiles.initials,
    })
    .from(groupMembers)
    .innerJoin(user, eq(user.id, groupMembers.userId))
    .leftJoin(profiles, eq(profiles.userId, groupMembers.userId))
    .where(inArray(groupMembers.groupId, ids));
  const inviterIds = mine.map((row) => row.invitedBy).filter((id): id is string => !!id);
  const inviters = inviterIds.length
    ? await db.select({ id: user.id, name: user.name }).from(user).where(inArray(user.id, inviterIds))
    : [];

  const out: GroupDTO[] = meta.map((group) => {
    const own = mine.find((row) => row.groupId === group.id)!;
    const member = own.status === 'member';
    return {
      id: group.id,
      name: group.name,
      emoji: group.emoji,
      ownerId: group.ownerId,
      you: member ? 'member' : 'invited',
      ...(member ? {} : { invitedBy: inviters.find((p) => p.id === own.invitedBy)?.name ?? 'A friend' }),
      // Somebody only invited sees nothing of who else is in it.
      people: member
        ? rows
          .filter((row) => row.groupId === group.id && row.userId !== me)
          .map((row) => ({
            id: row.userId,
            name: row.name,
            initials: row.initials ?? initialsFrom(row.name),
            status: row.status === 'member' ? 'member' as const : 'invited' as const,
          }))
        : [],
    };
  });

  return c.json({ groups: out });
});

/** Make a group with you in it, and ask the friends you picked. */
groups.post('/', async (c) => {
  const db = c.get('db');
  const me = c.get('userId');
  const parsed = groupCreateSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'bad_request' }, 400);

  const id = randomUUID();
  await db.insert(groupsTable).values({ id, ownerId: me, name: parsed.data.name, emoji: parsed.data.emoji });
  await db.insert(groupMembers).values({ groupId: id, userId: me, status: 'member', invitedBy: me });
  const invited = await invite(db, id, me, parsed.data.invite);
  return c.json({ ok: true, id, invited });
});

/** Ask more friends. Any member may. */
groups.post('/:id/invite', async (c) => {
  const db = c.get('db');
  const me = c.get('userId');
  const parsed = groupInviteSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'bad_request' }, 400);
  const row = await myRow(db, c.req.param('id'), me);
  if (row?.status !== 'member') return c.json({ error: 'not_found' }, 404);
  return c.json({ ok: true, invited: await invite(db, c.req.param('id'), me, parsed.data.userIds) });
});

/** Your answer to an invitation. Only yours: nobody can accept for you. */
groups.post('/:id/respond', async (c) => {
  const db = c.get('db');
  const me = c.get('userId');
  const parsed = groupRespondSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'bad_request' }, 400);
  const groupId = c.req.param('id');
  const row = await myRow(db, groupId, me);
  if (row?.status !== 'invited') return c.json({ error: 'not_pending' }, 409);

  const mineOnly = and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, me));
  if (parsed.data.action === 'accept') await db.update(groupMembers).set({ status: 'member' }).where(mineOnly);
  else await db.delete(groupMembers).where(mineOnly);
  return c.json({ ok: true, status: parsed.data.action === 'accept' ? 'member' : 'declined' });
});

/**
 * Take someone out, or cancel their invitation.
 *
 * The maker of the group may remove anyone else; everyone may remove
 * themselves, which is leaving. A group left with nobody in it goes.
 */
groups.post('/:id/remove', async (c) => {
  const db = c.get('db');
  const me = c.get('userId');
  const parsed = groupRemoveSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'bad_request' }, 400);
  const groupId = c.req.param('id');
  const [group] = await db.select().from(groupsTable).where(eq(groupsTable.id, groupId)).limit(1);
  if (!group || (await myRow(db, groupId, me))?.status !== 'member') return c.json({ error: 'not_found' }, 404);
  const them = parsed.data.userId;
  if (them !== me && group.ownerId !== me) return c.json({ error: 'forbidden' }, 403);

  await db.delete(groupMembers).where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, them)));
  const left = await db.select({ userId: groupMembers.userId }).from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.status, 'member')));
  if (!left.length) await db.delete(groupsTable).where(eq(groupsTable.id, groupId));
  return c.json({ ok: true });
});

/** A new name or picture. Any member may. */
groups.post('/:id', async (c) => {
  const db = c.get('db');
  const me = c.get('userId');
  const parsed = groupUpdateSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'bad_request' }, 400);
  const groupId = c.req.param('id');
  if ((await myRow(db, groupId, me))?.status !== 'member') return c.json({ error: 'not_found' }, 404);
  await db.update(groupsTable).set(parsed.data).where(eq(groupsTable.id, groupId));
  return c.json({ ok: true });
});

/** The whole group, for everyone. Only its maker may. */
groups.delete('/:id', async (c) => {
  const db = c.get('db');
  const me = c.get('userId');
  const groupId = c.req.param('id');
  const [group] = await db.select().from(groupsTable).where(eq(groupsTable.id, groupId)).limit(1);
  if (!group) return c.json({ error: 'not_found' }, 404);
  if (group.ownerId !== me) return c.json({ error: 'forbidden' }, 403);
  await db.delete(groupsTable).where(eq(groupsTable.id, groupId));
  return c.json({ ok: true });
});
