/**
 * What to do first, and what to put down.
 *
 * Every other screen answers "how is my week". This one answers the question a
 * student actually asks at 9am: *of all of this, what do I start with?*
 *
 * A to-do list sorts by the order things were typed. A calendar sorts by clock
 * time, which is not the same as importance. Neither knows that a two-hour job
 * due tomorrow beats a nine-hour job due next week, or that the thing you should
 * genuinely move is the one that costs the most and nobody is expecting.
 *
 * So this scores everything on one scale, and the score is made of things a
 * student would recognise as reasons - which is why every row can say why it is
 * where it is.
 */
import { BUCKET_LABEL, isMovable, loadOf } from './load';
import { importanceOf, importanceWord } from './importance';
import { MAX_SESSION, MIN_SESSION, STUDY_WINDOW, bestStart, loadOnDay, needsPrep, remaining, sittingStarts, sittingsOf, unplanned, workDays } from './prep';
import { addDays, daysBetween } from './dates';
import { formatHour, freeSlots, slotHours } from './schedule';
import { isProtectedClass } from './timetable';
import { wantOf } from './swap';
import { DEFAULT_WEIGHTS } from './review';
import type { Item, Weights } from './types';

export type Urgency = 'today' | 'tomorrow' | 'soon' | 'later';

export interface Ranked {
  item: Item;
  score: number;
  /** Short phrases explaining the score, strongest first. Shown as chips. */
  reasons: string[];
  /** What kind of thing this is, which decides what the button does. */
  kind: 'owing' | 'fixed' | 'loose';
  /** Hours it would give you back if you moved or dropped it. */
  saves: number;
  /**
   * The latest day to start and still finish, given the free time you really
   * have. What the list is sorted by, so every row can say it.
   */
  startBy?: string;
  /** Hours that still need doing (owing work) or the block's length. */
  need?: number;
  /** Could-move rows: why this one, in a few words each. */
  moveReasons?: string[];
  /** Could-move rows: a lighter slot it would fit, if there is one. */
  suggest?: { date: string; startHour: number };
}

/**
 * How much closer a deadline makes something. Kept for the "why it's first"
 * dots and for anything that still asks how pressing a date is on its own.
 */
export const urgencyFactor = (days: number): number => {
  if (days <= 0) return 3;
  if (days === 1) return 2.2;
  if (days === 2) return 1.6;
  if (days === 3) return 1.15;
  if (days <= 5) return 0.8;
  if (days <= 7) return 0.55;
  return 0.35;
};

/** Hours of work a day can carry on top of everything already in it. */
export const DAILY_WORK = 4;

/** How far ahead owing work is looked at, so a heavy job due later can still surface now. */
const LOOKAHEAD_DAYS = 28;

const dueLabel = (days: number): string =>
  days <= 0 ? 'Due today' : days === 1 ? 'Due tomorrow' : `${days} days left`;

