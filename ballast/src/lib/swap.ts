/**
 * Swapping, rather than dropping.
 *
 * Every calendar can tell you a day is full. None of them can tell you which of
 * two things to go to, because answering that needs three facts a calendar does
 * not hold:
 *
 *   1. **Is it mandatory?**  Not "is it in the diary" - is there an actual
 *      consequence for missing it. For a class this is arithmetic: a student at
 *      89% attendance against an 80% requirement can miss one and be fine, and
 *      one at 78% cannot. The app works this out rather than asking.
 *   2. **Can it move?**  `commitment` already says whether something is a hard
 *      deadline, a soft arrangement, or a promise to yourself.
 *   3. **Do you want to be there?**  The only one of the three the app cannot
 *      derive, and therefore the only one it asks - `want`, one dial, once.
 *
 * With those, "your sister's wedding is on Thursday and so is a lecture" stops
 * being a dilemma and becomes a calculation: the lecture is important, unwanted
 * and - given your attendance - genuinely skippable; the wedding is wanted and
 * unrepeatable. Keep the wedding.
 *
 * The refusals matter as much as the swaps. A class you are already below the
 * line on is never offered, however much you would rather be elsewhere, and
 * neither is the lecture where the hints get given. A tool that will trade away
 * your degree to free up an evening is a tool you stop believing.
 */
import { loadOf } from './load';
import { attendanceRate, attendanceStatus } from './timetable';
import type { Item, Module } from './types';

/** Default when nobody has said. Neutral, so silence never drives a decision. */
export const DEFAULT_WANT = 3;

/**
 * Below this, a trade is noise.
 *
 * The first version happily offered "skip the post office" to free up a
 * birthday dinner. True, and worth one and a half load out of a fourteen-hour
 * day - which trains someone to ignore the whole list.
 */
const WORTH_A_SWAP = 5;
export const wantOf = (item: Item): number => item.want ?? DEFAULT_WANT;

export const WANT_WORD = ['', 'Rather not', 'Not bothered', 'Neutral', 'Want to', 'Really want to'] as const;

/**
 * Three answers, on a one-to-five scale.
 *
 * The scale has five points because an import can be more precise than a person
 * - a class that gives hints is a 4, an ordinary lecture a 2 - but nobody wants
 * a five-way choice while typing in a dinner. So capture offers the ends and the
 * middle, and the import fills in the rest.
 */
export const WANT_CHOICES: Array<[1 | 3 | 5, string]> = [
  [1, 'Rather not'],
  [3, "Don't mind"],
  [5, 'Really want to'],
];

export interface Skip {
  /** True when missing it costs you nothing you cannot afford. */
  canSkip: boolean;
  /** Why, in words a student would use. Always set, both ways. */
  reason: string;
}

/**
 * Whether this can actually be missed, and what it would cost.
 *
 * The order is deliberate: the things the app refuses to trade come first, so a
 * later rule can never talk its way past them.
 */
export function skippable(item: Item, modules: Module[]): Skip {
  /*
   * Only the hints flag is absolute here.
   *
   * Elsewhere in the app `isProtectedClass` treats "attendance counted" as
   * never-move, which was right while nothing could do the arithmetic. It is
   * wrong now: "counted" is the reason to *check* whether you can afford to
   * miss it, not a reason to refuse to look. So tips short-circuits and
   * attendance falls through to the register below.
   */
  if ((item.flags ?? []).includes('tips')) {
    return { canSkip: false, reason: 'This is the one that gives hints' };
  }

  /*
   * Attendance is checked before `commitment`, and the order is the whole idea.
   *
   * Every timetabled class is stored as a hard commitment, because that is what
   * a timetable is. Checking that first made the app answer "hard deadline" for
   * a lecture the student could demonstrably afford to miss - which is the
   * exact dilemma this file exists to resolve. A class is mandatory when the
   * arithmetic says so, not because it is printed on a timetable.
   */
  const module = item.moduleId ? modules.find((m) => m.id === item.moduleId) : undefined;
  if (module && module.requiredAttendance !== null) {
    const status = attendanceStatus(module);
    if (status === 'below') {
      return { canSkip: false, reason: `Already at ${attendanceRate(module)}%, under the ${module.requiredAttendance}% you need` };
    }
    if (status === 'close') {
      return { canSkip: false, reason: `One more absence takes you under ${module.requiredAttendance}%` };
    }
    const after = Math.round((module.attended / (module.held + 1)) * 100);
    return { canSkip: true, reason: `You would be at ${after}%, still above ${module.requiredAttendance}%` };
  }

  if (item.commitment === 'hard') return { canSkip: false, reason: 'Hard deadline' };

  if (item.repeats) return { canSkip: false, reason: 'Happens every week' };
  if (item.deadline) return { canSkip: false, reason: 'Has a deadline' };
  return { canSkip: true, reason: item.commitment === 'self' ? 'Your own idea' : 'A soft arrangement' };
}

