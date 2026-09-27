/**
 * The wire contract, written once and imported by both sides.
 *
 * The app and the server are separate packages, which normally means the same
 * shape gets typed out twice and drifts the first time somebody adds a field.
 * Everything that crosses the network is defined here instead: the server parses
 * requests with these schemas, the client builds requests from the same types,
 * and `npm run typecheck` in either package fails if they stop agreeing.
 *
 * Two rules hold this design together.
 *
 * **The server never reasons about a student's own week.** Items, errands, moods,
 * meals and the rest are stored as opaque documents. The load model, the
 * forecast, the rebalancer and the planner all run on the phone and always will
 * — the server's job is to keep a copy and hand it back on another device. That
 * is why `SyncDoc.data` is `unknown` here and `jsonb` in the database: adding a
 * field to `Item` should never need a migration or a deploy.
 *
 * **What is between people is typed properly.** A friend's battery, the windows
 * they published, an invitation — none of those can be computed on your own
 * phone, so the server has real columns and real rules for them, and they get
 * real schemas below.
 */
import { z } from 'zod';

/* ------------------------------------------------------------------ sync */

/**
 * The private collections. One name per store slice that survives a reinstall.
 *
 * `settings` is a single document holding the ceilings, the off-hour, the
 * tuning weights and the rest - a row per field would be a schema that changes
 * every time the app learns a new preference.
 */
export const COLLECTIONS = [
  'items', 'errands', 'modules', 'moods', 'meals',
  'moments', 'dayReports', 'recovery', 'contacts', 'settings',
] as const;
export type Collection = (typeof COLLECTIONS)[number];
export const collectionSchema = z.enum(COLLECTIONS);

/**
 * One row, in either direction.
 *
 * `updatedAt` is the client's clock on push and the server's on pull, and it is
 * the whole conflict story: last write wins, per row. Two phones editing two
 * different tasks never collide, and two phones editing the *same* task resolve
 * to whichever was touched later — which is what a person would expect and the
 * only rule that needs no interface.
 *
 * `deleted` is a tombstone rather than an absence. A row that simply stopped
 * being sent would be re-created by the next device that still had it.
 */
export const syncDocSchema = z.object({
  collection: collectionSchema,
  id: z.string().min(1).max(128),
  data: z.unknown(),
  updatedAt: z.string().datetime(),
  deleted: z.boolean().default(false),
});
export type SyncDoc = z.infer<typeof syncDocSchema>;

/**
 * A push, a pull, or both at once - which is the normal case.
 *
 * `since` null means "I have nothing, send me everything". The client stores the
 * `now` it gets back and sends it as the next `since`, so a reconnect after a
 * fortnight costs one request rather than a full download.
 */
export const syncRequestSchema = z.object({
  since: z.string().datetime().nullable(),
  // Capped so one wedged client cannot push a hundred megabytes; the client
  // drains its queue in batches and the cursor makes that free.
  changes: z.array(syncDocSchema).max(500).default([]),
});
export type SyncRequest = z.infer<typeof syncRequestSchema>;

export interface SyncResponse {
  /** Server time this pull was taken at. Send it back as the next `since`. */
  now: string;
  changes: SyncDoc[];
  /** True when the page was capped - pull again immediately with the new cursor. */
  more: boolean;
}

/* --------------------------------------------------------------- presence */

export const BANDS = ['steady', 'busy', 'heavy', 'recovery'] as const;
export const bandSchema = z.enum(BANDS);

/**
 * What you broadcast to your circle. The entire payload.
 *
 * A band, a charge, and one line you wrote yourself. There is deliberately no
 * field here for a task, a deadline, a module or a mood - not "private by
 * default", but absent from the shape, so no bug and no future endpoint can
 * leak one.
 */
export const presenceSchema = z.object({
  band: bandSchema,
  charge: z.number().int().min(0).max(100),
  status: z.string().max(80).nullable().default(null),
  heavyForDays: z.number().int().min(0).max(365).default(0),
});
export type Presence = z.infer<typeof presenceSchema>;

