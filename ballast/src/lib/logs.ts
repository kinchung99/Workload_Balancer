/**
 * Today's logs, as load.
 *
 * The point of logging is that it should change the number in front of you. A
 * five-hour night is strain you are carrying right now; recording that you ate,
 * or slept, or feel fine takes some of it back off. These are the only signed
 * entries in the model - see `loadOverride` on Item.
 *
 * Nothing is inferred: until you log, every one of these contributes zero, which
 * is why the seeded week reads exactly as the interface study says it does.
 */
import { errandLoad, openErrands, outstandingLoad } from './errands';
import { momentCredits } from './moments';
import type { BucketKey, Errand, Item, Meal, MealStatus, Moment, MoodCheckIn, MoodQuadrant } from './types';

/**
 * Sleep, food and mood are the heavy three.
 *
 * They are what a day actually runs on, so they move the battery the most - a
 * proper night is worth several good moments, not a fraction of one. Sleep and
 * food land in the head as well as the body: a short night is a foggy morning,
 * not only tired legs.
 *
 * Every answer has a weight, plus or minus, in the same load units as a task
 * (four load is about one percent of a week). Seven hours is a decent night
 * and gives a little back; each hour under it costs sixteen - about four
 * percent, the price of a lost morning - and each hour over it gives twelve
 * back, up to nine hours, so one long night never quite undoes a short one.
 */
export const SLEEP_TARGET = 7;
const SLEEP_COST_PER_HOUR = 16;
const SLEEP_DECENT_CREDIT = 4;
const SLEEP_CREDIT_PER_HOUR = 12;
const SLEEP_CREDIT_CAP_HOURS = 2;

/** Signed load for a night's sleep: positive costs, negative gives back. */
export const sleepLoad = (hours: number): number =>
  hours < SLEEP_TARGET
    ? Math.round((SLEEP_TARGET - hours) * SLEEP_COST_PER_HOUR * 10) / 10
    : -Math.round((SLEEP_DECENT_CREDIT + Math.min(hours - SLEEP_TARGET, SLEEP_CREDIT_CAP_HOURS) * SLEEP_CREDIT_PER_HOUR) * 10) / 10;
const SLEEP_MIX = { mental: 2, physical: 1 };
const MEAL_MIX = { mental: 1, physical: 1 };

/**
 * Still calibrated so an ordinary day nets to zero - one proper meal, one light,
 * one still to come - because the seeded week has to read exactly what the model
 * check says until the student logs something themselves.
 *
 * The swing is the heavy part, both ways: dinner logged as a proper meal gives
 * sixteen load back against one still to come, a light one eight, and a
 * skipped one costs twenty - eating matters more than any one good moment.
 */
const MEAL_LOAD: Record<MealStatus, number> = {
  filling: -8,
  light: 0,
  skipped: 28,
  pending: 8,
};

/**
 * A week with only the one answer - "ate today" on the check-in, with no meals
 * logged one by one - is that answer about the whole day, so it carries the
 * whole day's weight.
 */
const WHOLE_DAY_LOAD: Record<MealStatus, number> = {
  filling: -16,
  light: -6,
  skipped: 20,
  pending: 0,
};

/**
 * How today feels, as load.
 *
 * One of the heavy three, and it cuts both ways: a drained or stressed day
 * costs, a good one gives back a little more than a bad one takes, because a
 * battery that only ever falls is both bleak and wrong.
 */
const MOOD_LOAD: Record<MoodQuadrant, number> = {
  'low-unpleasant': 16,
  'high-unpleasant': 12,
  'low-pleasant': -16,
  'high-pleasant': -20,
};

/** How a check-in reads as one emoji, for the corner of your picture. */
export const MOOD_EMOJI: Record<MoodQuadrant, string> = {
  'high-pleasant': '😄',
  'low-pleasant': '😌',
  'high-unpleasant': '😣',
  'low-unpleasant': '😔',
};

/** Your latest check-in, as an emoji. Nothing until you have checked in once. */
export function moodEmoji(moods: MoodCheckIn[]): string | undefined {
  // Newest first; on the same day, the one logged last.
  const latest = [...moods].reverse().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))[0];
  return latest ? MOOD_EMOJI[latest.quadrant] : undefined;
}

export interface LogState {
  today: string;
  sleepHours: number | null;
  meals: Meal[];
  moods: MoodCheckIn[];
  errands?: Errand[];
  moments?: Moment[];
}

const entry = (id: string, title: string, bucket: Item['bucket'], load: number, mix?: Item['mix']): Item => ({
  id: `log-${id}`,
  title,
  bucket,
  hours: 0,
  dread: 1,
  commitment: 'self',
  date: '',
  loadOverride: load,
  isLog: true,
  spread: true,
  ...(mix ? { mix } : {}),
});

/**
 * Signed load from what has been logged today. Appended to the week before any
 * reading is taken, so the battery moves the moment something is recorded.
 */
export function logItems({ today, sleepHours, meals, moods, errands = [], moments = [] }: LogState): Item[] {
  const out: Item[] = [];

  if (sleepHours !== null) {
    const load = sleepLoad(sleepHours);
    if (load !== 0) {
      out.push({
        ...entry('sleep', load > 0 ? 'Short night' : 'Slept well', 'physical', load, SLEEP_MIX),
        date: today,
      });
    }
  }

  const mealLoad = meals.length === 1
    ? WHOLE_DAY_LOAD[meals[0].status]
    : meals.reduce((total, meal) => total + MEAL_LOAD[meal.status], 0);
  if (mealLoad !== 0) {
    out.push({ ...entry('meals', mealLoad > 0 ? 'Meals missed' : 'Eaten well', 'physical', mealLoad, MEAL_MIX), date: today });
  }

  const todaysMood = moods.find((mood) => mood.date === today);
  if (todaysMood) {
    const load = MOOD_LOAD[todaysMood.quadrant];
    if (load !== 0) {
      out.push({ ...entry('mood', load > 0 ? 'How today feels' : 'Feeling steady', 'mental', load), date: today });
    }
  }

  // Errands you added yourself, while they are still outstanding. Ticking one
  // off takes its weight back, which is the whole point of a list that costs
  // something to keep.
  /*
   * Every task you added, on the day you gave it.
   *
   * These used to be an anonymous lump of load unless they had a time, which
   * meant a thing you had written down could not be seen on the day it was for.
   * Each is now its own row: timed ones sit in the timeline, the rest wait in
   * that day's list, and both cost what they weigh in the area they belong to.
   */
  for (const errand of openErrands(errands)) {
    out.push({
      ...entry(`errand-${errand.id}`, errand.title, errand.bucket ?? 'errands', errandLoad(errand)),
      date: errand.date ?? today,
      hours: errand.hours ?? 0.33,
      startHour: errand.startHour,
      spread: false,
      // The split given at capture travels with it, or the load would collapse
      // back into one heading the moment it became a row.
      mix: errand.mix,
      // So does how much you want it: a thing you only turn up to is exactly
      // the kind of thing a swap should be allowed to trade away.
      want: errand.want,
    });
  }

  // Good moments. No ceiling - diminishing returns per kind does the work.
  for (const [bucket, load] of Object.entries(momentCredits(moments, today))) {
    if (load === 0) continue;
    out.push({ ...entry(`moment-${bucket}`, 'Good moments', bucket as BucketKey, load), date: today });
  }

  return out;
}

/** What one more logged thing would do to the battery, for the preview line. */
export const describeDelta = (before: number, after: number): string => {
  const move = after - before;
  if (move === 0) return 'No change';
  return `${move > 0 ? '+' : ''}${move}% battery`;
};
