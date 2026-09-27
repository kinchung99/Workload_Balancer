/**
 * Local-first sync: the phone is the source of truth, the server is a copy.
 *
 * This is the whole reason the app still works in a basement lecture theatre.
 * Writes land in Zustand immediately and are *also* queued here; the queue drains
 * whenever there is signal and an account. Nothing in the interface ever waits
 * for a network call, and nothing is lost if one never arrives.
 *
 * Three decisions do most of the work.
 *
 * **The queue is keyed, not appended.** Editing the same task eleven times while
 * offline leaves one entry, not eleven. A list that grows with every keystroke is
 * a list that never drains on a bad connection.
 *
 * **Conflicts resolve by time, per row.** The server keeps whichever write is
 * later. Two phones editing two different tasks never collide; the same task
 * resolves the way a person would expect, and no interface has to explain it.
 *
 * **Pulling is a merge, not a replace.** A pull that overwrote local state would
 * throw away whatever was typed in the seconds since the request left.
 */
import type { Collection, SyncDoc } from '@shared/contract';
import { api, hasServer } from '@/lib/api';

/** How long to wait after a change before pushing. Long enough to coalesce a burst. */
const DEBOUNCE_MS = 1_500;
/** Backoff ceiling. A phone in a tunnel should not retry every second for an hour. */
const MAX_BACKOFF_MS = 5 * 60_000;

export interface SyncState {
  /** Server time of the last successful pull. The cursor for the next one. */
  cursor: string | null;
  /** Rows waiting to go up, keyed `collection/id` so repeats collapse. */
  queue: Record<string, SyncDoc>;
  status: 'idle' | 'syncing' | 'offline' | 'signed-out';
  lastSyncedAt: string | null;
  /** Consecutive failures, for the backoff. */
  failures: number;
}

export const emptySync = (): SyncState => ({
  cursor: null, queue: {}, status: 'idle', lastSyncedAt: null, failures: 0,
});

const key = (collection: Collection, id: string) => `${collection}/${id}`;

/**
 * Record a local change for eventual upload.
 *
 * Pure: it returns the next queue rather than mutating one, so the store can
 * hold it like any other slice and time-travel in dev tools still works.
 */
export function enqueue(
  queue: SyncState['queue'],
  collection: Collection,
  id: string,
  data: unknown,
  deleted = false,
): SyncState['queue'] {
  return {
    ...queue,
    [key(collection, id)]: { collection, id, data, updatedAt: new Date().toISOString(), deleted },
  };
}

/**
 * Fold what the server sent into what we already have.
 *
 * The caller owns the shape of each collection, so this hands back plain
 * instructions - upsert these, drop those - rather than trying to know what an
 * `Item` is. Keeping the merge ignorant of the domain is what stops this file
 * growing a second copy of the model.
 */
export function applyPull(changes: SyncDoc[]): {
  upserts: Map<Collection, Array<{ id: string; data: unknown }>>;
  deletes: Map<Collection, string[]>;
} {
  const upserts = new Map<Collection, Array<{ id: string; data: unknown }>>();
  const deletes = new Map<Collection, string[]>();

  for (const doc of changes) {
    if (doc.deleted) {
      deletes.set(doc.collection, [...(deletes.get(doc.collection) ?? []), doc.id]);
    } else {
      upserts.set(doc.collection, [...(upserts.get(doc.collection) ?? []), { id: doc.id, data: doc.data }]);
    }
  }
  return { upserts, deletes };
}

/** Exponential, with a ceiling and a floor. */
export const backoffFor = (failures: number): number =>
  Math.min(MAX_BACKOFF_MS, DEBOUNCE_MS * 2 ** Math.min(failures, 8));

/**
 * One round trip: push the queue, pull what changed, hand back the new state.
 *
 * Returns the *whole* next `SyncState` so the caller does one atomic store
 * update. A partial write here is how a cursor advances past changes that were
 * never actually applied.
 */
export async function runSync(
  state: SyncState,
  onPull: (changes: SyncDoc[]) => void,
): Promise<SyncState> {
  if (!hasServer()) return { ...state, status: 'signed-out' };

  const pending = Object.values(state.queue);
  const res = await api.sync(state.cursor, pending);

  if (!res.ok) {
    // 401 is not a network problem and must not be retried into a backoff spiral
    // - it means sign in, which is a thing only the person can do.
    const signedOut = res.status === 401;
    return {
      ...state,
      status: signedOut ? 'signed-out' : 'offline',
      failures: signedOut ? 0 : state.failures + 1,
    };
  }

  onPull(res.data.changes);

  /*
   * The queue is cleared only for what was actually sent.
   *
   * Anything enqueued while the request was in flight is still in `state.queue`
   * under its own key and must survive, or a write made during a slow sync is
   * silently dropped.
   */
  const sent = new Set(pending.map((d) => key(d.collection, d.id)));
  const remaining = Object.fromEntries(
    Object.entries(state.queue).filter(([k]) => !sent.has(k)),
  );

  return {
    cursor: res.data.now,
    queue: remaining,
    status: 'idle',
    lastSyncedAt: new Date().toISOString(),
    failures: 0,
  };
}

/**
 * "Synced just now" · "3 min ago" · "not signed in".
 *
 * The same honesty the friends screen applies to other people's batteries: a
 * copy that is four hours old should say so rather than imply it is current.
 */
export function syncLabel(state: SyncState): string {
  if (!hasServer()) return 'On this device only';
  if (state.status === 'signed-out') return 'Not signed in';
  if (state.status === 'offline') return 'Offline — changes are saved here';
  if (!state.lastSyncedAt) return 'Not synced yet';

  const mins = Math.round((Date.now() - Date.parse(state.lastSyncedAt)) / 60_000);
  if (mins < 1) return 'Synced just now';
  if (mins < 60) return `Synced ${mins} min ago`;
  const hours = Math.round(mins / 60);
  return hours < 24 ? `Synced ${hours}h ago` : `Synced ${Math.round(hours / 24)} days ago`;
}

export { DEBOUNCE_MS, MAX_BACKOFF_MS };
