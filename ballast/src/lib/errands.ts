/**
 * Sorting errands into batches.
 *
 * The interface study hands this to an LLM. It is a keyword dictionary here, for
 * the same reason the capture parser is: the rule-based version has to work on
 * its own, offline, in a basement lecture theatre, and a wrong guess costs one
 * tap to fix because the category is shown as a chip rather than applied
 * silently.
 */
import type { Errand, ErrandCategory } from './types';

const WORDS: Record<ErrandCategory, string[]> = {
  Groceries: ['milk', 'bread', 'shop', 'shopping', 'grocer', 'food', 'veg', 'fruit', 'snack', 'dinner', 'cook', 'tesco', 'aldi', 'market'],
  Admin: ['bank', 'bill', 'pay', 'landlord', 'rent', 'insurance', 'phone', 'contract', 'form', 'renew', 'passport', 'tax', 'appointment', 'doctor', 'dentist', 'pharmacy', 'prescription'],
  Academic: ['print', 'library', 'book', 'lab', 'report', 'email prof', 'tutor', 'lecturer', 'submit', 'coursework', 'register', 'module'],
  Home: ['laundry', 'washing', 'bins', 'clean', 'tidy', 'hoover', 'dishes', 'kitchen', 'bathroom', 'bed', 'repair', 'fix'],
};

/** Longest match wins, so "print lab report" beats a stray "book". */
export function categorise(title: string): ErrandCategory {
  const lower = title.toLowerCase();
  let best: { category: ErrandCategory; score: number } = { category: 'Admin', score: 0 };
  for (const [category, words] of Object.entries(WORDS) as Array<[ErrandCategory, string[]]>) {
    for (const word of words) {
      if (lower.includes(word) && word.length > best.score) best = { category, score: word.length };
    }
  }
  return best.category;
}

/** A small thing still takes a slice of a small ceiling. Default twenty minutes. */
export const DEFAULT_ERRAND_HOURS = 0.33;
const DEFAULT_EFFORT = 2;

export const EFFORTS: Array<[1 | 2 | 3, string]> = [
  [1, 'Easy'],
  [2, 'Normal'],
  [3, 'Dreading it'],
];

/** Same shape as everything else: hours multiplied by how much you mind it. */
export const errandLoad = (errand: Errand): number =>
  Math.round((errand.hours ?? DEFAULT_ERRAND_HOURS) * (errand.effort ?? DEFAULT_EFFORT) * 10) / 10;

/**
 * What ticking one off gives back.
 *
 * Clearing your own errand simply stops it costing you. A seeded one never cost
 * anything, so finishing it would otherwise do nothing at all - and a list where
 * completing something changes no number is a list nobody keeps. Both pay out
 * the same way: the weight of the thing, credited.
 */
export const completionCredit = (errand: Errand): number =>
  errand.addedByUser ? 0 : errandLoad(errand);

/** Still outstanding, added by the student, and not yet given a slot. */
export const isFloating = (errand: Errand): boolean =>
  !!errand.addedByUser && !errand.done && errand.startHour === undefined;

/** Everything the student added that is still outstanding, slot or not. */
export const openErrands = (errands: Errand[]): Errand[] =>
  errands.filter((errand) => errand.addedByUser && !errand.done);

/**
 * The weight of what you added and have not done.
 *
 * Only the unscheduled ones: an errand with a time becomes a block on that day
 * and is counted there instead, so it is never charged twice.
 */
export const outstandingLoad = (errands: Errand[]): number =>
  Math.round(errands.filter(isFloating).reduce((total, errand) => total + errandLoad(errand), 0) * 10) / 10;

/** Added, undone, and pinned to a time - these belong on the timeline. */
export const scheduledErrands = (errands: Errand[]): Errand[] =>
  errands.filter((errand) => errand.addedByUser && !errand.done && errand.startHour !== undefined);
