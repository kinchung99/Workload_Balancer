/**
 * Where the battery goes, as lines that add up.
 *
 * The battery is a plain sum - everything in the week costs its load out of one
 * weekly capacity - so it can be read back as a short list: classes took this
 * much, study that much, sleep gave some back. Each line is split into what has
 * already happened and what is still to come, which is the difference between
 * "I am tired" and "I am going to be".
 *
 * The lines are rounded so that they add up to the headline exactly. A list of
 * parts that misses its own total by a percent is a list nobody trusts.
 */
import { capacityOf, loadOf } from './load';
import { markKind } from './marking';
import { endHour } from './schedule';
import type { BucketKey, Item } from './types';

export type SpendKey =
  | 'class' | 'study' | 'shift' | 'errand' | 'social' | 'body' | 'rest'
  | 'sleep' | 'food' | 'mood' | 'moments';

/** One picture and two words per line. */
export const SPEND: Record<SpendKey, { emoji: string; label: string }> = {
  class: { emoji: '🎓', label: 'Classes' },
  study: { emoji: '📚', label: 'Study' },
  shift: { emoji: '💼', label: 'Work & travel' },
  errand: { emoji: '🧺', label: 'Errands' },
  social: { emoji: '👥', label: 'People' },
  body: { emoji: '🏃', label: 'Exercise' },
  rest: { emoji: '🌿', label: 'Rest' },
  sleep: { emoji: '😴', label: 'Sleep' },
  food: { emoji: '🍱', label: 'Food' },
  mood: { emoji: '🙂', label: 'Mood' },
  moments: { emoji: '✨', label: 'Good moments' },
};

/** Which line something belongs on. */
export function spendKey(item: Item): SpendKey {
  if (item.isLog) {
    if (item.id === 'log-sleep') return 'sleep';
    if (item.id === 'log-meals') return 'food';
    if (item.id === 'log-mood') return 'mood';
    if (item.id.startsWith('log-moment')) return 'moments';
    if (item.id.startsWith('log-errand')) return 'errand';
  }
  if (item.isRecovery) return 'rest';
  switch (markKind(item)) {
    case 'class': return 'class';
    case 'sitting':
    case 'work': return 'study';
    case 'shift': return 'shift';
    case 'errand': return 'errand';
    case 'social': return 'social';
    default: return 'body';
  }
}

/** Has it already happened? Today's logs have; a thing with no time today has not yet. */
export function isSpent(item: Item, today: string, hour: number): boolean {
  if (item.outcome === 'done' || item.outcome === 'partial' || item.outcome === 'missed') return true;
  if (item.isLog) return true;
  if (!item.date) return false;
  if (item.date !== today) return item.date < today;
  return item.startHour !== undefined && endHour(item) <= hour;
}

export interface SpendLine {
  key: SpendKey;
  /** Battery points, signed: positive uses the battery, negative gives back. */
  percent: number;
  /** Of which already happened, and still to come. */
  spent: number;
  ahead: number;
}

export interface Breakdown {
  /** Costs first, biggest first; then what gave back. */
  lines: SpendLine[];
  /** Points used by what has already happened, and by what is still to come. */
  spent: number;
  ahead: number;
  /** Points given back - sleep, food, mood, rest, good moments. */
  back: number;
  /** What is left, 0-100. */
  left: number;
  /** The single things that cost the most. */
  top: Array<{ item: Item; percent: number }>;
}

/** Round a list so it still adds up to its rounded total, nudging the biggest part. */
function roundTo(values: number[], total: number): number[] {
  const rounded = values.map((value) => Math.round(value));
  const drift = Math.round(total) - rounded.reduce((a, b) => a + b, 0);
  if (drift && rounded.length) {
    const biggest = values.reduce((best, value, index) => (Math.abs(value) > Math.abs(values[best]) ? index : best), 0);
    rounded[biggest] += drift;
  }
  return rounded;
}

/** The week's battery, read back as lines. `week` is the reading's week, logs included. */
export function breakdown(week: Item[], ceilings: Record<BucketKey, number>, today: string, hour: number): Breakdown {
  const capacity = capacityOf(ceilings);
  const sums = new Map<SpendKey, { spent: number; ahead: number }>();
  const costs: Array<{ item: Item; percent: number }> = [];
  let usedSoFar = 0;
  let back = 0;

  for (const item of week) {
    const percent = (loadOf(item) / capacity) * 100;
    if (!percent) continue;
    const key = spendKey(item);
    const line = sums.get(key) ?? { spent: 0, ahead: 0 };
    const spent = isSpent(item, today, hour);
    if (spent) line.spent += percent;
    else line.ahead += percent;
    sums.set(key, line);
    if (percent < 0) back -= percent;
    else if (spent) usedSoFar += percent;
    if (percent > 0 && !item.isLog) costs.push({ item, percent });
  }

  const raw = [...sums.entries()].map(([key, { spent, ahead }]) => ({ key, spent, ahead, percent: spent + ahead }));
  const total = raw.reduce((sum, line) => sum + line.percent, 0);
  const shown = roundTo(raw.map((line) => line.percent), total);
  const lines = raw
    .map((line, index) => ({ ...line, percent: shown[index] }))
    .filter((line) => line.percent !== 0)
    .sort((a, b) => (Math.sign(b.percent) - Math.sign(a.percent)) || Math.abs(b.percent) - Math.abs(a.percent));

  // Rounded so that used + to come - given back + left is exactly a hundred.
  const left = Math.max(0, Math.min(100, 100 - Math.round(total)));
  const spentRounded = Math.round(usedSoFar);
  const backRounded = Math.round(back);
  return {
    lines,
    spent: spentRounded,
    ahead: Math.max(0, 100 - left - spentRounded + backRounded),
    back: backRounded,
    left,
    top: costs.sort((a, b) => b.percent - a.percent).slice(0, 3),
  };
}

/** "−4%" for a cost, "+3%" for something that gives back, "0%" for nothing. */
export const batteryWord = (percent: number): string => {
  const rounded = Math.round(percent);
  return rounded > 0 ? `−${rounded}%` : rounded < 0 ? `+${-rounded}%` : '0%';
};
