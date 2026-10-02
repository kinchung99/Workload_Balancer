/**
 * Drain — the one number only the student can give, said so they will give it.
 *
 * Internally it is `dread`, one to five, and the whole model runs on it: load is
 * hours x dread. On screen it used to be five hollow dots labelled "Fine,
 * honestly" and "Dreading it", asked four different ways in four places, and
 * a new student had no reason to touch it - nothing on the screen changed when
 * they did, and "dread 3" means nothing to anyone.
 *
 * So it is asked one way everywhere, in the battery's own language: how
 * draining is this? Each level has a word and an everyday example, and every
 * picker shows what each answer costs this student's own battery before they
 * choose. The point of the question is visible at the moment it is asked.
 */
import { BUCKETS, overallPercent, percentByBucket } from './load';
import { isSameWeek } from './dates';
import type { BucketKey, Dread, Item } from './types';

export const LEVELS: Dread[] = [1, 2, 3, 4, 5];

/** A word and an example per level. The example does more than the word. */
export const DRAIN: Record<Dread, { word: string; like: string }> = {
  1: { word: 'Easy', like: 'like reading something you enjoy' },
  2: { word: 'Fine', like: 'like a quick errand' },
  3: { word: 'Tiring', like: 'like a normal lecture' },
  4: { word: 'Draining', like: 'like a tough assignment' },
  5: { word: 'Exhausting', like: 'like a presentation you dread' },
};

/** Band colour by level, the same everywhere a drain is drawn: steady, busy, heavy. */
export const drainTone = (level: Dread): 'steady' | 'busy' | 'heavy' =>
  level <= 2 ? 'steady' : level === 3 ? 'busy' : 'heavy';

/**
 * How full a week reads, without the 0-100 clamp the battery applies.
 *
 * The clamp is right for the battery and wrong for a cost: in a week already
 * over the line, every choice would "cost 0%", which is the one answer that
 * would make the question look pointless exactly when it matters most.
 */
const weekLoad = (items: Item[], anchor: string, ceilings: Record<BucketKey, number>): number =>
  overallPercent(percentByBucket(items.filter((item) => isSameWeek(item.date, anchor)), ceilings));

/**
 * What something costs the week's battery at each level, in percentage points.
 *
 * `base` is the week without it; `make(level)` is it at that level - one task,
 * or a module's classes. The difference is what the picker prints under each
 * face, so "Exhausting" visibly costs three times "Easy" before anyone taps.
 */
export function drainCosts(
  base: Item[],
  make: (level: Dread) => Item[],
  anchor: string,
  ceilings: Record<BucketKey, number>,
): Record<Dread, number> {
  const without = weekLoad(base, anchor, ceilings);
  const out = {} as Record<Dread, number>;
  for (const level of LEVELS) {
    out[level] = Math.max(0, Math.round(weekLoad([...base, ...make(level)], anchor, ceilings) - without));
  }
  return out;
}

/** "−6%", or "<1%" for the costs too small to round to a point. */
export const costLabel = (cost: number): string => (cost < 1 ? '<1%' : `−${cost}%`);

/**
 * A mix re-scaled so its strongest area sits at `level`, keeping its shape.
 *
 * The add flow asks for one drain and then where it lands; the five fine-tune
 * dials are still there underneath. They have to agree, so the overall drain
 * is always the strongest area (`dreadFromMix`), and moving the overall drain
 * moves every area in proportion rather than flattening the split.
 */
export function withDrain(
  mix: Record<BucketKey, number>,
  level: Dread,
  fallback: BucketKey,
): Record<BucketKey, number> {
  const strongest = BUCKETS.reduce((a, b) => ((mix[a] ?? 0) >= (mix[b] ?? 0) ? a : b));
  const max = mix[strongest] ?? 0;
  const out: Record<BucketKey, number> = { mental: 0, time: 0, physical: 0, social: 0, errands: 0 };
  if (max <= 0) return { ...out, [fallback]: level };
  for (const key of BUCKETS) {
    const value = mix[key] ?? 0;
    out[key] = value > 0 ? Math.max(1, Math.min(5, Math.round((value * level) / max))) : 0;
  }
  out[strongest] = level;
  return out;
}

/**
 * Tap an area in or out of a mix. In, it takes the current drain; out, it goes
 * to nothing - unless it is the last one, because something has to be drained.
 */
export function toggleArea(mix: Record<BucketKey, number>, area: BucketKey, level: Dread): Record<BucketKey, number> {
  const on = (mix[area] ?? 0) > 0;
  const others = BUCKETS.filter((key) => key !== area && (mix[key] ?? 0) > 0);
  if (on && others.length === 0) return mix;
  return { ...mix, [area]: on ? 0 : level };
}

/** What each area is, in a word, for the "where does it drain you" tiles. */
export const AREA_HINT: Record<BucketKey, string> = {
  mental: 'Your head',
  time: 'Your hours',
  physical: 'Your body',
  social: 'People',
  errands: 'Admin',
};

/**
 * What one thing - and the sittings still ahead of it - costs its week's
 * battery as things stand. "Costs 8% of your week" is the same unit the picker
 * prices in, so a number seen on one screen means the same on the next.
 */
export function batteryCost(items: Item[], item: Item, ceilings: Record<BucketKey, number>): number {
  const anchor = item.deadline ?? item.date;
  const mine = (i: Item) => i.id === item.id || (i.parentId === item.id && !i.sessionDone);
  return Math.max(0, Math.round(weekLoad(items, anchor, ceilings) - weekLoad(items.filter((i) => !mine(i)), anchor, ceilings)));
}