/**
 * The things on a day that could be traded, or traded for.
 *
 * `spread` rather than `isLog` is the test. Sleep, meals and mood arrive as
 * spread rows and are nobody's appointment. A task you added and only have to
 * turn up to also arrives as a log row - but it is a real thing on a real day,
 * and excluding it meant anything typed into capture could never take part in
 * the trade it was rated for.
 */
const realOnly = (dayItems: Item[]): Item[] =>
  dayItems.filter((item) => !item.isRecovery && !item.spread);

export interface Swap {
  /** The thing you would rather be at. */
  keep: Item;
  /** The thing that goes, and what it costs to lose it. */
  drop: Item;
  cost: string;
  /** Load handed back to the day. */
  saves: number;
}

/**
 * The best trade available on one day, or nothing.
 *
 * `keep` is what you most want to be at. `drop` is the thing on that day you
 * would mind least losing *and are allowed to lose*. Both halves have to be
 * true, which is why most days offer nothing - and a day that offers nothing is
 * a useful answer rather than a failure.
 */
export function findSwap(dayItems: Item[], modules: Module[]): Swap | null {
  const real = realOnly(dayItems);
  if (real.length < 2) return null;

  const keep = [...real].sort((a, b) => wantOf(b) - wantOf(a))[0];
  if (wantOf(keep) <= DEFAULT_WANT) return null;

  const drop = real
    .filter((item) => (
      item.id !== keep.id
      && wantOf(item) < wantOf(keep)
      /*
       * Only commitments to other people are traded.
       *
       * Work you owe and study you planned are *moved*, not skipped, and the
       * first version cheerfully offered to drop the seminar prep so you could
       * attend the seminar - on three days out of fourteen. Solo mental work is
       * excluded; a shift, a dinner, a class are all things somebody else would
       * notice, and those are the only honest trades.
       */
      && !item.prepHours
      && !(item.bucket === 'mental' && !item.moduleId)
      && loadOf(item) >= WORTH_A_SWAP
      && skippable(item, modules).canSkip
    ))
    .sort((a, b) => wantOf(a) - wantOf(b) || loadOf(b) - loadOf(a))[0];
  if (!drop) return null;

  return { keep, drop, cost: skippable(drop, modules).reason, saves: loadOf(drop) };
}

/**
 * Why a wanted thing has to be lived with rather than traded around.
 *
 * Returned when there is something you clearly want on a day but nothing on it
 * may be given up. Saying that plainly is worth more than an empty list.
 */
export function whyNoSwap(dayItems: Item[], modules: Module[]): { keep: Item; blocked: Array<{ item: Item; reason: string }> } | null {
  const real = realOnly(dayItems);
  const keep = [...real].sort((a, b) => wantOf(b) - wantOf(a))[0];
  if (!keep || wantOf(keep) <= DEFAULT_WANT) return null;
  const blocked = real
    .filter((item) => item.id !== keep.id)
    .map((item) => ({ item, reason: skippable(item, modules).reason }))
    .filter(({ item }) => !skippable(item, modules).canSkip);
  return blocked.length && !findSwap(dayItems, modules) ? { keep, blocked } : null;
}

export interface DaySwap extends Swap { date: string; }

/**
 * The best trade in a stretch of days, and the day it is on.
 *
 * Rebalance works a week at a time, and a week usually contains at most one
 * honest trade - so rather than listing every day's answer it shows the single
 * biggest one. Ties go to the day where the thing you want is wanted most, then
 * to the trade that hands back the most load.
 */
export function bestSwap(items: Item[], days: string[], modules: Module[]): DaySwap | null {
  const found = days
    .map((date) => {
      const swap = findSwap(items.filter((item) => item.date === date), modules);
      return swap ? { ...swap, date } : null;
    })
    .filter((swap): swap is DaySwap => swap !== null);
  return found.sort((a, b) => wantOf(b.keep) - wantOf(a.keep) || b.saves - a.saves)[0] ?? null;
}

/**
 * The first honest refusal in a stretch of days.
 *
 * Shown when there is nothing to trade, because "you want Thursday off and here
 * is exactly why you cannot have it" is the answer, not the absence of one.
 */
export function firstRefusal(
  items: Item[],
  days: string[],
  modules: Module[],
): { date: string; keep: Item; blocked: Array<{ item: Item; reason: string }> } | null {
  for (const date of days) {
    const why = whyNoSwap(items.filter((item) => item.date === date), modules);
    if (why) return { date, ...why };
  }
  return null;
}
