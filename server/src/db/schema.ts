/**
 * The database, in two halves.
 *
 * **Your own week is one table.** `documents` holds every private collection —
 * items, errands, moods, meals, the lot — as `(userId, collection, docId)` with
 * a `jsonb` body. The server never reads inside that body and never will: the
 * load model, the forecast, the rebalancer and the planner all run on the phone,
 * so a column per field would buy nothing and cost a migration every time the
 * app learns a new one. Adding `want` to `Item` needed no deploy here.
 *
 * **What is between people gets real columns.** A friend's battery, the windows
 * they published, an invitation — none of those can be computed on your own
 * device, so the server has to query and enforce them. Those are typed, indexed
 * and constrained properly, because they are the half where a bug leaks somebody
 * else's week.
 *
 * Better Auth owns `user`, `session`, `account` and `verification`; its schema is
 * generated into auth-schema.ts and re-exported at the bottom so Drizzle sees one
 * schema and foreign keys can point at the user table.
 */
import { relations, sql } from 'drizzle-orm';
import {
  boolean, index, integer, jsonb, pgTable, primaryKey, real,
  text, timestamp, uniqueIndex, varchar,
} from 'drizzle-orm/pg-core';
import { user } from './auth-schema.js';

export { user, session, account, verification } from './auth-schema.js';

/* ------------------------------------------------------------------ profile */

/**
 * The half of an account that is Ballast's rather than the auth library's.
 *
 * Separate from `user` on purpose: Better Auth owns that table and regenerates
 * it, so anything we add belongs beside it rather than inside it.
 */
export const profiles = pgTable('profiles', {
  userId: text('user_id').primaryKey().references(() => user.id, { onDelete: 'cascade' }),
  /** Two letters for the avatar. Derived from the name, overridable. */
  initials: varchar('initials', { length: 3 }).notNull().default('?'),
  /**
   * Only ever used to build a `wa.me` link on the student's own device.
   *
   * Never sent to another user and never used to find people — contact matching
   * happens on the phone against hashes, so the server never learns who is in
   * anybody's address book.
   */
  phone: varchar('phone', { length: 24 }),
  /** How much of the calendar the circle may see. Off is genuinely off. */
  visibility: varchar('visibility', { length: 12 }).notNull().default('evenings'),
  /**
   * A short code people can read out loud.
   *
   * Email is the wrong handle for two students standing next to each other, and
   * it is impossible for a guest whose address is `temp-9tupaer0dt8…`. Six
   * characters can be said across a table, typed without a keyboard shortcut, or
   * shown on a screen — which is how friending actually happens in the room.
   */
  code: varchar('code', { length: 8 }).notNull(),
  /**
   * Your picture: a small square photo (a JPEG data URI, a few kilobytes) or
   * one emoji. Shown to your friends; null shows your initials.
   */
  pic: text('pic'),
  /**
   * Friends who see none of your times, whatever `visibility` says.
   *
   * A list on the owner's row rather than a per-viewer copy of the windows: one
   * set of windows, one short list of who may not look, applied on every read.
   */
  hiddenFrom: jsonb('hidden_from').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex('profiles_code_idx').on(t.code)]);

/* --------------------------------------------------------------- documents */

/**
 * Every private collection, one row per document.
 *
 * `updatedAt` carries the whole conflict story: last write wins, per row. Two
 * phones editing two different tasks never collide, and the same task resolves
 * to whichever was touched later.
 *
 * `deleted` is a tombstone, not an absence. A row that merely stopped being sent
 * would be resurrected by the next device that still had a copy of it.
 */
export const documents = pgTable('documents', {
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  collection: varchar('collection', { length: 32 }).notNull(),
  docId: varchar('doc_id', { length: 128 }).notNull(),
  data: jsonb('data').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  deleted: boolean('deleted').notNull().default(false),
}, (t) => [
  primaryKey({ columns: [t.userId, t.collection, t.docId] }),
  // The only query the sync endpoint makes: everything of mine since a cursor.
  index('documents_pull_idx').on(t.userId, t.updatedAt),
]);

/* ---------------------------------------------------------------- presence */

/**
 * What your circle sees of you. The entire payload, and the whole table.
 *
 * There is deliberately no column here for a task, a deadline, a module or a
 * mood. That is the privacy promise expressed as a schema rather than as a
 * policy: no future endpoint can leak a field that does not exist.
 *
 * `updatedAt` is the number the friends screen is actually built on — a reading
 * nobody has confirmed for three days is not the same claim as one from twenty
 * minutes ago, and the app says so rather than pretending.
 */
