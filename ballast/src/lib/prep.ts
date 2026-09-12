/**
 * Work that takes more than one sitting.
 *
 * A deadline is not a task. An assignment due Thursday is nine hours spread
 * across the days before Thursday, and a list that shows it only on Thursday is
 * the reason people discover their week at 11pm on Wednesday.
 *
 * So anything with preparation stays on *every* day's list from now until it is
 * due, carrying how much of it is left, and disappears the moment it is done.
 */
import { DAY_END, dayHours, freeSlots, slotHours, startOptions } from './schedule';
import { sumLoad } from './load';
import { daysBetween } from './dates';
import type { Item } from './types';

/** Hours still to do, whether or not they have a slot yet. */
export const remaining = (item: Item): number =>
  Math.max(0, Math.round(((item.prepHours ?? 0) - (item.prepDone ?? 0)) * 10) / 10);

/**
 * Hours booked into a day and not yet done.
 *
 * A ticked-off sitting has moved into `prepDone`, so counting it here as well
 * would show the same two hours twice - once as booked and once as finished.
 */
export const scheduledHours = (item: Item, items: Item[]): number =>
  Math.round(
    items
      .filter((i) => i.parentId === item.id && !i.sessionDone)
      .reduce((total, i) => total + i.hours, 0) * 10,
  ) / 10;

/** Every sitting of this work, done or not, earliest first. */
export const sittingsOf = (item: Item, items: Item[]): Item[] =>
  items
    .filter((i) => i.parentId === item.id)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.startHour ?? 0) - (b.startHour ?? 0));

/**
 * Hours with neither a slot nor a tick: the part that is still only a worry.
 *
 * This is what the bar tracks. Booking a sitting takes work out of this even
 * though none of it is done yet, because a plan is genuinely different from an
 * intention - and unbooking puts it straight back.
 */
export const unplanned = (item: Item, items: Item[]): number =>
  Math.max(0, Math.round((remaining(item) - scheduledHours(item, items)) * 10) / 10);

/** 100 means nothing is planned or done. 0 means it is all accounted for. */
export const percentUnplanned = (item: Item, items: Item[]): number =>
  item.prepHours ? Math.round((unplanned(item, items) / item.prepHours) * 100) : 0;

/** 100 means untouched, 0 means finished. Progress only, ignoring plans. */
export const percentUndone = (item: Item): number =>
  item.prepHours ? Math.round((remaining(item) / item.prepHours) * 100) : 0;

/** The three parts of the bar, as fractions of the whole. */
export const composition = (item: Item, items: Item[]) => {
  const total = item.prepHours ?? 0;
  if (!total) return { done: 0, scheduled: 0, unplanned: 0 };
  const done = (item.prepDone ?? 0) / total;
  const scheduled = Math.min(1 - done, scheduledHours(item, items) / total);
  return { done, scheduled, unplanned: Math.max(0, 1 - done - scheduled) };
};

export const needsPrep = (item: Item): boolean => !!item.prepHours && remaining(item) > 0;

/**
 * Everything still owing on a given day: preparation that is not finished and
 * not yet past its deadline. Sorted by how tight it is, then by importance.
 */
export function openPrep(items: Item[], date: string): Item[] {
  return items
    .filter((item) => needsPrep(item) && (item.deadline ?? item.date) >= date)
    .sort((a, b) => {
      const slackA = daysBetween(date, a.deadline ?? a.date) - remaining(a) / 3;
      const slackB = daysBetween(date, b.deadline ?? b.date) - remaining(b) / 3;
      if (slackA !== slackB) return slackA - slackB;
      return (b.importance ?? 2) - (a.importance ?? 2);
    });
}

/** Days left to work on it. Zero means it is due today. */
export const daysLeft = (item: Item, today: string): number =>
  Math.max(0, daysBetween(today, item.deadline ?? item.date));

/**
 * Whether it can still be finished in the free time that remains. This is the
 * only genuinely alarming thing a to-do list can tell you, and no list does.
 */
