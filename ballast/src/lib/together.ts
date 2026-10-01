/**
 * Finding time with other people.
 *
 * Two readings of the same data: a heatmap of how many of you are free at each
 * hour, which is what a group chat is always trying and failing to work out,
 * and the exact windows where everybody is. Both come from the same two
 * sources as everything else - your own free slots and the windows friends
 * chose to publish - so a group can never be shown a time that is not real.
 */
import { freeSlots, overlap, type Slot } from './schedule';
import { freeOn } from './sharing';
import type { CircleMember, Item } from './types';

/** The hours a plan between friends can start in. Nobody books dinner at 7am. */
export const PLAN_FROM = 9;
export const PLAN_TO = 23;

const covers = (slots: Slot[], hour: number) => slots.some((slot) => slot.start <= hour && slot.end >= hour + 1);

export interface HeatCell {
  date: string;
  hour: number;
  /** How many of you are free for the whole hour, you included. */
  free: number;
  /** Everybody, you included. */
  of: number;
  /** Names of who is free, for the spoken label and the tap. */
  who: string[];
}

/** Day by hour, how many of you are free. */
export function heatmap(mine: Item[], people: CircleMember[], days: string[]): HeatCell[][] {
  return days.map((date) => {
    const yours = freeSlots(mine, date, 1);
    const theirs = people.map((person) => ({ name: person.name, slots: freeOn(person, date) }));
    return Array.from({ length: PLAN_TO - PLAN_FROM }, (_, i) => {
      const hour = PLAN_FROM + i;
      const who = [
        ...(covers(yours, hour) ? ['You'] : []),
        ...theirs.filter((t) => covers(t.slots, hour)).map((t) => t.name),
      ];
      return { date, hour, free: who.length, of: people.length + 1, who };
    });
  });
}

export interface Window {
  date: string;
  start: number;
  end: number;
}

/**
 * Every window where all of you are free for at least `hours`, earliest first.
 *
 * Anyone who published nothing for a day cannot be counted as free on it -
 * silence is not availability.
 */
export function everyoneFree(mine: Item[], people: CircleMember[], days: string[], hours: number): Window[] {
  if (!people.length) return [];
  return days.flatMap((date) => {
    const theirs = people.map((person) => freeOn(person, date));
    if (theirs.some((list) => list.length === 0)) return [];
    const yours = freeSlots(mine, date, hours);
    return overlap([...theirs, yours], hours)
      .map((slot) => ({ date, start: Math.max(slot.start, PLAN_FROM), end: Math.min(slot.end, PLAN_TO) }))
      .filter((slot) => slot.end - slot.start >= hours);
  });
}

/** Whether a plan of `hours` starting at `hour` fits inside one of the windows. */
export const fitsWindow = (windows: Window[], date: string, hour: number, hours: number): boolean =>
  windows.some((w) => w.date === date && w.start <= hour && w.end >= hour + hours);