export const presence = pgTable('presence', {
  userId: text('user_id').primaryKey().references(() => user.id, { onDelete: 'cascade' }),
  band: varchar('band', { length: 12 }).notNull().default('steady'),
  charge: integer('charge').notNull().default(100),
  status: varchar('status', { length: 80 }),
  heavyForDays: integer('heavy_for_days').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Free windows, published by their owner.
 *
 * Rewritten wholesale on every publish rather than diffed, because the client
 * recomputes them from its own week and a partial update could leave a stale
 * window standing — which is the one failure mode that over-shares.
 *
 * Note what is absent: no title, no task id, no reason. A window is two numbers
 * and a date. That is enough to plan a dinner and not enough to know anything.
 */
export const freeWindows = pgTable('free_windows', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  date: varchar('date', { length: 10 }).notNull(),
  start: real('start').notNull(),
  end: real('end').notNull(),
}, (t) => [index('free_windows_user_idx').on(t.userId, t.date)]);

/* --------------------------------------------------------------- the circle */

/**
 * One row per direction, which is what makes a request a request.
 *
 * `status` on the asker's row is 'pending' until the other person accepts, at
 * which point both rows read 'accepted'. Storing it twice rather than once with
 * a canonical ordering keeps every read a single indexed lookup on `userId`, and
 * the endpoints only ever have to reason about "my row about them".
 */
export const friendships = pgTable('friendships', {
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  friendId: text('friend_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  /** pending · accepted · blocked */
  status: varchar('status', { length: 12 }).notNull().default('pending'),
  /** True on the row belonging to whoever sent the request. */
  initiatedByMe: boolean('initiated_by_me').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.userId, t.friendId] }),
  index('friendships_friend_idx').on(t.friendId),
]);

/* ------------------------------------------------------------------ groups */

/**
 * A group is shared, so it lives here rather than in anyone's own documents.
 *
 * Joining is two-sided the way a friendship is: the person adding you writes an
 * `invited` row, and only you can turn it into `member`. Until then you are not
 * in it - you see the invitation, nobody sees you listed as a member.
 */
export const groups = pgTable('groups', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 32 }).notNull(),
  emoji: varchar('emoji', { length: 16 }).notNull().default('👥'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const groupMembers = pgTable('group_members', {
  groupId: text('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  /** invited · member */
  status: varchar('status', { length: 12 }).notNull().default('invited'),
  invitedBy: text('invited_by').references(() => user.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.groupId, t.userId] }),
  index('group_members_user_idx').on(t.userId),
]);

/* --------------------------------------------------------------- gatherings */

export const invites = pgTable('invites', {
  id: text('id').primaryKey(),
  hostId: text('host_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 120 }).notNull(),
  date: varchar('date', { length: 10 }).notNull(),
  startHour: real('start_hour').notNull(),
  hours: real('hours').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('invites_host_idx').on(t.hostId, t.date)]);

export const inviteGuests = pgTable('invite_guests', {
  inviteId: text('invite_id').notNull().references(() => invites.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  /** pending · yes · no */
  response: varchar('response', { length: 8 }).notNull().default('pending'),
}, (t) => [
  primaryKey({ columns: [t.inviteId, t.userId] }),
  index('invite_guests_user_idx').on(t.userId),
]);

/* ---------------------------------------------------------- google calendar */

/**
 * A Google Calendar, connected - read-only, one per person.
 *
 * The refresh token is the only secret here and it is sealed (AES-GCM, keyed
 * from AUTH_SECRET) before it is written, so a leaked backup is not a leaked
 * calendar. Events are never stored: they are read from Google when the app
 * asks, and what the student keeps becomes ordinary items on their phone.
 */
export const calendarLinks = pgTable('calendar_links', {
  userId: text('user_id').primaryKey().references(() => user.id, { onDelete: 'cascade' }),
  googleEmail: varchar('google_email', { length: 254 }),
  refreshToken: text('refresh_token').notNull(),
  /** Which of their calendars to read: [{ id, name, color, on }]. */
  calendars: jsonb('calendars').$type<Array<{ id: string; name: string; color: string | null; on: boolean }>>(),
  /** ok · expired (Google stopped honouring the token; reconnect) */
  status: varchar('status', { length: 10 }).notNull().default('ok'),
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/* -------------------------------------------------------------------- wiring */

export const profileRelations = relations(profiles, ({ one }) => ({
  user: one(user, { fields: [profiles.userId], references: [user.id] }),
}));

export const inviteRelations = relations(invites, ({ many, one }) => ({
  guests: many(inviteGuests),
  host: one(user, { fields: [invites.hostId], references: [user.id] }),
}));

export const inviteGuestRelations = relations(inviteGuests, ({ one }) => ({
  invite: one(invites, { fields: [inviteGuests.inviteId], references: [invites.id] }),
  user: one(user, { fields: [inviteGuests.userId], references: [user.id] }),
}));

/** Every table, for the test harness to create in one pass. */
export const ALL_TABLES = { profiles, documents, presence, freeWindows, friendships, groups, groupMembers, invites, inviteGuests, calendarLinks };

export { sql };
