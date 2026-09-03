/**
 * The load model. Everything on every screen is derived from here.
 *
 *   load = hours x dread
 *
 * An hour of laundry and an hour of a group presentation are not the same hour.
 * Every planner ever built measures hours, which is exactly why none of them can
 * tell a student they are about to break.
 */
import { threshold } from '@design/tokens';
import type { BandName, BucketKey, Item } from './types';

export const BUCKETS: BucketKey[] = ['mental', 'time', 'errands', 'social', 'physical'];

export const BUCKET_LABEL: Record<BucketKey, string> = {
  mental: 'Mental',
  time: 'Time',
  errands: 'Errands',
  social: 'Social',
  physical: 'Physical',
};

export const COMMITMENT_LABEL: Record<Item['commitment'], string> = {
  hard: 'Hard deadline',
  soft: 'Soft',
  self: 'Self-imposed',
};

/** The whole model, in one line. */
export const loadOf = (item: Pick<Item, 'hours' | 'dread'>): number =>
  Math.round(item.hours * item.dread * 10) / 10;

/**
 * Amira's ceilings, in load units per week.
 *
 * The starting line is generic; these are hers after ten weeks of calibration.
 * If she reports feeling flattened at 70% twice, 70% becomes her red line - see
 * `recalibrate`. Buckets carry separate ceilings because someone at 60% overall
 * but 100% mental is closer to the edge than someone sitting evenly at 75%.
 */
export const DEFAULT_CEILINGS: Record<BucketKey, number> = {
  mental: 100,
  time: 100,
  errands: 25,
  social: 50,
  physical: 39,
};

/** Overall ceiling. Personal, and it moves. */
export const DEFAULT_OVERALL_CEILING = 85;

export const sumLoad = (items: Item[]): number =>
  Math.round(items.reduce((total, item) => total + loadOf(item), 0) * 10) / 10;

export function loadByBucket(items: Item[]): Record<BucketKey, number> {
  const out = { mental: 0, time: 0, errands: 0, social: 0, physical: 0 };
  for (const item of items) out[item.bucket] += loadOf(item);
  for (const key of BUCKETS) out[key] = Math.round(out[key] * 10) / 10;
  return out;
}

export function percentByBucket(
  items: Item[],
  ceilings: Record<BucketKey, number> = DEFAULT_CEILINGS,
): Record<BucketKey, number> {
  const load = loadByBucket(items);
  const out = { mental: 0, time: 0, errands: 0, social: 0, physical: 0 };
  for (const key of BUCKETS) out[key] = Math.round((load[key] / ceilings[key]) * 100);
  return out;
}

/**
 * One honest number from five bucket readings.
 *
 * Not a plain average: the worst bucket counts for half. That is the whole
 * "shape beats total" claim made arithmetic. A student sitting evenly at 75%
 * reads 75%; a student at 60% average with one bucket at 100% reads 80%, and
 * they are in fact closer to the edge.
 */
export function overallPercent(percents: Record<BucketKey, number>): number {
  const values = BUCKETS.map((key) => percents[key]);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const worst = Math.max(...values);
  return Math.round((mean + worst) / 2);
}

export function bandFor(percent: number): Exclude<BandName, 'recovery'> {
  if (percent < threshold.steadyMax) return 'steady';
  if (percent <= threshold.busyMax) return 'busy';
  return 'heavy';
}

export const BAND_LABEL: Record<BandName, string> = {
  steady: 'Steady',
  busy: 'Busy',
  heavy: 'Heavy',
  recovery: 'Recovery',
};

/** Above this the interface collapses to one number, one sentence, one button. */
export const isCalm = (percent: number): boolean => percent >= threshold.calmMode;

/** Hard deadlines are locked. The app will never propose skipping the presentation. */
export const isMovable = (item: Item): boolean => item.commitment !== 'hard';

/**
 * Charts that can be spoken. Every visualisation has a written equivalent, not
 * a label, and VoiceOver reads this sentence instead of the picture.
 */
export function speakBuckets(percents: Record<BucketKey, number>): string {
  return BUCKETS.map(
    (key) => `${BUCKET_LABEL[key]}, ${BAND_LABEL[bandFor(percents[key])].toLowerCase()}, ${percents[key]}% of ceiling.`,
  ).join(' ');
}

/**
 * Your ceiling moves. Report feeling flattened at 70% twice and 70% becomes
 * your red line, rather than the app insisting you still have headroom.
 */
export function recalibrate(current: number, hardDayPercents: number[]): number {
  const hardTwice = hardDayPercents.filter((p) => p < current);
  if (hardTwice.length < 2) return current;
  return Math.min(current, Math.round(Math.max(...hardTwice.slice(-2))));
}

/** The one sentence under the big number. Names the overloaded bucket and its fix. */
export function diagnose(percents: Record<BucketKey, number>): {
  headline: string;
  detail: string;
} | null {
  const over = BUCKETS.filter((key) => percents[key] > 100).sort((a, b) => percents[b] - percents[a]);
  if (over.length === 0) return null;
  const worst = over[0];
  const rest = BUCKETS.filter((key) => key !== worst);
  const allElseHasRoom = rest.every((key) => percents[key] < threshold.busyMax);
  const detail: Record<BucketKey, string> = {
    mental: 'This is a thinking problem, not a doing problem.',
    time: 'There are not enough hours, not too much to think about.',
    errands: 'Small things, too many of them, mostly batchable.',
    social: 'You are seeing people. You are not resting.',
    physical: 'Your body is carrying this week, not your head.',
  };
  return {
    headline: `${BUCKET_LABEL[worst]} load is over its own limit.`,
    detail: allElseHasRoom ? `Everything else has room. ${detail[worst]}` : detail[worst],
  };
}
