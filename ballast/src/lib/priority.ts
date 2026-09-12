/**
 * What to do first, and what to put down.
 *
 * Every other screen answers "how is my week". This one answers the question a
 * student actually asks at 9am: *of all of this, what do I start with?*
 *
 * A to-do list sorts by the order things were typed. A calendar sorts by clock
 * time, which is not the same as importance. Neither knows that a two-hour job
 * due tomorrow beats a nine-hour job due next week, or that the thing you should
 * genuinely move is the one that costs the most and nobody is expecting.
 *
 * So this scores everything on one scale, and the score is made of things a
 * student would recognise as reasons - which is why every row can say why it is
 * where it is.
 */
import { BUCKET_LABEL, isMovable, loadOf } from './load';
import { daysLeft, isAtRisk, needsPrep, remaining } from './prep';
import { daysBetween } from './dates';
import { isProtectedClass } from './timetable';
import type { Item } from './types';

export type Urgency = 'today' | 'tomorrow' | 'soon' | 'later';

export interface Ranked {
  item: Item;
  score: number;
  /** Short phrases explaining the score, strongest first. Shown as chips. */
  reasons: string[];
  /** What kind of thing this is, which decides what the button does. */
  kind: 'owing' | 'fixed' | 'loose';
  /** Hours it would give you back if you moved or dropped it. */
  saves: number;
}

/**
 * How much closer a deadline makes something.
 *
 * The curve has to fall below 1, not merely flatten. With a floor of 1, size
 * won every argument: a nine-load job six days away outranked a three-load job
 * due tomorrow, which is exactly backwards for anything with a fixed date -
 * Saturday's errand is not something you can do today, however big it is.
 *
 * So it is steep at the near end and genuinely small at the far end. Work with
 * preparation stays near the top anyway, because its size is the hours still
 * owed rather than its load, and six hours owed is a big number.
 */
export const urgencyFactor = (days: number): number => {
  if (days <= 0) return 3;
  if (days === 1) return 2.2;
  if (days === 2) return 1.6;
  if (days === 3) return 1.15;
  if (days <= 5) return 0.8;
  if (days <= 7) return 0.55;
  return 0.35;
};

/** A promise to somebody else outranks a promise to yourself. */
const COMMITMENT_FACTOR = { hard: 1.6, soft: 1.2, self: 1 } as const;

/** Set on capture, for exactly this moment. */
const IMPORTANCE_FACTOR = { 1: 0.8, 2: 1, 3: 1.35 } as const;

/** Not being able to finish it in the time left is the loudest signal there is. */
const AT_RISK_BONUS = 40;

const dueLabel = (days: number): string =>
  days <= 0 ? 'Due today' : days === 1 ? 'Due tomorrow' : `${days} days left`;

/**
 * One score, and the reasons it is that score.
 *
 * `weight` is the size of the thing: hours still owed for work with preparation,
 * its load otherwise. Everything else multiplies it.
 */
export function rank(item: Item, items: Item[], today: string): Ranked {
  const owing = needsPrep(item);
  const days = owing ? daysLeft(item, today) : Math.max(0, daysBetween(today, item.date));
  const weight = owing ? remaining(item) * 3 : Math.abs(loadOf(item));
  const risk = owing && isAtRisk(item, items, today);

  const score =
    weight *
      urgencyFactor(days) *
      COMMITMENT_FACTOR[item.commitment] *
      IMPORTANCE_FACTOR[item.importance ?? 2] +
    (risk ? AT_RISK_BONUS : 0);

  const reasons: string[] = [];
  if (risk) reasons.push('Not enough time left');
  if (days <= 2) reasons.push(dueLabel(days));
  if (item.commitment === 'hard') reasons.push('Hard deadline');
  if ((item.importance ?? 2) === 3) reasons.push('Really matters');
  if (owing) reasons.push(`${remaining(item)}h to go`);
  if (!owing && item.startHour === undefined) reasons.push('No time yet');
  if (reasons.length === 0) reasons.push(dueLabel(days));

  return {
    item,
    score: Math.round(score * 10) / 10,
    reasons: reasons.slice(0, 3),
    kind: owing ? 'owing' : item.startHour === undefined ? 'loose' : 'fixed',
    saves: Math.round(Math.abs(loadOf(item)) * 10) / 10,
  };
}

/** Only things a student could act on. Background load and logs are not choices. */
const isActionable = (item: Item, today: string): boolean =>
  !item.repeats &&
  !item.spread &&
  !item.isLog &&
  !item.isRecovery &&
  !item.parentId &&
  !item.sessionDone &&
  (needsPrep(item) || (item.date >= today && (item.deadline === undefined || needsPrep(item))));

/**
 * The list, in two halves.
 *
 * `first` is what to start with. `couldMove` is the other half of the same
 * question and the one no planner asks: of everything here, which are you
 * actually allowed to move, and what would it give you back? Hard deadlines and
 * the lectures where hints get given never appear in it.
 */
export function prioritise(
  items: Item[],
  today: string,
  horizonDays = 7,
): { first: Ranked[]; couldMove: Ranked[] } {
  const horizon = items.filter((item) => {
    if (!isActionable(item, today)) return false;
    const days = needsPrep(item) ? daysLeft(item, today) : daysBetween(today, item.date);
    return days >= 0 && days <= horizonDays;
  });

  const ranked = horizon.map((item) => rank(item, items, today)).sort((a, b) => b.score - a.score);

  const couldMove = ranked
    .filter((row) => isMovable(row.item) && !isProtectedClass(row.item) && row.saves > 0)
    .sort((a, b) => b.saves - a.saves);

  return { first: ranked, couldMove };
}

/** "Mental · 8 load" — the one line under a title. */
export const rankedDetail = (row: Ranked): string =>
  `${BUCKET_LABEL[row.item.bucket]} · ${row.saves} load`;
