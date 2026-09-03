/**
 * The battery reading.
 *
 * Internally everything is load against a ceiling, because that is what can be
 * forecast and traded. On screen it is a battery, because "13% left" is a thing
 * a tired person understands in half a second and "87% of capacity used" is not.
 *
 * They are the same number. charge = 100 - load%.
 */
import { threshold } from '@design/tokens';
import type { BandName, BucketKey } from './types';
import { BUCKETS, bandFor } from './load';

/** Over its ceiling means flat, not negative. */
export const chargeOf = (loadPercent: number): number => Math.max(0, Math.round(100 - loadPercent));

export const CHARGE_LABEL: Record<Exclude<BandName, 'recovery'>, string> = {
  steady: 'Charged',
  busy: 'Draining',
  heavy: 'Running on empty',
};

/** One line under the number. No lecture, no wellbeing language. */
export const CHARGE_NOTE: Record<Exclude<BandName, 'recovery'>, string> = {
  steady: 'Reserves in hand.',
  busy: 'Enough left, but pace yourself.',
  heavy: 'Something has to come off this week.',
};

export const chargeBand = (loadPercent: number) => bandFor(loadPercent);

export const chargeByBucket = (
  percents: Record<BucketKey, number>,
): Record<BucketKey, number> =>
  Object.fromEntries(BUCKETS.map((key) => [key, chargeOf(percents[key])])) as Record<BucketKey, number>;

/**
 * What's pulling you down: the areas over or near their ceiling, worst first,
 * expressed as the charge each one has cost you.
 */
export function drains(percents: Record<BucketKey, number>): Array<{ bucket: BucketKey; cost: number }> {
  return BUCKETS.map((bucket) => ({ bucket, cost: Math.round(percents[bucket]) }))
    .filter((row) => row.cost >= threshold.steadyMax)
    .sort((a, b) => b.cost - a.cost);
}
