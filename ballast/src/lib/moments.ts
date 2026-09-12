/**
 * Good moments.
 *
 * Everything else in this app measures what a week takes out of you, and a
 * battery that only ever falls is both bleak and inaccurate. Days do go well.
 * These are one-tap records of the small things that give a little back.
 *
 * The credits are modest but no longer token. A good laugh is not a night's
 * sleep - but at six load against a ceiling of a hundred and sixty it was worth
 * under four percent of one area, which is not a reward, it is a rounding error.
 * Three or four good things in a day should visibly lift the battery, because on
 * a real day they visibly lift the person.
 */
import type { BucketKey, Moment } from './types';

export interface MomentKind {
  id: string;
  label: string;
  emoji: string;
  bucket: BucketKey;
  /** Load given back. */
  credit: number;
  note: string;
}

export const MOMENT_KINDS: MomentKind[] = [
  { id: 'laughed',  label: 'Properly laughed',   emoji: '😄', bucket: 'mental',   credit: 10, note: 'Cheapest recovery there is' },
  { id: 'finished', label: 'Finished something', emoji: '✅', bucket: 'mental',   credit: 13, note: 'Closing a loop frees the head' },
  { id: 'good-chat',label: 'Good conversation',  emoji: '💬', bucket: 'social',   credit: 10, note: 'Counts as social recovery' },
  { id: 'outside',  label: 'Got outside',        emoji: '🌤️', bucket: 'physical', credit: 10, note: 'Out of the building, not thinking' },
  { id: 'proud',    label: 'Proud of myself',    emoji: '🌟', bucket: 'mental',   credit: 13, note: 'Worth recording, and rarely is' },
  { id: 'ate-well', label: 'Ate properly',       emoji: '🍜', bucket: 'physical', credit: 8, note: 'A real meal, sat down' },
  { id: 'helped',   label: 'Helped someone',     emoji: '🤝', bucket: 'social',   credit: 10, note: 'Being useful is its own recovery' },
  { id: 'rested',   label: 'Actually rested',    emoji: '🛋️', bucket: 'physical', credit: 12, note: 'Not scrolling. Resting' },
];

/** Prompts under the "why" field, so it is a nudge rather than a blank page. */
export const WHY_SUGGESTIONS: Record<string, string[]> = {
  laughed:  ['Something my flatmate said', 'A stupid video', 'Old friends'],
  finished: ['Handed something in', 'Cleared my inbox', 'Got through the reading'],
  'good-chat': ['Called home', 'Someone checked on me', 'Long overdue catch-up'],
  outside:  ['Walked the river', 'Cycled instead of the bus', 'Sat in the sun'],
  proud:    ['Asked for help', 'Said no to something', 'Turned up anyway'],
  'ate-well': ['Cooked properly', 'Ate with people', 'Actually stopped for lunch'],
  helped:   ['Explained something to someone', 'Covered a shift', 'Listened'],
  rested:   ['A real nap', 'An evening with nothing in it', 'Went to bed early'],
};

export const kindOf = (id: string): MomentKind | undefined => MOMENT_KINDS.find((k) => k.id === id);

/**
 * Today's moments, as load given back per bucket.
 *
 * No ceiling: a genuinely good day should be able to lift the battery a long
 * way, and a hard cap made the number feel rigged. Instead each repeat of the
 * same kind is worth less than the last - the fifth laugh is not the first - so
 * a real day counts fully while tapping one button twenty times does not.
 */
export function momentCredits(moments: Moment[], today: string): Record<string, number> {
  const out: Record<string, number> = {};
  const seen: Record<string, number> = {};
  for (const moment of moments.filter((m) => m.date === today)) {
    seen[moment.kind] = (seen[moment.kind] ?? 0) + 1;
    const worth = moment.credit / seen[moment.kind];
    out[moment.bucket] = Math.round(((out[moment.bucket] ?? 0) - worth) * 10) / 10;
  }
  return out;
}

/** What the next tap of this kind would be worth, for the label on the button. */
export const nextWorth = (kind: MomentKind, alreadyLogged: number): number =>
  Math.round((kind.credit / (alreadyLogged + 1)) * 10) / 10;
