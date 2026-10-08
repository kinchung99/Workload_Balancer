/**
 * What a check-in is worth, and what your circle sees of it.
 *
 * Every answer on the check-in screen moves the battery, so each one wears the
 * charge it would give back before it is tapped - the reason to answer is on
 * the button. The sums here are the same ones the headline reading runs, kept
 * to the decimal: a good laugh moves the battery by less than a whole percent
 * often enough that the rounded number would call it nothing.
 *
 * The note is the other half. An emoji and a line, shared with friends. The
 * server keeps one line of text and nothing called a mood - on purpose - so the
 * emoji travels at the front of that line and is lifted back out at the other
 * end, onto the corner of your picture.
 */
import { isSameWeek } from './dates';
import { exactOverall } from './load';
import { countedOnce } from './prep';
import { logItems, moodEmoji, type LogState } from './logs';
import type { BucketKey, Item, Meal, MealStatus, MoodCheckIn, MoodQuadrant } from './types';

/** Everything a reading needs: the week, today's logs, and the ceilings. */
export interface CheckInWorld extends LogState {
  items: Item[];
  ceilings: Record<BucketKey, number>;
}

/** One answer on the check-in screen. */
export type CheckInMove =
  | { kind: 'mood'; quadrant: MoodQuadrant }
  | { kind: 'sleep'; hours: number }
  | { kind: 'meal'; status: MealStatus }
  | { kind: 'moment'; id: string; bucket: BucketKey; credit: number };

/** The meal the check-in asks about. */
export const TODAYS_MEAL = 'dinner';

/** Set one meal's status, adding it if the week has no such meal yet. */
export function upsertMeal(meals: Meal[], id: string, status: MealStatus): Meal[] {
  if (meals.some((meal) => meal.id === id)) return meals.map((meal) => (meal.id === id ? { ...meal, status } : meal));
  return [...meals, { id, label: id === TODAYS_MEAL ? 'Dinner' : id, at: 'Today', status }];
}

/** The battery to the decimal - the same sum as the headline, unrounded. */
export function chargeExact(world: CheckInWorld): number {
  const week = countedOnce([...world.items, ...logItems(world)]).filter((item) => isSameWeek(item.date, world.today));
  return Math.max(0, Math.min(100, 100 - exactOverall(week, world.ceilings)));
}

/** The world as it would be with one more answer in it. */
export function withMove(world: CheckInWorld, move: CheckInMove): CheckInWorld {
  switch (move.kind) {
    case 'mood': {
      const entry: MoodCheckIn = { id: 'preview', date: world.today, at: 'Just now', quadrant: move.quadrant, tags: [] };
      return { ...world, moods: [entry, ...world.moods] };
    }
    case 'sleep':
      return { ...world, sleepHours: move.hours };
    case 'meal':
      return { ...world, meals: upsertMeal(world.meals, TODAYS_MEAL, move.status) };
    case 'moment':
      return {
        ...world,
        moments: [...(world.moments ?? []), { id: 'preview', date: world.today, kind: move.id, bucket: move.bucket, credit: move.credit }],
      };
  }
}

/** Battery points one answer would give back. Negative when it costs. */
export const gainOf = (world: CheckInWorld, move: CheckInMove): number =>
  chargeExact(withMove(world, move)) - chargeExact(world);

/**
 * The world with this kind of answer taken back out: no sleep logged, no mood
 * today, dinner still to come. Good moments add up rather than replace each
 * other, so they are left as they are.
 */
export function unanswered(world: CheckInWorld, kind: CheckInMove['kind']): CheckInWorld {
  switch (kind) {
    case 'sleep':
      return { ...world, sleepHours: null };
    case 'mood':
      return { ...world, moods: world.moods.filter((mood) => mood.date !== world.today) };
    case 'meal':
      // A week that logs meals one by one waits on dinner; one with only the
      // check-in's answer simply has none yet.
      return {
        ...world,
        meals: world.meals.length > 1
          ? world.meals.map((meal) => (meal.id === TODAYS_MEAL ? { ...meal, status: 'pending' as const } : meal))
          : world.meals.filter((meal) => meal.id !== TODAYS_MEAL),
      };
    case 'moment':
      return world;
  }
}

/**
 * What an answer weighs: its effect against not having answered at all.
 *
 * Fixed per answer, so the numbers on the tiles do not shift when one is
 * picked - 5h always reads as what 5h costs, whatever was tapped before.
 */
export const weightOf = (world: CheckInWorld, move: CheckInMove): number =>
  gainOf(unanswered(world, move.kind), move);

/** "+3%", or nothing when it would not visibly move the battery. */
export const gainLabel = (gain: number): string | null => (gain >= 0.5 ? `+${Math.round(gain)}%` : null);

/** "+3%", "−2%" or "±0%": what an answer does, either way. */
export const signedLabel = (gain: number): string => {
  const rounded = Math.round(gain);
  return rounded > 0 ? `+${rounded}%` : rounded < 0 ? `−${-rounded}%` : '±0%';
};

/* ------------------------------------------------------------------ note */

/** The longest line a note may carry, so it reads at a glance in a list. */
export const NOTE_MAX = 60;

/** One emoji at the very start of a line, with any skin tone or joined parts. */
const LEADING_EMOJI = /^(\p{Extended_Pictographic}(?:️|\p{Emoji_Modifier}|‍\p{Extended_Pictographic})*)\s*/u;

/** The one line sent to your circle: the emoji first, then the words. */
export function presenceLine(vibe: string | null, caption: string | null): string | null {
  const line = [vibe, caption?.trim()].filter(Boolean).join(' ');
  return line ? line.slice(0, 80) : null;
}

/** A friend's line, split back into the emoji for their picture and the words. */
export function splitPresence(line: string | null | undefined): { mood?: string; status?: string } {
  if (!line) return {};
  const match = line.match(LEADING_EMOJI);
  if (!match) return { status: line };
  const rest = line.slice(match[0].length).trim();
  return { mood: match[1], ...(rest ? { status: rest } : {}) };
}

/** The emoji on your own picture: the one you picked, else today's mood. */
export const shownMood = (vibe: string | null, moods: MoodCheckIn[]): string | undefined =>
  vibe ?? moodEmoji(moods);
