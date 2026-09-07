/**
 * The What-If simulator.
 *
 * Every other screen tells a student what already happened. This one lets them
 * play with tonight and watch the battery move before committing to anything -
 * the difference between being told to sleep more and seeing what sleeping more
 * is worth.
 *
 * Design note on the maths: this projects directly on charge points rather than
 * running each action back through the bucket model. That is deliberate. The
 * numbers on screen have to add up in the user's head - if a slider says +9 and
 * the battery moves 6, the feature looks broken even when it is right. Charge
 * points are additive and legible; the bucket model stays the authority on the
 * week that actually happened.
 */
import type { BucketKey, SimAction } from './types';

export const ACTIONS: SimAction[] = [
  {
    id: 'sleep',
    logOnly: true,
    label: 'Sleep tonight',
    bucket: 'physical',
    min: 4, max: 10, step: 0.5, baseline: 6, unit: 'h',
    ptsPerUnit: 3,
    goodNote: 'Extra rest boosts mental and body',
    badNote: 'Less sleep drains your reserves',
  },
  {
    id: 'walk',
    preferred: [12, 19],
    label: 'Take a walk',
    bucket: 'physical',
    min: 0, max: 60, step: 10, baseline: 0, unit: 'min',
    ptsPerUnit: 0.2,
    goodNote: 'Fresh air lifts your physical score',
    badNote: 'No walk today',
  },
  {
    id: 'text',
    preferred: [17, 21],
    label: 'Text a friend',
    bucket: 'social',
    min: 0, max: 2, step: 1, baseline: 0, unit: 'h',
    ptsPerUnit: 4,
    goodNote: 'Social connection recharges you',
    badNote: 'Going solo today',
    labels: ['Skip', 'Quick hi', 'Properly'],
  },
  {
    id: 'study',
    preferred: [9, 18],
    label: 'Study session',
    bucket: 'mental',
    min: 0, max: 5, step: 0.5, baseline: 0, unit: 'h',
    ptsPerUnit: -3,
    goodNote: '',
    badNote: 'Gets the work done, at a cost',
  },
  {
    id: 'screen',
    preferred: [20, 23],
    label: 'Late-night screen',
    bucket: 'mental',
    min: 0, max: 4, step: 0.5, baseline: 0, unit: 'h',
    ptsPerUnit: -12,
    goodNote: '',
    badNote: 'Significant disruption to sleep and recovery',
  },
];

export type SimState = Record<string, number>;

export const initialSim = (): SimState =>
  Object.fromEntries(ACTIONS.map((action) => [action.id, action.baseline]));

/** Charge points this action is worth at its current slider position. */
export const pointsOf = (action: SimAction, value: number): number =>
  Math.round((value - action.baseline) * action.ptsPerUnit * 10) / 10;

export const totalPoints = (state: SimState): number =>
  Math.round(
    ACTIONS.reduce((sum, action) => sum + pointsOf(action, state[action.id] ?? action.baseline), 0) * 10,
  ) / 10;

/** Projected charge, clamped to a real battery's range. */
export const project = (charge: number, state: SimState): number =>
  Math.max(0, Math.min(100, Math.round(charge + totalPoints(state))));

/** The value under the slider, as words where words read better than a number. */
export function readout(action: SimAction, value: number): string {
  if (action.labels) return action.labels[Math.round(value)] ?? String(value);
  if (value === 0) return 'Skip';
  return action.unit === 'min' ? `${value} min` : `${value} hrs`;
}

/** The line under the slider: what this choice buys, or what it costs. */
export function note(action: SimAction, value: number): { text: string; points: number } {
  const points = pointsOf(action, value);
  return { text: points > 0 ? action.goodNote : action.badNote, points };
}

/** Which bucket a plan mostly helps, for the summary line. */
export function busiestBucket(state: SimState): BucketKey | null {
  const totals = new Map<BucketKey, number>();
  for (const action of ACTIONS) {
    const points = pointsOf(action, state[action.id] ?? action.baseline);
    if (points === 0) continue;
    totals.set(action.bucket, (totals.get(action.bucket) ?? 0) + points);
  }
  const best = [...totals.entries()].sort((a, b) => b[1] - a[1])[0];
  return best ? best[0] : null;
}