const WEEKDAY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const weekdayOf = (date: string): string => WEEKDAY[(new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7];

/** "Start today", "Start tomorrow", "Start by Thu". */
export const startWord = (startBy: string, today: string): string => {
  const days = daysBetween(today, startBy);
  return days <= 0 ? 'Start today' : days === 1 ? 'Start tomorrow' : `Start by ${weekdayOf(startBy)}`;
};

/**
 * The start line a row leads with: when to start it, or - for owing work whose
 * hours are all booked already - when its next sitting is.
 */
export const startLabel = (row: Ranked, today: string): string => {
  if (!row.startBy) return '';
  if (row.kind === 'owing' && (row.need ?? 0) <= 0) {
    const days = daysBetween(today, row.startBy);
    return `Next sitting ${days <= 0 ? 'today' : days === 1 ? 'tomorrow' : weekdayOf(row.startBy)}`;
  }
  return startWord(row.startBy, today);
};

/** Hours on a day you could really work: free, inside the study window, not already gone, and at most a day's worth. */
function workable(items: Item[], date: string, today: string, nowHour?: number): number {
  const [from, to] = STUDY_WINDOW;
  const floor = date === today && nowHour !== undefined ? Math.max(from, nowHour) : from;
  const hours = freeSlots(items, date, 0.5).reduce((total, slot) => {
    const start = Math.max(slot.start, floor);
    const end = Math.min(slot.end, to);
    return total + Math.max(0, end - start);
  }, 0);
  return Math.min(DAILY_WORK, hours);
}

/**
 * The latest day you can start and still be done in time.
 *
 * Walk back from the due day, adding up the hours each day can really take,
 * until they cover what is still needed. A two-hour job due Friday starts by
 * Friday; twelve hours due Friday with three free hours a day starts Tuesday -
 * which is why heavy work far from its deadline still rises to the top. If even
 * today is not enough, it starts today and it is short.
 */
export function startByFor(
  need: number, due: string, items: Item[], today: string, nowHour?: number,
): { date: string; short: number; available: number } {
  if (need <= 0) return { date: due < today ? today : due, short: 0, available: 0 };
  // Finished the day before it is due, when there is a day before: a deadline is usually a morning.
  const last = due <= today ? today : addDays(due, -1);
  let total = 0;
  let date = last;
  for (let offset = daysBetween(today, last); offset >= 0; offset -= 1) {
    date = addDays(today, offset);
    total += workable(items, date, today, nowHour);
    if (total >= need) return { date, short: 0, available: total };
  }
  return { date: today, short: Math.round((need - total) * 10) / 10, available: total };
}

/**
 * One row of "what to do first": its start-by day, and the score that keeps the
 * list in that order.
 *
 * The start-by day carries most of the weight - twelve points a day - so the
 * list reads in the order you would have to start things. Inside a day,
 * importance (six points a level), a promise to someone else, and how much of
 * your free time it needs decide; being short of time outranks everything.
 * Weights tuned by the evening review stretch the day term or the importance
 * term, and leave the order alone until somebody asks for that.
 */
export function rank(
  item: Item,
  items: Item[],
  today: string,
  weights: Weights = DEFAULT_WEIGHTS,
  nowHour?: number,
): Ranked {
  const owing = needsPrep(item);
  const due = owing ? item.deadline ?? item.date : item.deadline ?? item.date;
  const dueDays = Math.max(0, daysBetween(today, due));
  const need = owing ? unplanned(item, items) : item.hours;
  const nextSitting = owing && need <= 0
    ? sittingsOf(item, items).filter((s) => !s.sessionDone && s.date >= today).sort((x, y) => x.date.localeCompare(y.date))[0]
    : undefined;
  // A task without hours of work behind it starts on its own day; only owing work is walked back through your free time.
  const plan = nextSitting
    ? { date: nextSitting.date, short: 0, available: 0 }
    : owing
      ? startByFor(need, due, items, today, nowHour)
      : { date: due < today ? today : due, short: 0, available: 0 };
  const startDays = Math.max(0, daysBetween(today, plan.date));
  const importance = importanceOf(item);
  const pressure = !owing ? 0 : plan.available > 0 ? Math.min(2, need / plan.available) : need > 0 ? 2 : 0;

  const score =
    100 -
    startDays * 12 * weights.urgency +
    (importance - 2) * 6 * weights.importance +
    (item.commitment === 'hard' ? 4 : item.commitment === 'soft' ? 2 : 0) +
    pressure * 5 +
    // Only once the evening review has said days are too full does wanting something pull it up.
    (wantOf(item) - 3) * (weights.want - 1) * 8 +
    (plan.short > 0 ? 40 : 0) -
    dueDays * 0.5;

  const reasons: string[] = [];
  if (plan.short > 0) reasons.push('Not enough time left');
  reasons.push(nextSitting ? `Next sitting ${startDays === 0 ? 'today' : startDays === 1 ? 'tomorrow' : weekdayOf(plan.date)}` : startWord(plan.date, today));
  reasons.push(owing || item.deadline ? dueLabel(dueDays) : dueDays === 0 ? 'Today' : `On ${weekdayOf(due)}`);
  if (owing) reasons.push(`${remaining(item)}h to go`);
  if (importance >= 3) reasons.push(importanceWord(importance));
  if (item.commitment === 'hard') reasons.push('Hard deadline');
  if (weights.want > 1 && wantOf(item) >= 4) reasons.push('You want this');

  return {
    item,
    score: Math.round(score * 10) / 10,
    reasons: reasons.slice(0, 5),
    kind: owing ? 'owing' : item.startHour === undefined ? 'loose' : 'fixed',
    saves: Math.round(Math.abs(loadOf(item)) * 10) / 10,
    startBy: plan.date,
    need,
  };
}

/** Only things a student could act on. Background load and logs are not choices. */
const isActionable = (item: Item, today: string): boolean =>
  !item.repeats &&
  !item.spread &&
  !item.isLog &&
  !item.isRecovery &&
  !item.parentId &&
  !item.sessionDone &&
  // Already answered for - done, or marked as not happening.
  !item.outcome &&
  (needsPrep(item) || (item.date >= today && (item.deadline === undefined || needsPrep(item))));

/**
 * Something you *do*, rather than somewhere you are: owing work, or a task with
 * no set time. A dinner at seven with friends is not something to do first,
 * and neither is anything fixed.
 */
const isTask = (item: Item): boolean =>
  item.commitment !== 'fixed' && (needsPrep(item) || item.startHour === undefined || item.deadline !== undefined);

/**
 * A block with a time that you are allowed to move: not fixed, not a hard
 * deadline, not a class, not rest you booked on purpose.
 */
const isMovableBlock = (item: Item, today: string, nowHour?: number): boolean =>
  !needsPrep(item) &&
  item.startHour !== undefined &&
  item.deadline === undefined &&
  isMovable(item) &&
  !isProtectedClass(item) &&
  !item.moduleId &&
  !item.repeats &&
  !item.isLog &&
  !item.isRecovery &&
  !item.parentId &&
  !item.outcome &&
  item.date >= today &&
  !(item.date === today && nowHour !== undefined && item.startHour + item.hours <= nowHour);

/**
 * Why a block is worth moving, and where it could go.
 *
 * Least important first, then heaviest, then the ones sitting on your heaviest
 * days - and for each, a lighter day it actually fits on, so "move it" comes
 * with an answer instead of a question.
 */
function moveRow(item: Item, items: Item[], today: string, weights: Weights, horizonDays: number, nowHour?: number): Ranked {
  const importance = importanceOf(item);
  const saves = Math.round(Math.abs(loadOf(item)) * 10) / 10;
  const days = Array.from({ length: horizonDays + 1 }, (_, i) => addDays(today, i));
  const loads = days.map((date) => loadOnDay(items, date));
  const average = loads.reduce((t, l) => t + l, 0) / Math.max(1, loads.length);
  const own = loadOnDay(items, item.date);
  const heavy = own >= average * 1.25 && own > 0;

  // The lightest other day this fits on, near enough to be the same week.
  const others = items.filter((other) => other.id !== item.id);
  const candidates = days
    .filter((date) => date !== item.date)
    .map((date) => ({ date, load: loadOnDay(others, date), start: bestStart(others, date, item.hours, date === today ? nowHour : undefined) }))
    .filter((c) => c.start !== undefined && c.load < own && Math.abs(daysBetween(item.date, c.date)) <= 3)
    // Lighter, and near: a day or two either side beats the emptiest day of the week.
    .sort((x, y) =>
      x.load + Math.abs(daysBetween(item.date, x.date)) * average * 0.35
      - (y.load + Math.abs(daysBetween(item.date, y.date)) * average * 0.35));
  const target = candidates[0];

  const moveReasons: string[] = [];
  moveReasons.push(item.commitment === 'self' ? 'Your own idea' : 'Soft, can be rearranged');
  if (importance === 1) moveReasons.push('Optional to you');
  if (heavy) moveReasons.push(`${weekdayOf(item.date)} is one of your heaviest days`);
  if (target) moveReasons.push(`Fits ${weekdayOf(target.date)} ${formatHour(target.start!)}, a lighter day`);

  const score =
    (4 - importance) * 10 * weights.importance +
    saves * 1.5 +
    (item.commitment === 'self' ? 4 : 2) +
    (heavy ? 6 : 0) +
    (target ? 3 : 0) -
    daysBetween(today, item.date) * 0.3;

  return {
    item,
    score: Math.round(score * 10) / 10,
    reasons: moveReasons.slice(0, 3),
    kind: 'fixed',
    saves,
    moveReasons,
    ...(target ? { suggest: { date: target.date, startHour: target.start! } } : {}),
  };
}

/**
 * The list, in two halves that never overlap.
 *
 * `first` is what to start with: owing work and tasks without a set time,
 * sorted by the day each has to be started. `couldMove` is the other question:
 * of the blocks already at a time, which are you allowed to move and which
 * would you miss least? Fixed times and hard deadlines are in neither - there
 * is nothing to decide about them.
 */
export function prioritise(
  items: Item[],
  today: string,
  horizonDays = 7,
  weights: Weights = DEFAULT_WEIGHTS,
  nowHour?: number,
): { first: Ranked[]; couldMove: Ranked[] } {
  const first = items
    .filter((item) => isActionable(item, today) && isTask(item))
    .filter((item) => {
      const due = item.deadline ?? item.date;
      return needsPrep(item) ? daysBetween(today, due) <= LOOKAHEAD_DAYS : daysBetween(today, due) <= horizonDays;
    })
    .map((item) => rank(item, items, today, weights, nowHour))
    // Owing work due later only belongs here once it has to be started inside the week.
    .filter((row) => daysBetween(today, row.startBy ?? today) <= horizonDays)
    // The day you have to start comes first, always - so the list reads in order. Within a day, the score decides.
    .sort((a, b) => (a.startBy ?? today).localeCompare(b.startBy ?? today) || b.score - a.score);

  const couldMove = items
    .filter((item) => isMovableBlock(item, today, nowHour) && daysBetween(today, item.date) <= horizonDays)
    .map((item) => moveRow(item, items, today, weights, horizonDays, nowHour))
    .filter((row) => row.saves > 0)
    .sort((a, b) => b.score - a.score);

  return { first, couldMove };
}

/** "Mental · 8 load" — the one line under a title. */
export const rankedDetail = (row: Ranked): string =>
  `${BUCKET_LABEL[row.item.bucket]} · ${row.saves} load`;

/* ------------------------------------------------------- the top of the list */

/** One push behind a row's place, and how hard it pushes: one to three. */
export interface Push {
  key: 'risk' | 'deadline' | 'promise' | 'matters' | 'size';
  emoji: string;
  label: string;
  strength: 1 | 2 | 3;
}

/**
 * Why something is first, as the three things pushing it hardest.
 *
 * The score is a product of five factors, which is right for ranking and
 * unreadable as a number. Each factor becomes a line with one to three dots -
 * "Due today, three dots; hard deadline, three; four hours of work, two" - so
 * the order can be checked at a glance instead of taken on trust.
 */
export function whyFirst(row: Ranked, items: Item[], today: string, biggest: number): Push[] {
  const { item } = row;
  const owing = row.kind === 'owing';
  const due = item.deadline ?? item.date;
  const days = Math.max(0, daysBetween(today, due));
  const pushes: Push[] = [];

  if (row.reasons.includes('Not enough time left')) {
    pushes.push({ key: 'risk', emoji: '🚨', label: 'Not enough free time left to finish', strength: 3 });
  }
  if (row.startBy) {
    const startDays = Math.max(0, daysBetween(today, row.startBy));
    pushes.push({
      key: 'deadline', emoji: '⏰',
      label: `${startLabel(row, today)} · ${days <= 0 ? 'due today' : days === 1 ? 'due tomorrow' : `due in ${days} days`}`,
      strength: startDays === 0 ? 3 : startDays <= 2 ? 2 : 1,
    });
  }
  if (item.commitment === 'hard') pushes.push({ key: 'promise', emoji: '🤝', label: 'Hard deadline', strength: 3 });
  else if (item.commitment === 'soft') pushes.push({ key: 'promise', emoji: '🤝', label: 'Others expect it', strength: 1 });
  const importance = importanceOf(item);
  if (importance >= 3) pushes.push({ key: 'matters', emoji: importance === 4 ? '🔥' : '⭐', label: importanceWord(importance), strength: importance === 4 ? 3 : 2 });

  const weight = owing ? remaining(item) * 3 : Math.abs(loadOf(item));
  const share = biggest > 0 ? weight / biggest : 0;
  if (share > 0) {
    pushes.push({
      key: 'size', emoji: '📦',
      label: owing ? `${remaining(item)}h of work to go` : `A ${item.hours < 1 ? `${Math.round(item.hours * 60)}m` : `${item.hours}h`} block`,
      strength: share >= 0.66 ? 3 : share >= 0.33 ? 2 : 1,
    });
  }

  return pushes.sort((a, b) => b.strength - a.strength).slice(0, 3);
}

/** How heavy a row is, the way the score sees it - for scaling "size" between rows. */
export const rowWeight = (row: Ranked): number =>
  row.kind === 'owing' ? remaining(row.item) * 3 : Math.abs(loadOf(row.item));

/**
 * Hours this still needs a slot for.
 *
 * Owing work: the hours neither done nor booked. Something with no time yet:
 * its length. Something already at a time has its slot, so it needs none.
 */
export function hoursNeeded(row: Ranked, items: Item[]): number {
  if (row.kind === 'owing') return unplanned(row.item, items);
  if (row.kind === 'loose') return row.item.hours;
  return 0;
}

/**
 * When it could actually happen: the first real gap, before it is due, long
 * enough for the next piece of it. "Fits Tuesday at 7pm" is the difference
 * between a priority and a plan.
 *
 * Gaps inside normal working hours win, on any day before the deadline; a 7am
 * or a 10pm slot is only offered when nothing else fits. Offering dawn because
 * it happens to be today is how a suggestion gets ignored.
 */
export function nextFit(
  row: Ranked,
  items: Item[],
  today: string,
  nowHour?: number,
): { date: string; start: number; hours: number; booked: boolean } | null {
  const { item } = row;
  if (row.kind === 'fixed') return { date: item.date, start: item.startHour!, hours: item.hours, booked: true };

  let piece: number;
  let dates: string[];
  if (row.kind === 'owing') {
    const left = unplanned(item, items);
    if (left <= 0) {
      // All of it is booked: the answer is the next sitting already in the week.
      const next = sittingsOf(item, items)
        .filter((s) => !s.sessionDone && s.startHour !== undefined
          && (s.date > today || (s.date === today && s.startHour + s.hours > (nowHour ?? 0))))
        .sort((a, b) => a.date.localeCompare(b.date) || a.startHour! - b.startHour!)[0];
      return next ? { date: next.date, start: next.startHour!, hours: next.hours, booked: true } : null;
    }
    piece = Math.min(MAX_SESSION, Math.max(MIN_SESSION, Math.ceil(left * 2) / 2));
    dates = workDays(item, today);
  } else {
    piece = item.hours;
    dates = [item.date < today ? today : item.date];
  }

  const [from, to] = STUDY_WINDOW;
  const options = dates.map((date) => ({ date, starts: sittingStarts(items, date, piece, date === today ? nowHour : undefined) }));
  for (const { date, starts } of options) {
    const inside = starts.find((h) => h >= from && h + piece <= to);
    if (inside !== undefined) return { date, start: inside, hours: piece, booked: false };
  }
  const anywhere = options.find(({ starts }) => starts.length);
  return anywhere ? { date: anywhere.date, start: anywhere.starts[0], hours: piece, booked: false } : null;
}

export interface DayAhead {
  date: string;
  /** Free hours that day, between 7am and 11pm. */
  free: number;
  /** Rank numbers (1 is first) of what is due that day. */
  due: number[];
}

/**
 * The next week at a glance: free time per day, what lands when, and whether
 * the hours still needed fit in the hours still free.
 *
 * The verdict is deliberately blunt. "It fits, with eight hours spare" and
 * "short by three hours" are the two sentences a ranked list cannot say on its
 * own, and the second is the reason to look at what could move.
 */
export function weekAhead(
  rows: Ranked[],
  items: Item[],
  today: string,
  span = 7,
): { days: DayAhead[]; needed: number; free: number; verdict: 'fits' | 'tight' | 'short' } {
  const days = Array.from({ length: span }, (_, i) => addDays(today, i)).map((date) => ({
    date,
    free: Math.round(freeSlots(items, date, 0.5).reduce((total, slot) => total + slotHours(slot), 0) * 10) / 10,
    due: rows
      .map((row, index) => ({ rank: index + 1, date: row.item.deadline ?? row.item.date }))
      .filter((entry) => entry.date === date)
      .map((entry) => entry.rank),
  }));
  const needed = Math.round(rows.reduce((total, row) => total + hoursNeeded(row, items), 0) * 10) / 10;
  const free = Math.round(days.reduce((total, day) => total + day.free, 0) * 10) / 10;
  const verdict = needed > free ? 'short' : needed > free * 0.7 ? 'tight' : 'fits';
  return { days, needed, free, verdict };
}
