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
 * Hours below which a night starts costing you, and what each hour is worth.
 *
 * A short night costs less than it did and a good one gives back twice as much.
 * The old numbers were symmetrical and punishing: four load an hour down, capped
 * at two hours up, so sleeping well could never undo sleeping badly.
 */
export const SLEEP_TARGET = 7.5;
const SLEEP_LOAD_PER_HOUR = 2.5;
/** A good night is worth something, and now genuinely worth something. */
const SLEEP_CREDIT_CAP = 4;

/**
 * Still calibrated so an ordinary day nets to zero - one proper meal, one light,
 * one still to come - because the seeded week has to read exactly what the model
 * check says until the student logs something themselves.
 *
 * What changed is the size of the swing. Logging dinner as a proper meal used to
 * move two load; it now moves four, which is the difference between a number
 * that twitches and one that rewards you.
 */
const MEAL_LOAD: Record<MealStatus, number> = {
  filling: -2,
  light: 0,
  skipped: 3,
  pending: 2,
};

/**
 * How today feels, as load.
 *
 * Asymmetric on purpose, and now asymmetric the other way. A bad day costs less
 * than it did and a good one is worth roughly twice as much, because a battery
 * that only ever falls is both bleak and wrong.
 */
const MOOD_LOAD: Record<MoodQuadrant, number> = {
  'low-unpleasant': 4,
  'high-unpleasant': 3,
  'low-pleasant': -4,
  'high-pleasant': -8,
};

export interface LogState {
  today: string;
  sleepHours: number | null;
  meals: Meal[];
  moods: MoodCheckIn[];
  errands?: Errand[];
  moments?: Moment[];
}

const entry = (id: string, title: string, bucket: Item['bucket'], load: number): Item => ({
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
});

/**
 * Signed load from what has been logged today. Appended to the week before any
 * reading is taken, so the battery moves the moment something is recorded.
 */
export function logItems({ today, sleepHours, meals, moods, errands = [], moments = [] }: LogState): Item[] {
  const out: Item[] = [];

  if (sleepHours !== null) {
    const deficit = SLEEP_TARGET - sleepHours;
    const load = deficit > 0
      ? Math.round(deficit * SLEEP_LOAD_PER_HOUR * 10) / 10
      : Math.max(-SLEEP_CREDIT_CAP * SLEEP_LOAD_PER_HOUR, deficit * SLEEP_LOAD_PER_HOUR);
    if (load !== 0) {
      out.push({
        ...entry('sleep', deficit > 0 ? 'Short night' : 'Slept well', 'physical', load),
        date: today,
      });
    }
  }

  const mealLoad = meals.reduce((total, meal) => total + MEAL_LOAD[meal.status], 0);
  if (mealLoad !== 0) {
    out.push({ ...entry('meals', mealLoad > 0 ? 'Meals missed' : 'Eaten well', 'physical', mealLoad), date: today });
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
