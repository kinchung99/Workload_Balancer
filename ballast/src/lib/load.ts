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
import type { BandName, BucketKey, Dread, Item, Mix } from './types';

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

/**
 * The whole model, in one line.
 *
 * Two exceptions, both signed. A log states its own figure because a short night
 * has no "hours" to multiply. And recovery is negative: the study's fourth band
 * is "Recovery - load you get back", so an hour of swimming returns capacity
 * rather than spending it. Booking rest raises the battery, which is the only
 * behaviour that makes the feature mean anything.
 */
export const loadOf = (item: Pick<Item, 'hours' | 'dread' | 'loadOverride' | 'isRecovery'>): number => {
  if (item.loadOverride !== undefined) return Math.round(item.loadOverride * 10) / 10;
  const raw = Math.round(item.hours * item.dread * 10) / 10;
  return item.isRecovery ? -raw : raw;
};

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

/** Top of the per-area drain scale at capture. Five areas, nought to five each. */
export const MIX_MAX = 5;

/** The word under each notch. Plain language, because a number means nothing here. */
export const MIX_WORD = ['Nothing', 'A bit', 'Some', 'A fair bit', 'A lot', 'Everything'] as const;

/**
 * The mix as proportions that sum to one.
 *
 * Returns null when there is nothing to split by - no mix, or one that is all
 * zeroes - and the caller falls back to the single bucket. Both are real: a
 * seeded item has never been through capture, and a student who drags nothing
 * has not answered the question.
 */
export function mixShares(mix: Mix | undefined): Record<BucketKey, number> | null {
  if (!mix) return null;
  const total = BUCKETS.reduce((sum, key) => sum + Math.max(0, mix[key] ?? 0), 0);
  if (total <= 0) return null;
  const out = { mental: 0, time: 0, errands: 0, social: 0, physical: 0 };
  for (const key of BUCKETS) out[key] = Math.max(0, mix[key] ?? 0) / total;
  return out;
}

/**
 * Dread, read off the mix rather than asked for separately.
 *
 * The worst area is the dread. Something that takes a fair bit out of three
 * areas is not three times as bad as one that takes a fair bit out of one - it
 * is the same weight, landing in three places. That distinction is exactly what
 * the five buckets exist to show, and collapsing it into a bigger total would
 * throw it away.
 */
export function dreadFromMix(mix: Mix | undefined): Dread {
  const worst = BUCKETS.reduce((most, key) => Math.max(most, mix?.[key] ?? 0), 0);
  return Math.min(5, Math.max(1, Math.round(worst))) as Dread;
}

/** The loudest area. Keeps the icon, the filters and the old single-bucket code honest. */
export function dominantArea(mix: Mix | undefined, fallback: BucketKey): BucketKey {
  const shares = mixShares(mix);
  if (!shares) return fallback;
  return BUCKETS.reduce((a, b) => (shares[a] >= shares[b] ? a : b));
}

/**
 * The mix, short enough for a row: "Mental & social", "Mental & 3 areas".
 *
 * A thing that costs you in three places should say so where you see it, not
 * only inside the model. Kept under about twenty characters so it can sit in
 * the same slot the single area label used to.
 */
export function shortMix(mix: Mix | undefined, fallback: BucketKey): string {
  const shares = mixShares(mix);
  if (!shares) return BUCKET_LABEL[fallback];
  const ranked = BUCKETS.filter((key) => shares[key] > 0).sort((a, b) => shares[b] - shares[a]);
  const lead = BUCKET_LABEL[ranked[0]];
  if (ranked.length === 1) return lead;
  if (ranked.length === 2) return `${lead} & ${BUCKET_LABEL[ranked[1]].toLowerCase()}`;
  if (ranked.length === 3) return `${lead}, ${BUCKET_LABEL[ranked[1]].toLowerCase()} & ${BUCKET_LABEL[ranked[2]].toLowerCase()}`;
  return `${lead} & ${ranked.length - 1} areas`;
}

/** "Mostly mental, some social" - the mix as a sentence, for rows and screen readers. */
export function describeMix(mix: Mix | undefined, fallback: BucketKey): string {
  const shares = mixShares(mix);
  if (!shares) return BUCKET_LABEL[fallback];
  const ranked = BUCKETS.filter((key) => shares[key] > 0).sort((a, b) => shares[b] - shares[a]);
  if (ranked.length === 1) return BUCKET_LABEL[ranked[0]];
  const [first, ...rest] = ranked;
  const lead = shares[first] >= 0.5 ? 'Mostly' : 'Part';
  return `${lead} ${BUCKET_LABEL[first].toLowerCase()}, some ${rest.map((k) => BUCKET_LABEL[k].toLowerCase()).join(' and ')}`;
}

/**
 * Load, landed in the areas it actually costs.
 *
 * The single choke point for the whole five-bucket reading: every bar, battery,
 * ceiling and warning in the app comes through here. An item with a mix is
 * split by it; an item without one behaves exactly as it always did.
 */
export function loadByBucket(items: Item[]): Record<BucketKey, number> {
  const out = { mental: 0, time: 0, errands: 0, social: 0, physical: 0 };
  for (const item of items) {
    const load = loadOf(item);
    const shares = mixShares(item.mix);
    if (!shares) {
      out[item.bucket] += load;
      continue;
    }
    for (const key of BUCKETS) out[key] += load * shares[key];
  }
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
