/**
 * Why a sitting is where it is, and what moving it does.
 *
 * "Book 2 sittings for me" put two blocks in the week and said nothing about
 * them, so a student could not tell a considered choice from a random one - and
 * could not change one without throwing the whole plan away. Every suggestion
 * now carries its reason in three short facts, and every change says what it
 * cost: which day got heavier, what went back to loose.
 *
 * Pure functions over the same items as everything else, so the reasons are
 * asserted in `npm run behaviour:check` rather than trusted.
 */
import { formatShort } from './dates';
import { capacityOf, loadOf } from './load';
import { DAY_END, DAY_START, dayHours, daySchedule, endHour, formatHour, freeSlots, slotHours } from './schedule';
import { STUDY_WINDOW, loadOnDay, sessionItems, workDays, type Session } from './prep';
import type { Item } from './types';

/** A sitting being drafted or moved. No start means it is waiting for one. */
export interface Draft {
  date: string;
  startHour?: number;
  hours: number;
}

/** One day this work could go on, as it stands before anything is booked. */
export interface DayFact {
  date: string;
  /** Load already on the day. */
  load: number;
  /** Load the drafts would add to it. */
  adding: number;
  /** Hours already committed that day. */
  booked: number;
  /** Free hours left once the drafts are in. */
  free: number;
  /** 1 is the lightest of the days before the deadline. The due day is unranked. */
  rank: number | null;
  isDue: boolean;
  isToday: boolean;
}

const round = (value: number) => Math.round(value * 10) / 10;

/** "30m", "1h", "1h 30m". Exact, because "1.5h" makes people do arithmetic. */
export function durationLabel(hours: number): string {
  if (hours <= 0) return '0h';
  const whole = Math.floor(hours);
  const minutes = Math.round((hours - whole) * 60);
  if (!whole) return `${minutes}m`;
  return minutes ? `${whole}h ${minutes}m` : `${whole}h`;
}

/** "7pm–9pm", or "No time yet" for a sitting that was pushed and lost its slot. */
export const spanLabel = (draft: Draft): string =>
  draft.startHour === undefined
    ? 'No time yet'
    : `${formatHour(draft.startHour)}–${formatHour(draft.startHour + draft.hours)}`;

const ORDINAL = ['', '', '2nd', '3rd'];
const ordinal = (n: number) => ORDINAL[n] ?? `${n}th`;

/** The load one sitting of this work adds to a day. */
export const sittingLoad = (item: Item, hours: number): number =>
  loadOf({ hours, dread: item.dread, isRecovery: item.isRecovery });

/**
 * The days a piece of work can still go on, with what each already carries.
 *
 * `base` is the week without the drafts; `drafts` are laid on top so the free
 * hours shrink as a plan fills a day, while the load reads both ways.
 */
export function dayFacts(item: Item, base: Item[], today: string, drafts: Draft[] = []): DayFact[] {
  const days = workDays(item, today);
  const due = item.deadline ?? item.date;
  const placed = drafts.filter((d): d is Session => d.startHour !== undefined);
  const withDrafts = [...base, ...sessionItems(item, placed)];

  const ranked = days
    .filter((date) => date !== due || days.length === 1)
    .map((date) => ({ date, load: loadOnDay(base, date) }))
    .sort((a, b) => a.load - b.load || a.date.localeCompare(b.date));

  return days.map((date) => {
    const index = ranked.findIndex((day) => day.date === date);
    return {
      date,
      load: round(loadOnDay(base, date)),
      adding: round(drafts.filter((d) => d.date === date).reduce((total, d) => total + sittingLoad(item, d.hours), 0)),
      booked: dayHours(base, date).committed,
      free: round(freeSlots(withDrafts, date, 0.5).reduce((total, slot) => total + slotHours(slot), 0)),
      rank: index === -1 ? null : index + 1,
      isDue: date === due,
      isToday: date === today,
    };
  });
}

/**
 * Why this day, in three facts: how it ranks, what it weighs, how full it is.
 *
 * No sentences. "Lightest day · 🔋 −5% · 10h booked" is the reason; a
 * paragraph explaining it would be the thing nobody reads. The day's weight is
 * said as battery, out of the week's capacity, like everywhere else.
 */
export function whyThisDay(fact: DayFact, capacity: number = capacityOf()): string[] {
  const out: string[] = [];
  if (fact.isDue) out.push('Due day');
  else if (fact.rank === 1) out.push('Lightest day');
  else if (fact.rank !== null) out.push(`${ordinal(fact.rank)} lightest`);
  out.push(`🔋 −${Math.round((fact.load / capacity) * 100)}%`);
  out.push(`${fact.booked}h booked`);
  return out;
}

