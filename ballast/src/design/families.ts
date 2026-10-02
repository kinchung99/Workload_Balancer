/**
 * Five families, one colour and one drawing each.
 *
 * Every block in the app belongs to one of five things a student is doing:
 * looking at their week, deciding what to do, resting, dealing with people, or
 * looking after their own settings. Each family gets one pastel and one sticker,
 * and they are used the same way everywhere - a sky panel with a calendar on it
 * is always "when things happen", a mint one with a leaf is always "rest" - so a
 * screen can be read by colour before a word of it is.
 *
 * Decoration only, from `color.decor`. Nothing is read off these; anything
 * carrying a value keeps its band colour inside the panel.
 */
import { color } from './tokens';
import type { StickerName } from '@/components';

export type Family = 'week' | 'focus' | 'rest' | 'people' | 'you';

export const FAMILY: Record<Family, { wash: string; sticker: StickerName }> = {
  /** When things happen: the plan, the timetable, sittings, times. */
  week: { wash: color.decor.sky, sticker: 'calendar' },
  /** What to do, and what to put down: priorities, deadlines, trades. */
  focus: { wash: color.decor.lemon, sticker: 'star' },
  /** Getting charge back: recovery, tonight, sleep, good moments. */
  rest: { wash: color.decor.mint, sticker: 'leaf' },
  /** Other people: friends, groups, plans together, messages, sharing. */
  people: { wash: color.decor.candy, sticker: 'people' },
  /** You: profile, settings, how you feel. */
  you: { wash: color.decor.lilac, sticker: 'wave' },
};
