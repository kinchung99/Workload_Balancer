/**
 * The one place a screen asks "how am I doing".
 *
 * Every reading goes through here so that today's logs are always folded in.
 * Before this existed each screen called `weekReading(items, ...)` directly,
 * which meant logging a meal changed the Physical screen and nothing else.
 */
import { useMemo } from 'react';
import { logItems } from '@/lib/logs';
import { overallPercent, percentByBucket } from '@/lib/load';
import { chargeOf } from '@/lib/battery';
import type { BucketKey, Item } from '@/lib/types';
import { itemsInWeek, useStore } from './store';

export interface Reading {
  /** The week's items with today's logs folded in. */
  items: Item[];
  week: Item[];
  percents: Record<BucketKey, number>;
  overall: number;
  charge: number;
}

/** Build a reading from an explicit item list - used for what-if previews. */
export function readingFrom(items: Item[], anchor: string, ceilings: Record<BucketKey, number>): Reading {
  const week = itemsInWeek(items, anchor);
  const percents = percentByBucket(week, ceilings);
  const overall = overallPercent(percents);
  return { items, week, percents, overall, charge: chargeOf(overall) };
}

export function useReading(anchor?: string): Reading {
  const { items, ceilings, today, sleepHours, meals, moods, errands } = useStore();
  const withLogs = useMemo(
    () => [...items, ...logItems({ today, sleepHours, meals, moods, errands })],
    [items, today, sleepHours, meals, moods, errands],
  );
  return useMemo(
    () => readingFrom(withLogs, anchor ?? today, ceilings),
    [withLogs, anchor, today, ceilings],
  );
}

/** The same list the reading used, for timelines and grids. */
export function useItemsWithLogs(): Item[] {
  const { items, today, sleepHours, meals, moods, errands } = useStore();
  return useMemo(
    () => [...items, ...logItems({ today, sleepHours, meals, moods, errands })],
    [items, today, sleepHours, meals, moods, errands],
  );
}