/** A start outside the hours work belongs in, said plainly. */
export function timeNote(draft: Draft): string | null {
  if (draft.startHour === undefined) return null;
  const [from, to] = STUDY_WINDOW;
  if (draft.startHour < from) return 'Early start';
  if (draft.startHour + draft.hours > to) return 'Late finish';
  return null;
}

export interface Change {
  key: 'day' | 'time' | 'length';
  label: string;
  from: string;
  to: string;
  /** The consequence, in a few words. */
  note?: string;
  /** Heavy when it costs you, steady when it helps, plain when it is neither. */
  tone: 'heavy' | 'steady' | 'plain';
}

/**
 * What changed between a suggestion and the sitting the student settled on.
 *
 * Each row names the move and its price. Moving to a heavier day says by how
 * much; trimming a sitting says how much went back to loose, because that is
 * the part that becomes a late night if nobody mentions it.
 */
export function describeChange(item: Item, base: Item[], from: Draft, to: Draft, capacity: number = capacityOf()): Change[] {
  const changes: Change[] = [];
  const due = item.deadline ?? item.date;

  if (from.date !== to.date) {
    const before = round(loadOnDay(base, from.date));
    const after = round(loadOnDay(base, to.date));
    const diff = Math.round(((after - before) / capacity) * 100);
    changes.push({
      key: 'day',
      label: 'Day',
      from: formatShort(from.date),
      to: formatShort(to.date),
      note: to.date === due
        ? 'Due day · no buffer'
        : diff > 0 ? `A busier day · 🔋 −${diff}%` : diff < 0 ? `A lighter day · 🔋 +${-diff}%` : 'Just as busy',
      tone: to.date === due || diff > 0 ? 'heavy' : diff < 0 ? 'steady' : 'plain',
    });
  }

  if (from.startHour !== to.startHour) {
    const note = timeNote(to);
    changes.push({
      key: 'time',
      label: 'Time',
      from: from.startHour === undefined ? 'No time' : formatHour(from.startHour),
      to: to.startHour === undefined ? 'No time' : formatHour(to.startHour),
      note: note ?? undefined,
      tone: note ? 'heavy' : 'plain',
    });
  }

  if (from.hours !== to.hours) {
    const diff = round(to.hours - from.hours);
    changes.push({
      key: 'length',
      label: 'Length',
      from: durationLabel(from.hours),
      to: durationLabel(to.hours),
      note: diff < 0 ? `${durationLabel(-diff)} back to loose` : `${durationLabel(diff)} more planned`,
      tone: diff < 0 ? 'heavy' : 'steady',
    });
  }

  return changes;
}

/**
 * The day as a ribbon: busy blocks between DAY_START and DAY_END, as fractions.
 *
 * Drawn under the sitting being edited, so "7pm" is not an abstract chip but a
 * gap you can see between a shift and bedtime.
 */
export function dayRibbon(busy: Item[], date: string): Array<{ id: string; left: number; width: number; title: string }> {
  const span = DAY_END - DAY_START;
  return daySchedule(busy, date).timed
    .filter((i) => !i.isLog)
    .map((i) => {
      const start = Math.max(DAY_START, i.startHour);
      const end = Math.min(DAY_END, endHour(i));
      return { id: i.id, left: (start - DAY_START) / span, width: Math.max(0, end - start) / span, title: i.title };
    })
    .filter((block) => block.width > 0);
}

/** Where a start hour sits on the ribbon, 0 to 1. */
export const ribbonAt = (hour: number): number => (hour - DAY_START) / (DAY_END - DAY_START);

/** Which hour a point on the ribbon means. */
export const hourAt = (ratio: number): number => DAY_START + Math.max(0, Math.min(1, ratio)) * (DAY_END - DAY_START);

/** The nearest start that actually fits - a drag never lands on a clash. */
export function nearestStart(options: number[], hour: number): number | undefined {
  if (!options.length) return undefined;
  return options.reduce((best, h) => (Math.abs(h - hour) < Math.abs(best - hour) ? h : best));
}

/** The hour it is now, if `today` is really today - otherwise the demo's fixed day has no "now". */
export function nowHourFor(today: string, now: Date = new Date()): number | undefined {
  if (today !== now.toISOString().slice(0, 10)) return undefined;
  return Math.ceil((now.getHours() + now.getMinutes() / 60) * 2) / 2;
}
