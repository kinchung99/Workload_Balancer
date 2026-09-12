/**
 * Your circle — who is where, and when they last said so.
 *
 * Everything else in this app is between a student and their own week. This is
 * the one part that is between people, and it is built on a single number:
 * **how long ago each of them last updated their own battery.**
 *
 * That number is the only thing here designed to bring someone back. A week
 * tracker you update for your own benefit is a chore; one where four friends
 * checked in this morning is a place you look. It is also the honest way to
 * show a stale reading: Jo at 24% three days ago is not the same claim as Jo at
 * 24% twenty minutes ago, and pretending otherwise would make the whole feature
 * a lie.
 */
import type { BandName, CircleMember } from './types';

/** After this long, a reading is history rather than news. */
export const STALE_AFTER_MINS = 24 * 60;

export const isStale = (person: CircleMember): boolean =>
  person.updatedMinsAgo === undefined || person.updatedMinsAgo > STALE_AFTER_MINS;

/** "20 min ago" · "3h ago" · "2 days ago" · "never". */
export function lastSeen(person: CircleMember): string {
  const mins = person.updatedMinsAgo;
  if (mins === undefined) return 'never checked in';
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  if (mins < 24 * 60) return `${Math.round(mins / 60)}h ago`;
  const days = Math.round(mins / (24 * 60));
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

/** How many of them have checked in today. The line that gets people back. */
export const updatedToday = (people: CircleMember[]): number =>
  people.filter((p) => !p.isYou && (p.updatedMinsAgo ?? Infinity) <= STALE_AFTER_MINS).length;

/**
 * Who to look at first.
 *
 * Emptiest battery first, because that is who might need something — but anyone
 * whose reading has gone stale drops down the list rather than up. A number
 * nobody has confirmed for three days is not evidence of anything.
 */
export function circleOrder(people: CircleMember[]): CircleMember[] {
  return [...people]
    .filter((p) => !p.isYou)
    .sort((a, b) => {
      if (isStale(a) !== isStale(b)) return isStale(a) ? 1 : -1;
      return (a.charge ?? 100) - (b.charge ?? 100);
    });
}

/**
 * The one person worth a message right now, and why.
 *
 * Deliberately at most one. A list of five people who might need checking on is
 * a list nobody acts on, and it turns a kindness into an obligation.
 */
export function worthANudge(
  people: CircleMember[],
): { person: CircleMember; reason: string } | null {
  const others = people.filter((p) => !p.isYou);
  const stuck = others.find((p) => (p.heavyForDays ?? 0) >= 5 && !isStale(p));
  if (stuck) return { person: stuck, reason: `heavy for ${stuck.heavyForDays} days` };
  const quiet = others.filter(isStale).sort((a, b) => (b.updatedMinsAgo ?? 0) - (a.updatedMinsAgo ?? 0))[0];
  if (quiet) return { person: quiet, reason: `quiet for ${lastSeen(quiet).replace(' ago', '')}` };
  const lowest = others.sort((a, b) => (a.charge ?? 100) - (b.charge ?? 100))[0];
  return lowest && (lowest.charge ?? 100) < 25 ? { person: lowest, reason: `down to ${lowest.charge}%` } : null;
}

export const BAND_WORD: Record<BandName, string> = {
  steady: 'doing fine',
  busy: 'busy',
  heavy: 'running empty',
  recovery: 'resting',
};
