/**
 * Blocks you are allowed to give up, and what a chosen time would push out.
 *
 * A movable block is something at a set time that is yours to rearrange: soft
 * or self-imposed, not owing work, not a class, not rest you booked on purpose,
 * not a sitting of something else. The pickers show these in their own colour,
 * let a new thing land on top of one, and then ask where the pushed-out block
 * should go - so "no free time" stops being the end of the conversation.
 */
import { isMovable } from './load';
import { needsPrep } from './prep';
import { isProtectedClass } from './timetable';
import type { Item } from './types';

/** Something at a set time you could give up for something else. */
export const isSwappable = (item: Item): boolean =>
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
  !item.sessionDone;

/** The swappable blocks on a day. */
export const swappableOn = (items: Item[], date: string): Item[] =>
  items.filter((item) => item.date === date && isSwappable(item));

/** The day without its swappable blocks: the gaps you would have if they moved. */
export const withoutSwappable = (items: Item[], date: string): Item[] =>
  items.filter((item) => item.date !== date || !isSwappable(item));

/** The swappable blocks a time would land on. */
export function displacedBy(items: Item[], slot: { date: string; startHour?: number; hours: number }, exceptId?: string): Item[] {
  if (slot.startHour === undefined) return [];
  const start = slot.startHour;
  const end = start + slot.hours;
  return swappableOn(items, slot.date).filter(
    (item) => item.id !== exceptId && item.startHour! < end && item.startHour! + item.hours > start,
  );
}
