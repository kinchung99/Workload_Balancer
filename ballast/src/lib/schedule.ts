/**
 * The time layer.
 *
 * Load answers "how much are you carrying". This answers "when", which is the
 * question a student actually opens an app to ask. Everything here derives from
 * the same `items` the rest of the app uses - there is no second calendar.
 */
import { addDays, dayIndex } from './dates';
import { loadOf } from './load';
import type { Item } from './types';

/** The window a student's day is drawn in. Nothing useful happens at 4am. */
export const DAY_START = 7;
export const DAY_END = 23;

export function formatHour(hour: number): string {
  const whole = Math.floor(hour);
  const minutes = Math.round((hour - whole) * 60);
  const suffix = whole >= 12 ? 'pm' : 'am';
  const display = whole % 12 === 0 ? 12 : whole % 12;
  return minutes ? `${display}:${String(minutes).padStart(2, '0')}${suffix}` : `${display}${suffix}`;
}

export const endHour = (item: Item): number => (item.startHour ?? 0) + item.hours;

/** "5pm to 11pm", or "4h, anytime" when it has no slot. */
export function timeLabel(item: Item): string {
  if (item.startHour === undefined) {
    return item.hours < 1 ? `${Math.round(item.hours * 60)}m, anytime` : `${item.hours}h, anytime`;
  }
  return `${formatHour(item.startHour)} to ${formatHour(endHour(item))}`;
}

export const isScheduled = (item: Item): item is Item & { startHour: number } =>
  item.startHour !== undefined;

/**
 * A day, split the way a person thinks about it: things at a time, in order,
 * then the things that just have to happen sometime.
 */
export function daySchedule(items: Item[], date: string) {
  const onDay = items.filter((item) => item.date === date && !item.spread);
  const timed = onDay.filter(isScheduled).sort((a, b) => a.startHour - b.startHour);
  const anytime = onDay.filter((item) => !isScheduled(item)).sort((a, b) => loadOf(b) - loadOf(a));
  return { timed, anytime, all: onDay };
}

export interface Slot {
  start: number;
  end: number;
}

export const slotHours = (slot: Slot): number => Math.round((slot.end - slot.start) * 10) / 10;

/**
 * The gaps. Used three ways: to show a day honestly, to offer real times when
 * booking recovery, and to find an evening several people share.
 */
export function freeSlots(items: Item[], date: string, minHours = 0.5): Slot[] {
  const busy = daySchedule(items, date)
    .timed.map((item) => ({ start: item.startHour, end: endHour(item) }))
    .sort((a, b) => a.start - b.start);

  const merged: Slot[] = [];
  for (const block of busy) {
    const last = merged[merged.length - 1];
    if (last && block.start <= last.end) last.end = Math.max(last.end, block.end);
    else merged.push({ ...block });
  }

  const gaps: Slot[] = [];
  let cursor = DAY_START;
  for (const block of merged) {
    if (block.start - cursor >= minHours) gaps.push({ start: cursor, end: block.start });
    cursor = Math.max(cursor, block.end);
  }
  if (DAY_END - cursor >= minHours) gaps.push({ start: cursor, end: DAY_END });
  return gaps;
}

/**
 * Whole-hour starts where something of this length would actually fit.
 *
 * The single source for every "when?" picker in the app. Offering a time that
 * does not exist is worse than offering none, so nothing is listed unless the
 * gap is genuinely long enough.
 */
export function startOptions(items: Item[], date: string, hours: number, max = 8): number[] {
  const need = Math.max(hours, 0.5);
  return freeSlots(items, date, need)
    .flatMap((slot) => {
      const out: number[] = [];
      for (let h = Math.ceil(slot.start); h + need <= slot.end; h += 1) out.push(h);
      return out;
    })
    .slice(0, max);
}

/**
 * Where a particular kind of thing should go.
 *
 * `startOptions` returns the earliest gap, which is right for a picker and wrong
 * for a default: it put a walk at 7am and would have put a nap there too. Each
 * activity carries the window it belongs in, and only falls outside it if the
 * day leaves no choice.
 */
export function placeIn(
  items: Item[],
  date: string,
  hours: number,
  preferred?: readonly [number, number],
): number | undefined {
  const options = startOptions(items, date, hours, 24);
  if (!preferred || options.length === 0) return options[0];
  const [from, to] = preferred;
  const inside = options.find((h) => h >= from && h + hours <= to);
  if (inside !== undefined) return inside;
  // The window is full. Fall back to the nearest hour to it, not the earliest
  // hour of the day - that is how a river walk ended up booked for 7am.
  return [...options].sort((a, b) => Math.abs(a - from) - Math.abs(b - from))[0];
}

/** Committed hours on a day, for the "4.5 committed / 1 recovery" readout. */
export function dayHours(items: Item[], date: string) {
  const { all } = daySchedule(items, date);
  const committed = all.filter((i) => !i.isRecovery).reduce((total, i) => total + i.hours, 0);
  const recovery = all.filter((i) => i.isRecovery).reduce((total, i) => total + i.hours, 0);
  return {
    committed: Math.round(committed * 10) / 10,
    recovery: Math.round(recovery * 10) / 10,
  };
}

/** The seven days of the week `anchor` falls in. */
export const weekDays = (anchor: string): string[] => {
  const monday = addDays(anchor, -dayIndex(anchor));
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
};

/** Evening slots shared by everyone, for the social invite flow. */
export function overlap(all: Slot[][], minHours = 1): Slot[] {
  if (all.length === 0) return [];
  return all.reduce((shared, next) => {
    const out: Slot[] = [];
    for (const a of shared) {
      for (const b of next) {
        const start = Math.max(a.start, b.start);
        const end = Math.min(a.end, b.end);
        if (end - start >= minHours) out.push({ start, end });
      }
    }
    return out;
  });
}
