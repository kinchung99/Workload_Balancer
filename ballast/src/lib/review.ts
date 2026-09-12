/**
 * The evening question, and what it is allowed to change.
 *
 * Every planner is confidently wrong about the same thing: it assumes the way it
 * ranks your work is correct, and when you ignore its order it concludes you
 * lack discipline. The order is a guess. It was assembled out of four factors
 * and some multipliers, by people who have never met you.
 *
 * So once a day, late, the app asks one question with three answers, and the
 * answer moves the multipliers. Somebody who keeps saying the days were too full
 * gets an app that leans harder on what they actually want to be at. Somebody
 * who keeps saying they did the wrong things first gets one that leans harder on
 * deadlines. After a fortnight the ranking is theirs rather than ours, and it got
 * there on about twelve taps.
 *
 * Two rules keep it honest:
 *
 *   1. **The weights are bounded.** One bad evening cannot rewrite how the app
 *      thinks, and thirty good ones cannot flatten a deadline to nothing.
 *   2. **Answering less often is a reward.** A student who is keeping to their
 *      plan gets asked twice a week. The app earns the right to interrupt by
 *      being useful, and gives it up when it isn't needed.
 *
 * On the LLM this was designed around: the reasoning it would do here - reading
 * a sentence of feedback and deciding which factor it indicts - is the whole
 * job, and it is worth doing properly. It is not worth a network round trip, a
 * key, and a screen that fails when the wifi does. The three answers below are
 * the same decision with the ambiguity removed, and they work on a train. A
 * free-text box that an on-device model interprets is the upgrade, not the
 * premise.
 */
import type { DayReport, Item, Weights } from './types';

/** Not before this. An evening review at four in the afternoon is a guess. */
export const REVIEW_FROM_HOUR = 20;

export type Verdict = 'good' | 'too-much' | 'wrong-order';

export const VERDICT: Array<{ value: Verdict; word: string; note: string }> = [
  { value: 'good', word: 'That worked', note: 'Keep ranking things this way' },
  { value: 'too-much', word: 'Too full', note: 'Protect what I want to be at' },
  { value: 'wrong-order', word: 'Wrong order', note: 'Push deadlines harder' },
];

/** Neutral. Every factor counted exactly as designed until someone says otherwise. */
export const DEFAULT_WEIGHTS: Weights = { urgency: 1, importance: 1, want: 1 };

/** How far one answer moves a weight, and how far the weights may ever travel. */
const STEP = 0.12;
const FLOOR = 0.6;
const CEILING = 1.6;

const clamp = (value: number): number =>
  Math.round(Math.min(CEILING, Math.max(FLOOR, value)) * 100) / 100;

/**
 * One evening's answer, as a nudge.
 *
 * "Too full" is read as *the things I did were not the things worth doing*, so
 * what you want to be at counts for more and raw importance for less. "Wrong
 * order" is read as *I did the wrong thing first*, which is a deadline problem.
 * "That worked" is not a no-op: it pulls everything gently back towards neutral,
 * so a run of good days slowly undoes an over-correction nobody remembers making.
 */
export function retune(current: Weights, verdict: Verdict): Weights {
  if (verdict === 'too-much') {
    return {
      urgency: clamp(current.urgency),
      importance: clamp(current.importance - STEP),
      want: clamp(current.want + STEP),
    };
  }
  if (verdict === 'wrong-order') {
    return {
      urgency: clamp(current.urgency + STEP),
      importance: clamp(current.importance + STEP / 2),
      want: clamp(current.want - STEP / 2),
    };
  }
  const settle = (value: number): number => clamp(value + (1 - value) * 0.25);
  return { urgency: settle(current.urgency), importance: settle(current.importance), want: settle(current.want) };
}

/** The weights implied by every evening answered so far, oldest first. */
export const weightsFrom = (reports: DayReport[]): Weights =>
  reports.reduce<Weights>(
    (weights, report) => (report.verdict ? retune(weights, report.verdict) : weights),
    DEFAULT_WEIGHTS,
  );

/** What the app has learned, in one sentence, or nothing if it has learned nothing. */
export function describeWeights(weights: Weights): string | null {
  const moves: Array<[number, string]> = [
    [weights.urgency - 1, 'deadlines count more'],
    [1 - weights.urgency, 'deadlines count less'],
    [weights.want - 1, 'what you want to be at counts more'],
    [1 - weights.want, 'what you want to be at counts less'],
  ];
  const [size, phrase] = moves.sort((a, b) => b[0] - a[0])[0];
  return size >= STEP ? phrase.charAt(0).toUpperCase() + phrase.slice(1) : null;
}

/**
 * Whether the plan got followed. Sittings booked for days now past, and how
 * many were actually marked done.
 *
 * Measured off work the student booked themselves rather than anything the app
 * assigned, so it is a record of their own plan and not of their obedience.
 */
export function adherence(items: Item[], today: string): { kept: number; booked: number; rate: number } {
  const past = items.filter((item) => item.parentId && item.date < today);
  const kept = past.filter((item) => item.sessionDone).length;
  return {
    kept,
    booked: past.length,
    // No history is not bad history. An app that opens by assuming you are
    // failing is an app people close.
    rate: past.length ? Math.round((kept / past.length) * 100) / 100 : 1,
  };
}

/**
 * How many days between evening questions.
 *
 * The one piece of Adam's discipline tracking worth keeping, inverted. Tracking
 * a student's discipline and reminding them about it more when it slips is how
 * you build something that feels like a disappointed parent. The same number
 * read the other way is a promise: keep to your plan and this app will leave you
 * alone. Drift, and it will ask more often - which is the only moment a question
 * is worth anything anyway.
 */
export const reviewEvery = (rate: number): number => (rate >= 0.8 ? 3 : rate >= 0.5 ? 2 : 1);

export const CADENCE_WORD = (rate: number): string =>
  rate >= 0.8 ? 'Asking every few days' : rate >= 0.5 ? 'Asking every other day' : 'Asking each evening';

/**
 * Whether to ask tonight.
 *
 * Late enough that the day is over, not already answered, and not sooner than
 * this student's own cadence allows.
 */
export function dueForReview(
  reports: DayReport[],
  today: string,
  hour: number,
  rate: number,
): boolean {
  if (hour < REVIEW_FROM_HOUR) return false;
  if (reports.some((report) => report.date === today)) return false;
  const answered = reports.filter((report) => report.verdict);
  const last = answered[answered.length - 1];
  if (!last) return true;
  const gap = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${last.date}T00:00:00Z`)) / 86_400_000);
  return gap >= reviewEvery(rate);
}
