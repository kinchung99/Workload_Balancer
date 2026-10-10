/**
 * What changed, worked out by looking rather than by being told.
 *
 * The obvious way to sync a store is to make every action report its own writes.
 * There are about thirty actions in this app and there will be more, and the
 * failure mode is silent: somebody adds `logMoment` in six months, forgets the
 * reporting line, and that data quietly never leaves the phone. Nothing fails,
 * nothing warns, it is just gone.
 *
 * So instead the store is photographed before and after, and the difference is
 * the change set. One integration point, no per-action discipline, and an action
 * added later is covered the day it is written.
 *
 * The cost is a JSON comparison over the week on every settle. For the size of
 * data a student generates — a few hundred rows at the very most — that is
 * nothing, and it buys correctness that does not depend on anyone remembering.
 */
import type { Collection, SyncDoc } from '@shared/contract';

/** Every collection, flattened to `{ id: row }`. */
export type Snapshot = Partial<Record<Collection, Record<string, unknown>>>;

/** The slices this reads. Kept structural so the store can stay unaware of sync. */
export interface Syncable {
  items: Array<{ id: string }>;
  errands: Array<{ id: string }>;
  modules: Array<{ id: string }>;
  moods: Array<{ id: string }>;
  meals: Array<{ id: string }>;
  moments: Array<{ id: string }>;
  recovery: Array<{ id: string }>;
  contacts: Array<{ id: string }>;
  /** Keyed by date - a day report has no id because there is one per day. */
  dayReports: Array<{ date: string }>;
  ceilings: Record<string, number>;
  overallCeiling: number;
  offHour: number;
  sleepHours: number | null;
  booked: string[];
  sharing: string;
  customActions: unknown[];
  onboarded: boolean;
  customFlags: unknown[];
  groups: unknown[];
  shareRules: unknown;
  planActivities: unknown[];
  /** Your note and emoji for friends - yours on every device, not only this one. */
  status?: string | null;
  vibe?: string | null;
}

const byId = (rows: Array<{ id: string }>): Record<string, unknown> =>
  Object.fromEntries(rows.map((row) => [row.id, row]));

/**
 * One photograph of everything that syncs.
 *
 * `settings` is a single document rather than a row per field, because the set
 * of preferences changes as the app learns new ones and a schema that changes
 * with it is a migration every time somebody adds a toggle.
 */
export function snapshotOf(state: Syncable): Snapshot {
  return {
    items: byId(state.items),
    errands: byId(state.errands),
    modules: byId(state.modules),
    moods: byId(state.moods),
    meals: byId(state.meals),
    moments: byId(state.moments),
    recovery: byId(state.recovery),
    contacts: byId(state.contacts),
    dayReports: Object.fromEntries(state.dayReports.map((r) => [r.date, r])),
    settings: {
      settings: {
        ceilings: state.ceilings,
        overallCeiling: state.overallCeiling,
        offHour: state.offHour,
        sleepHours: state.sleepHours,
        booked: state.booked,
        sharing: state.sharing,
        customActions: state.customActions,
        onboarded: state.onboarded,
        customFlags: state.customFlags,
        status: state.status ?? null,
        vibe: state.vibe ?? null,
        groups: state.groups,
        shareRules: state.shareRules,
        planActivities: state.planActivities,
      },
    },
  };
}

/**
 * Rows that appeared, changed, or went away.
 *
 * Deletions become tombstones rather than silence, because a row that merely
 * stopped being sent would be resurrected by the next device that still had it.
 */
export function diff(prev: Snapshot, next: Snapshot): SyncDoc[] {
  const out: SyncDoc[] = [];
  const updatedAt = new Date().toISOString();
  const names = new Set([...Object.keys(prev), ...Object.keys(next)]) as Set<Collection>;

  for (const collection of names) {
    const before = prev[collection] ?? {};
    const after = next[collection] ?? {};

    for (const [id, row] of Object.entries(after)) {
      // JSON rather than a deep compare: these rows are plain data by
      // construction, and stringify is both faster and easier to trust here.
      if (JSON.stringify(before[id]) !== JSON.stringify(row)) {
        out.push({ collection, id, data: row, updatedAt, deleted: false });
      }
    }
    for (const id of Object.keys(before)) {
      if (!(id in after)) out.push({ collection, id, data: {}, updatedAt, deleted: true });
    }
  }
  return out;
}

/**
 * Turn what the server sent back into store slices.
 *
 * Server rows win over whatever is in memory for the same id — they have already
 * been through the last-write-wins rule, so by the time a row arrives here it is
 * the agreed answer. Local rows the server has never heard of are kept: they are
 * writes that have not been pushed yet, not rows somebody deleted.
 */
export function mergeInto<T extends { id: string }>(
  local: T[],
  upserts: Array<{ id: string; data: unknown }>,
  deletes: string[],
): T[] {
  const gone = new Set(deletes);
  const incoming = new Map(upserts.map((u) => [u.id, u.data as T]));
  const merged: T[] = [];

  for (const row of local) {
    if (gone.has(row.id)) continue;
    merged.push(incoming.has(row.id) ? incoming.get(row.id)! : row);
    incoming.delete(row.id);
  }
  for (const row of incoming.values()) {
    if (row && typeof row === 'object' && 'id' in row) merged.push(row);
  }
  return merged;
}