export function isAtRisk(item: Item, items: Item[], today: string): boolean {
  const days = daysLeft(item, today);
  let available = 0;
  for (let offset = 0; offset <= days; offset += 1) {
    const date = offset === 0 ? today : addDaysLocal(today, offset);
    available += freeSlots(items, date, 0.5).reduce((total, slot) => total + slotHours(slot), 0);
  }
  return available < remaining(item);
}

const addDaysLocal = (iso: string, days: number): string => {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

export interface Session {
  date: string;
  startHour: number;
  hours: number;
  /** What this sitting is meant to get through. */
  note?: string;
}

/** No one does nine hours in one go, and nobody plans a fifteen-minute session. */
const MAX_SESSION = 2;
const MIN_SESSION = 0.5;

/**
 * Spread the remaining work across the days before it is due.
 *
 * Deliberately a scheduler rather than a model call: it runs offline, it is
 * explainable, and a student can see why every session is where it is. It works
 * backwards from the deadline in the sense that it always leaves the last day
 * clear if it can, because handing in is not the same as finishing.
 */
/** What a day already carries, for showing and for choosing where work goes. */
export const loadOnDay = (items: Item[], date: string): number =>
  Math.max(0, sumLoad(items.filter((i) => i.date === date)));

export const committedOnDay = (items: Item[], date: string): number => dayHours(items, date).committed;

export function planSessions(item: Item, items: Item[], today: string): Session[] {
  // Plan what has neither been done nor booked; anything already scheduled stays
  // where the student put it.
  let left = unplanned(item, items);
  if (left <= 0) return [];

  const days = daysLeft(item, today);
  const targets = Array.from({ length: days + 1 }, (_, offset) => addDaysLocal(today, offset));
  // Aim to be finished the day before it is due, and only use the due day itself
  // if there is genuinely no other room.
  const preferred = targets.length > 1 ? targets.slice(0, -1) : targets;
  const lastResort = targets.slice(preferred.length);

  /**
   * Lightest days first.
   *
   * Working in date order piled sittings onto whatever came next, including days
   * that were already the heaviest of the week. Putting work where there is room
   * for it is the entire point of knowing how heavy each day is.
   */
  const byRoom = [...preferred].sort((a, b) => {
    const diff = loadOnDay(items, a) - loadOnDay(items, b);
    return diff !== 0 ? diff : a.localeCompare(b);
  });
  const order = [...byRoom, ...lastResort];

  const sessions: Session[] = [];
  const placedByDay = new Map<string, Session[]>();

  for (const date of order) {
    if (left <= 0) break;
    const taken = placedByDay.get(date) ?? [];
    const busy: Item[] = [
      ...items,
      ...taken.map((session, index) => ({
        id: `plan-session-${date}-${index}`,
        title: item.title,
        bucket: item.bucket,
        hours: session.hours,
        dread: item.dread,
        commitment: item.commitment,
        date,
        startHour: session.startHour,
      })),
    ];

    for (const slot of freeSlots(busy, date, MIN_SESSION)) {
      if (left <= 0) break;
      const room = Math.min(slotHours(slot), MAX_SESSION, left, DAY_END - slot.start);
      if (room < MIN_SESSION) continue;
      const hours = Math.round(room * 2) / 2;
      const start = startOptions(busy, date, hours, 24).find((h) => h >= slot.start && h + hours <= slot.end);
      if (start === undefined) continue;
      const session = { date, startHour: start, hours };
      sessions.push(session);
      placedByDay.set(date, [...taken, session]);
      left = Math.round((left - hours) * 10) / 10;
      break; // one sitting per day per pass, so work is spread rather than crammed
    }
  }

  return sessions;
}

/** What the plan does not manage to fit, so the screen can say so plainly. */
export const unplaced = (item: Item, sessions: Session[]): number =>
  Math.round((remaining(item) - sessions.reduce((total, s) => total + s.hours, 0)) * 10) / 10;
