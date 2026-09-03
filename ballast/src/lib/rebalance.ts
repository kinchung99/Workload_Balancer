/**
 * Building the trade list.
 *
 * A warning that does not come with a plan is just a better-designed source of
 * stress. Every flag in Ballast leads here, to a list of specific things you
 * could actually put down and the exact price of each one.
 *
 * The rules below are what makes the list trustworthy: hard deadlines are
 * locked rather than discouraged, recovery is protected by default, and the app
 * never proposes skipping the exam. Earning that trust is the whole point of
 * tagging commitments at capture.
 */
import { dayName } from './dates';
import { loadOf, sumLoad } from './load';
import type { Item, Trade } from './types';

/** Batching four errands into one trip costs one trip's worth of time. */
const BATCHED_TRIP_HOURS = 1.5;
const BATCHED_TRIP_DREAD = 2;

/**
 * Asking someone to cover a shift, or sending your apologies, costs something
 * socially. So the app only proposes it when the saving is worth the cost -
 * offering to skip a two-load Sunday dinner would spend the student's trust for
 * nothing. Batching is exempt: nothing is given up, so there is no cost to weigh.
 */
const WORTH_A_MESSAGE = 6;

export function buildTrades(week: Item[]): Trade[] {
  const trades: Trade[] = [];
  const byLoad = (a: Item, b: Item) => loadOf(b) - loadOf(a);

  // b. Hard deadlines are locked, not just discouraged. The app will never
  //    propose skipping the presentation, so a student can trust every
  //    suggestion on the list without reading it defensively.
  const hardest = week.filter((i) => i.commitment === 'hard' && !i.repeats).sort(byLoad)[0];
  if (hardest) {
    trades.push({
      id: `lock-${hardest.id}`,
      itemId: hardest.id,
      title: `${hardest.title}${hardest.when ? `, ${hardest.when}` : ''}`,
      detail: 'Hard deadline. Never suggested for moving.',
      saves: 0,
      locked: true,
      selected: false,
    });
  }

  // Push the self-imposed thing you will mind least losing this week.
  const pushable = week
    .filter((i) => i.commitment === 'self' && !i.repeats && !i.isRecovery && i.bucket === 'mental')
    .sort((a, b) => a.dread - b.dread || loadOf(a) - loadOf(b))[0];
  if (pushable) {
    trades.push({
      id: `push-${pushable.id}`,
      itemId: pushable.id,
      title: pushable.title,
      detail: `Self-imposed, push to Sunday, saves ${loadOf(pushable)}`,
      saves: loadOf(pushable),
      selected: true,
    });
  }

  // Hand back a shift you picked up. Soft commitments to other people are the
  // ones that are genuinely movable and the ones students never think to move.
  for (const item of week.filter((i) => i.commitment === 'soft' && !i.repeats && i.bucket === 'time' && loadOf(i) >= WORTH_A_MESSAGE).sort(byLoad)) {
    trades.push({
      id: `hand-${item.id}`,
      itemId: item.id,
      title: item.title,
      detail: `Ask Jo to take it, saves ${loadOf(item)}`,
      saves: loadOf(item),
      selected: true,
    });
  }

  // The one that needs a message written, which is the next screen.
  for (const item of week.filter((i) => i.commitment === 'soft' && !i.repeats && i.bucket === 'social' && loadOf(i) >= WORTH_A_MESSAGE).sort(byLoad)) {
    trades.push({
      id: `decline-${item.id}`,
      itemId: item.id,
      title: item.title,
      detail: `Send your apologies, saves ${loadOf(item)}`,
      saves: loadOf(item),
      selected: true,
    });
  }

  // c. Errands batch by location. The one category where the saving is genuinely
  //    free - same trip, four things, load back for nothing given up.
  const places = new Map<string, Item[]>();
  for (const item of week.filter((i) => i.place)) {
    places.set(item.place!, [...(places.get(item.place!) ?? []), item]);
  }
  for (const [place, group] of places) {
    if (group.length < 2) continue;
    const saved = Math.round((sumLoad(group) - BATCHED_TRIP_HOURS * BATCHED_TRIP_DREAD) * 10) / 10;
    trades.push({
      id: `batch-${place}`,
      itemId: group.map((i) => i.id).join(','),
      title: `${group.length} errands, all ${place}`,
      detail: `Batch into one trip ${dayName(group[0].date)}, saves ${saved}`,
      saves: saved,
      selected: true,
    });
  }

  // d. Recovery is protected by default. The swim is the first thing a stressed
  //    student cuts and the last thing they should. Overriding takes a
  //    deliberate tap, and the app says what it will cost.
  for (const item of week.filter((i) => i.isRecovery)) {
    trades.push({
      id: `protect-${item.id}`,
      itemId: item.id,
      title: `${item.title}`,
      detail: 'Recovery. Protected, override if you must.',
      saves: loadOf(item),
      protected: true,
      selected: false,
    });
  }

  return trades;
}

/** The items a set of selections would actually remove from the week. */
export function applySelection(week: Item[], trades: Trade[], selected: Record<string, boolean>): Item[] {
  const removed = new Set<string>();
  const batched: Item[] = [];

  for (const trade of trades) {
    if (!selected[trade.id] || trade.locked) continue;
    const ids = trade.itemId.split(',');
    ids.forEach((id) => removed.add(id));

    // A batched trip is not a deletion: the errands still happen, in one go.
    if (trade.id.startsWith('batch-')) {
      const first = week.find((i) => i.id === ids[0]);
      if (first) {
        batched.push({
          ...first,
          id: trade.id,
          title: trade.title,
          hours: BATCHED_TRIP_HOURS,
          dread: BATCHED_TRIP_DREAD,
          place: undefined,
        });
      }
    }
  }

  return [...week.filter((i) => !removed.has(i.id)), ...batched];
}

export const totalSaved = (trades: Trade[], selected: Record<string, boolean>): number =>
  Math.round(trades.filter((t) => selected[t.id] && !t.locked).reduce((sum, t) => sum + t.saves, 0) * 10) / 10;
