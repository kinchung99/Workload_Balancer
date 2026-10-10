/**
 * The loop that keeps a real account in step, without anything ever waiting on it.
 *
 * Mounted once, at the root. It watches the store, works out what changed, and
 * drains the queue when there is signal. Every screen stays synchronous: a tap
 * writes to Zustand and renders immediately, and this catches up afterwards.
 *
 * That ordering is the whole local-first promise. A student on a train taps
 * through a week and sees every number update instantly; the network is a
 * background chore that either happens or does not.
 */
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import type { SyncDoc } from '@shared/contract';
import { api, hasServer } from '@/lib/api';
import { bandFor } from '@/lib/load';
import { chargeOf } from '@/lib/battery';
import { published, wireVisibility } from '@/lib/sharing';
import { addDays } from '@/lib/dates';
import { applyPull, backoffFor, DEBOUNCE_MS } from '@/state/sync';
import { diff, snapshotOf, type Snapshot } from '@/state/snapshot';
import { useStore } from '@/state/store';
import { readingFrom } from '@/state/selectors';
import { logItems } from '@/lib/logs';
import { presenceLine, splitPresence } from '@/lib/checkin';

/** How often to look for other people's changes when nothing of ours moved. */
const PULL_EVERY_MS = 60_000;

export function useSync(): void {
  const lastSnapshot = useRef<Snapshot | null>(null);
  const cursor = useRef<string | null>(null);
  const queue = useRef<Record<string, SyncDoc>>({});
  const failures = useRef(0);
  const inFlight = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!hasServer()) return;

    /** Push what is queued, pull what is new, fold it in. */
    const run = async () => {
      const state = useStore.getState();
      if (inFlight.current || state.mode !== 'live' || !state.account) return;

      inFlight.current = true;
      const sending = Object.values(queue.current);
      const res = await api.sync(cursor.current, sending);
      inFlight.current = false;

      if (!res.ok) {
        // A 401 is not a network problem: it means the session went. Retrying
        // into a backoff spiral would be pointless and would hide it.
        if (res.status === 401) {
          useStore.getState().setAccount(null);
          return;
        }
        failures.current += 1;
        schedule(backoffFor(failures.current));
        return;
      }

      failures.current = 0;
      cursor.current = res.data.now;

      /*
       * Only what was actually sent leaves the queue.
       *
       * Anything enqueued while the request was in flight is still here under
       * its own key and must survive, or a write made during a slow sync is
       * silently dropped.
       */
      const sent = new Set(sending.map((d) => `${d.collection}/${d.id}`));
      queue.current = Object.fromEntries(
        Object.entries(queue.current).filter(([k]) => !sent.has(k)),
      );

      if (res.data.changes.length) {
        const { upserts, deletes } = applyPull(res.data.changes);
        useStore.getState().hydrate(upserts, deletes);
        // Taking a fresh photograph after applying the server's rows stops the
        // next diff from treating them as local edits and pushing them straight
        // back — a loop that would never settle.
        lastSnapshot.current = snapshotOf(useStore.getState());
      }

      // A capped page means there is more waiting; go again rather than sleep.
      if (res.data.more) schedule(0);

      /*
       * The circle is fetched, never synced.
       *
       * It is not your data - it is four other people's readings, and it is only
       * ever as true as their last check-in. Pulling it fresh each round makes
       * "22 min ago" mean what it says.
       */
      const [people, pending, shared, plans] = await Promise.all([api.circle(), api.requests(), api.groups(), api.invites()]);
      const me = useStore.getState().account?.id ?? '';
      if (shared.ok) useStore.getState().setGroupsFromServer(shared.data.groups, me);
      if (plans.ok) useStore.getState().setInvitesFromServer(plans.data.invites, me);
      if (people.ok) {
        useStore.getState().setCircle(people.data.circle.map((p) => ({
          id: p.id, name: p.name, initials: p.initials, band: p.band,
          charge: p.charge ?? undefined,
          // Their emoji rides at the front of their line; it goes back on their picture.
          ...splitPresence(p.status),
          heavyForDays: p.heavyForDays,
          updatedMinsAgo: p.updatedMinsAgo ?? undefined,
          free: p.free,
        })));
      }
      if (pending.ok) useStore.getState().setRequests(pending.data.requests);
    };

    const schedule = (ms: number) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void run(), ms);
    };

    /** Anything changed? Queue it and settle before pushing. */
    const onStoreChange = (state: ReturnType<typeof useStore.getState>, prev: ReturnType<typeof useStore.getState>) => {
      if (state.mode !== 'live') return;

      const next = snapshotOf(state);
      /*
       * Arriving in an account is not an edit.
       *
       * Signing in clears the sample week and sets every preference back to
       * its default. Diffing that against the photograph taken before used to
       * queue the defaults as "changes" - pushed before the first pull, so a
       * new phone overwrote the account's own limits and note with factory
       * settings. The server is the truth until its first pull lands: start a
       * clean photograph and a clean cursor, and pull straight away.
       */
      if (prev.mode !== 'live' || prev.account?.id !== state.account?.id) {
        lastSnapshot.current = next;
        queue.current = {};
        cursor.current = null;
        schedule(0);
        return;
      }
      if (lastSnapshot.current) {
        for (const doc of diff(lastSnapshot.current, next)) {
          // Keyed, so eleven edits to one task collapse to one row.
          queue.current[`${doc.collection}/${doc.id}`] = doc;
        }
      }
      lastSnapshot.current = next;
      if (Object.keys(queue.current).length) schedule(DEBOUNCE_MS);
    };

    lastSnapshot.current = snapshotOf(useStore.getState());
    const unsubscribe = useStore.subscribe(onStoreChange);

    // Coming back to the app is the moment a friend's reading is most stale.
    const app = AppState.addEventListener('change', (status) => {
      if (status === 'active') schedule(0);
    });

    const poll = setInterval(() => schedule(0), PULL_EVERY_MS);
    schedule(0);

    return () => {
      unsubscribe();
      app.remove();
      clearInterval(poll);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  /**
   * Publish the two things friends are allowed to see.
   *
   * Separate from the document sync because they are a different kind of fact:
   * derived, small, and about to be shown to other people. Recomputed from the
   * week rather than stored, so they can never be stale in the direction that
   * over-shares.
   */
  useEffect(() => {
    if (!hasServer()) return;

    const publish = async () => {
      const state = useStore.getState();
      if (state.mode !== 'live' || !state.account) return;

      const withLogs = [...state.items, ...logItems({
        today: state.today, sleepHours: state.sleepHours, meals: state.meals,
        moods: state.moods, errands: state.errands, moments: state.moments,
      })];
      const reading = readingFrom(withLogs, state.today, state.ceilings);

      await api.publishPresence({
        band: bandFor(reading.overall),
        charge: chargeOf(reading.overall),
        status: presenceLine(state.vibe, state.status),
        heavyForDays: 0,
      });

      const days = Array.from({ length: state.shareRules.ahead }, (_, i) => addDays(state.today, i));
      const windows = days.flatMap((date) =>
        published(withLogs, date, state.sharing, 1, state.shareRules).map((slot) => ({ date, start: slot.start, end: slot.end })),
      );
      await api.publishWindows({
        visibility: wireVisibility(state.sharing),
        windows,
        hiddenFrom: state.shareRules.hiddenFrom,
      });
    };

    void publish();
    const every = setInterval(() => void publish(), 5 * 60_000);
    // A note you just shared should not wait five minutes to be seen.
    const unsubscribe = useStore.subscribe((state, prev) => {
      if (state.status !== prev.status || state.vibe !== prev.vibe) void publish();
    });
    return () => { clearInterval(every); unsubscribe(); };
  }, []);
}