/** A friend, as you are allowed to see them. */
export interface CircleMemberDTO {
  id: string;
  name: string;
  initials: string;
  band: (typeof BANDS)[number];
  charge: number | null;
  status: string | null;
  heavyForDays: number;
  /** Minutes since they last updated. Null when they never have. */
  updatedMinsAgo: number | null;
  /** Their published free windows, already filtered by their own setting. */
  free: Array<{ date: string; start: number; end: number }>;
}

/* ---------------------------------------------------------------- sharing */

export const VISIBILITIES = ['off', 'evenings', 'busy'] as const;
export const visibilitySchema = z.enum(VISIBILITIES);
export type Visibility = (typeof VISIBILITIES)[number];

/**
 * The windows you publish, and how much of them anyone may see.
 *
 * The client computes the windows from its own week - the server never sees the
 * tasks that produced the gaps - and re-publishes whenever the week changes.
 * Sending the level with them means one request cannot leave the two out of
 * step, which is the failure that would quietly over-share.
 */
export const publishSchema = z.object({
  visibility: visibilitySchema,
  windows: z.array(z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    start: z.number().min(0).max(24),
    end: z.number().min(0).max(24),
  })).max(200),
});
export type PublishRequest = z.infer<typeof publishSchema>;

/* ---------------------------------------------------------------- circle */

/**
 * Ask to be in someone's circle, by whichever handle you have.
 *
 * A code is what works in the room - six characters somebody reads out while you
 * type. An email is what works when they are not there. Guests only have a code,
 * because their address is generated and unsayable.
 */
export const friendRequestSchema = z.object({
  email: z.string().email().max(254).optional(),
  code: z.string().min(4).max(16).optional(),
}).refine((v) => Boolean(v.email || v.code), { message: 'Give an email or a code' });

export const friendActionSchema = z.object({
  /** The other person's user id, from a pending row. */
  userId: z.string().min(1),
  action: z.enum(['accept', 'decline', 'remove']),
});

export interface PendingRequestDTO {
  userId: string;
  name: string;
  initials: string;
  /** 'incoming' needs an answer from you; 'outgoing' is waiting on them. */
  direction: 'incoming' | 'outgoing';
  at: string;
}

/* --------------------------------------------------------------- invites */

export const inviteSchema = z.object({
  title: z.string().min(1).max(120),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startHour: z.number().min(0).max(24),
  hours: z.number().min(0.25).max(12),
  /** User ids from your circle. The server checks they actually are. */
  people: z.array(z.string().min(1)).min(1).max(20),
});
export type InviteRequest = z.infer<typeof inviteSchema>;

export interface InviteDTO {
  id: string;
  title: string;
  date: string;
  startHour: number;
  hours: number;
  fromMe: boolean;
  host: { id: string; name: string };
  guests: Array<{ id: string; name: string; response: 'pending' | 'yes' | 'no' }>;
}

export const inviteReplySchema = z.object({
  inviteId: z.string().min(1),
  response: z.enum(['yes', 'no']),
});

/* ----------------------------------------------------------------- profile */

export const profileSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  /** Two letters on a circle avatar. Derived from the name when not given. */
  initials: z.string().min(1).max(3).optional(),
  /** Only ever used to build a wa.me link on the student's own device. */
  phone: z.string().max(24).nullable().optional(),
});

export interface MeDTO {
  id: string;
  email: string;
  name: string;
  initials: string;
  phone: string | null;
  visibility: Visibility;
  /** Your handle. Short enough to read out; the only one a guest has. */
  code: string;
  /** True until an email and password are added. Everything else works the same. */
  isGuest: boolean;
}

/** Initials from a name, the same way on both sides of the wire. */
export { initialsFrom } from './initials.ts';

/* -------------------------------------------------------------------- misc */

export interface ApiError {
  error: string;
  detail?: string;
}
