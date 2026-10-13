/**
 * How much something matters to you, on four steps a person can pick at a glance.
 *
 * It replaces "want to be there", which was asked only of things you turn up to
 * and answered on a scale nobody could tell apart. Importance is asked of
 * everything, and it is the second thing the lists sort by after time: what to
 * do first leans towards what matters, and what could move offers what matters
 * least.
 */
import type { Importance, Item } from './types';

export const IMPORTANCE_LEVELS: Array<{ value: Importance; emoji: string; word: string; note: string }> = [
  { value: 1, emoji: '🍃', word: 'Optional', note: 'Fine to drop' },
  { value: 2, emoji: '🙂', word: 'Normal', note: 'Rather keep it' },
  { value: 3, emoji: '⭐', word: 'Important', note: 'It matters' },
  { value: 4, emoji: '🔥', word: 'Must', note: 'Can’t miss it' },
];

export const importanceWord = (value: Importance): string =>
  IMPORTANCE_LEVELS.find((level) => level.value === value)?.word ?? 'Normal';

/**
 * An item's importance: set, or read from the older "want" answer, or normal.
 *
 * Anything saved before importance was asked of everything still has a want;
 * "really want to" reads as a must and "rather not" as optional, so old weeks
 * sort the way their owners meant.
 */
export function importanceOf(item: Pick<Item, 'importance' | 'want'>): Importance {
  if (item.importance) return item.importance;
  if (item.want === undefined) return 2;
  return item.want <= 1 ? 1 : item.want <= 3 ? 2 : item.want === 4 ? 3 : 4;
}

/** The matching "want", so the trade logic that reads it keeps working. */
export const wantFor = (importance: Importance): 1 | 3 | 4 | 5 =>
  ({ 1: 1, 2: 3, 3: 4, 4: 5 } as const)[importance];
