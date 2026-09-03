/**
 * The fourteen-day forecast, and the collision inside it.
 *
 * Deadlines are known weeks in advance, so the pile-up is knowable weeks in
 * advance too. Everything else in the app describes a week. This arrives early
 * enough to change it.
 */
import { threshold } from '@design/tokens';
import { addDays, dayName, daysBetween, formatShort, range } from './dates';
import { bandFor, loadOf, sumLoad } from './load';
import type { Item } from './types';

/** A day's worth of ceiling, spread evenly across the week. */
export const dailyCeiling = (ceilings: Record<string, number>): number =>
  Object.values(ceilings).reduce((a, b) => a + b, 0) / 7;

export interface ForecastDay {
  date: string;
  load: number;
  percent: number;
  inCluster?: boolean;
}

export function buildForecast(
  items: Item[],
  from: string,
  ceilings: Record<string, number>,
  days = threshold.forecastDays,
): ForecastDay[] {
  const perDay = dailyCeiling(ceilings);
  return range(from, days).map((date) => {
    const load = sumLoad(items.filter((item) => item.date === date));
    return { date, load, percent: Math.round((load / perDay) * 100) };
  });
}

/**
 * We flag clustering, not totals.
 *
 * Three assignments across ten days is a normal fortnight. The same three inside
 * seventy-two hours is the thing that actually breaks people, and only a
 * forecast can tell them apart.
 *
 * Repeating load - shifts, the commute, the timetable - is excluded on purpose.
 * It is the background a student already lives in, not the collision. Counting
 * it would flag every week and the warning would stop meaning anything.
 */
const CLUSTER_MIN_LOAD = 9;
const CLUSTER_MIN_ITEMS = 4;

export interface Collision {
  /** First day of the window. */
  from: string;
  to: string;
  items: Item[];
  /** How many days until it starts. Eight is long enough to do something. */
  leadDays: number;
  headline: string;
  detail: string;
}

export function findCollision(items: Item[], today: string, horizon = threshold.forecastDays): Collision | null {
  const windowDays = Math.round(threshold.clusterWindowHours / 24);
  const candidates = items.filter((item) => !item.repeats && loadOf(item) >= CLUSTER_MIN_LOAD);

  let best: Collision | null = null;

  for (let offset = 0; offset <= horizon - windowDays; offset += 1) {
    const from = addDays(today, offset);
    const to = addDays(from, windowDays - 1);
    const inWindow = candidates
      .filter((item) => item.date >= from && item.date <= to)
      .sort((a, b) => a.date.localeCompare(b.date));

    if (inWindow.length < CLUSTER_MIN_ITEMS) continue;

    // The densest window wins: most things first, then most load. Ties go to the
    // earliest, because a warning you get sooner is worth more than the same
    // warning later - that is the entire argument for this screen existing.
    if (best) {
      const denser =
        inWindow.length > best.items.length ||
        (inWindow.length === best.items.length && sumLoad(inWindow) > sumLoad(best.items));
      if (!denser) continue;
    }

    best = {
      from,
      to,
      items: inWindow,
      leadDays: daysBetween(today, from),
      headline: `${dayName(from)} to ${dayName(to)} ${offset >= 7 ? 'next week' : 'this week'} is a wall.`,
      detail: `${count(inWindow.length)} things inside seventy-two hours. Spread across the fortnight, an ordinary two weeks.`,
    };
  }

  return best;
}

const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight'];
const count = (n: number): string => WORDS[n] ?? String(n);

/**
 * The forecast strip spoken as a sentence, for the same reason every other chart
 * is: a chart that only works as a picture is a chart half the users can't use.
 */
export function speakForecast(days: ForecastDay[], collision: Collision | null): string {
  const heavy = days.filter((day) => bandFor(day.percent) === 'heavy');
  const head = `Next ${days.length} days.`;
  if (!collision) return `${head} ${heavy.length} heavy days, none of them clustered.`;
  return `${head} ${count(heavy.length)} heavy days clustered ${dayName(collision.from)} to ${dayName(collision.to)}${collision.leadDays >= 7 ? ' next week' : ''}.`;
}

/** "In 8 days". Long enough to email a tutor, swap a shift or move a deadline. */
export const leadLabel = (days: number): string => (days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`);

export const windowLabel = (from: string, to: string): string => `${formatShort(from)} to ${formatShort(to)}`;
