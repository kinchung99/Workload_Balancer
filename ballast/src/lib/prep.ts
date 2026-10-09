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
import { dayHours, freeSlots, slotHours, startOptions } from './schedule';
import { sumLoad } from './load';
import { daysBetween, startOfWeek } from './dates';
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
      .filter((i) => i.parentId === item.id && !i.sessionDone && i.outcome !== 'missed')
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

/**
 * The week as the battery counts it: each piece of work costs once.
 *
 * An assignment carries its whole cost on its due date until it is planned;
 * each sitting booked for it then carries its own hours on its own day, so
 * those hours come off the assignment. Planning moves the cost to the days you
 * will actually spend it - it never adds to it. A missed sitting hands its
 * hours back to the assignment, because the work is still there.
 *
 * Every reading goes through this before it is split into weeks, so a sitting
 * this week for something due next week is counted once, this week.
 */
export function countedOnce(items: Item[]): Item[] {
  const booked = new Map<string, number>();
  for (const item of items) {
    if (item.parentId && item.outcome !== 'missed') booked.set(item.parentId, (booked.get(item.parentId) ?? 0) + item.hours);
  }
  if (!booked.size) return items;
  return items.map((item) => {
    const hours = booked.get(item.id);
    if (!hours || !item.prepHours || item.parentId) return item;
    return { ...item, hours: Math.max(0, Math.round((item.hours - hours) * 10) / 10) };
  });
}

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
export const MAX_SESSION = 2;
export const MIN_SESSION = 0.5;

/**
 * The hours a sitting belongs in.
 *
 * The planner used to take the first gap of the day, which is 7am on every day
 * that has one: both sittings of the problem set landed at dawn, and Tuesday got
 * one hour because 7 to 8 came before the four free hours that evening. Work
 * goes inside this window when the day allows, and only outside it when not.
 */
export const STUDY_WINDOW = [9, 21] as const;

/** What a day already carries, for showing and for choosing where work goes. */
export const loadOnDay = (items: Item[], date: string): number =>
  Math.max(0, sumLoad(items.filter((i) => i.date === date)));

export const committedOnDay = (items: Item[], date: string): number => dayHours(items, date).committed;

/**
 * Proposed sittings as items, so the gaps and the load can see them.
 *
 * A plan that is not yet booked still has to occupy its hours, or the next
 * sitting gets put on top of it - and still has to weigh something, or the
 * "this day gets heavier" readout would say nothing.
 */
export const sessionItems = (item: Item, sessions: Session[]): Item[] =>
  sessions.map((session, index) => ({
    id: `plan-session-${session.date}-${index}`,
    title: item.title,
    bucket: item.bucket,
    hours: session.hours,
    dread: item.dread,
    commitment: item.commitment,
    date: session.date,
    startHour: session.startHour,
    mix: item.mix,
  }));

/**
 * Every half-hour a sitting of this length could start on a day.
 *
 * `notBefore` drops the part of today that has already happened: proposing
 * 9am at 4pm is offering a time that does not exist.
 */
export const sittingStarts = (busy: Item[], date: string, hours: number, notBefore?: number): number[] =>
  startOptions(busy, date, hours, 64, 0.5).filter((h) => notBefore === undefined || h >= notBefore);

/** How far outside the study window a start sits, in hours. Zero is inside. */
const outsideWindow = (start: number, hours: number): number => {
  const [from, to] = STUDY_WINDOW;
  if (start < from) return from - start;
  if (start + hours > to) return start + hours - to;
  return 0;
};

/** The best start on a day: the earliest inside the window, else the nearest to it. */
export function bestStart(busy: Item[], date: string, hours: number, notBefore?: number): number | undefined {
  const options = sittingStarts(busy, date, hours, notBefore);
  if (!options.length) return undefined;
  return [...options].sort((a, b) => outsideWindow(a, hours) - outsideWindow(b, hours) || a - b)[0];
}

/** The days a piece of work can still be done on, today through the deadline. */
export const workDays = (item: Item, today: string): string[] =>
  Array.from({ length: daysLeft(item, today) + 1 }, (_, offset) => addDaysLocal(today, offset));

/**
 * The days a sitting can be booked on by hand: today to the end of next week.
 *
 * Wider than the work days on purpose. The planner suggests before the
 * deadline, but a student who wants a sitting next Thursday - a resit, an
 * extension, a head start on the next part - should be able to put it there
 * and see it marked late, not be told the day does not exist.
 */
export const bookingDays = (today: string): string[] => {
  const end = addDaysLocal(startOfWeek(today), 13);
  return Array.from({ length: daysBetween(today, end) + 1 }, (_, offset) => addDaysLocal(today, offset));
};

/**
 * Spread the remaining work across the days before it is due.
 *
 * Deliberately a scheduler rather than a model call: it runs offline, it is
 * explainable, and a student can see why every session is where it is. It
 * leaves the due day clear if it can, because handing in is not the same as
 * finishing.
 */
export function planSessions(
  item: Item,
  items: Item[],
  today: string,
  /** The hour it is now, when `today` really is today. Nothing is planned before it. */
  nowHour?: number,
): Session[] {
  // Plan what has neither been done nor booked; anything already scheduled stays
  // where the student put it.
  let left = unplanned(item, items);
  if (left <= 0) return [];

  const targets = workDays(item, today);
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

  const sessions: Session[] = [];

  /**
   * One sitting per day per pass, so work is spread rather than crammed - and
   * then another pass if hours are still left over.
   *
   * There used to be one pass and nothing after it, so three hours due tomorrow
   * placed two of them and called the third "will not fit" with the whole
   * evening free.
   */
  for (const pool of [byRoom, lastResort]) {
    for (let pass = 0; pass < 3 && left > 0; pass += 1) {
      let placed = false;
      for (const date of pool) {
        if (left <= 0) break;
        const busy = [...items, ...sessionItems(item, sessions)];
        const notBefore = date === today ? nowHour : undefined;
        // The biggest sitting that fits, down to half an hour.
        const want = Math.min(MAX_SESSION, Math.max(MIN_SESSION, Math.ceil(left * 2) / 2));
        for (let hours = want; hours >= MIN_SESSION; hours -= 0.5) {
          const startHour = bestStart(busy, date, hours, notBefore);
          if (startHour === undefined) continue;
          sessions.push({ date, startHour, hours });
          left = Math.max(0, Math.round((left - hours) * 10) / 10);
          placed = true;
          break;
        }
      }
      if (!placed) break;
    }
  }

  return sessions.sort((a, b) => a.date.localeCompare(b.date) || a.startHour - b.startHour);
}

/** What the plan does not manage to fit, so the screen can say so plainly. */
export const unplaced = (item: Item, sessions: Session[]): number =>
  Math.round((remaining(item) - sessions.reduce((total, s) => total + s.hours, 0)) * 10) / 10;
