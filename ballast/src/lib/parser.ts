/**
 * The on-device plain-language parser.
 *
 * One box, no fields. This pulls the bucket, the hours, the deadline and the
 * dread out of how a student would actually type it at a bus stop.
 *
 * Rule-based on purpose: regex plus a small keyword dictionary, no model call,
 * no network. The demo cannot depend on the venue wifi, and this runs offline in
 * a basement lecture theatre. Everything it infers is shown back as a chip that
 * is one tap from being fixed, which is what makes it safe to be wrong.
 */
import { addDays, dayIndex, formatShort } from './dates';
import type { BucketKey, CommitmentKind, Dread, ParsedDraft } from './types';

const BUCKET_WORDS: Record<BucketKey, string[]> = {
  mental: ['assignment', 'essay', 'report', 'coursework', 'revision', 'revise', 'exam', 'reading', 'read', 'lecture', 'seminar', 'lab', 'problem set', 'dissertation', 'presentation', 'prep', 'study', 'os', 'thesis', 'quiz', 'test'],
  time:   ['shift', 'work', 'commute', 'bus', 'train', 'drive', 'travel', 'meeting', 'volunteering', 'tutoring', 'rehearsal'],
  physical: ['gym', 'run', 'running', 'swim', 'swimming', 'walk', 'cycle', 'football', 'training', 'yoga', 'climbing', 'match'],
  social: ['dinner', 'lunch', 'party', 'birthday', 'drinks', 'coffee', 'see', 'meet', 'visit', 'call', 'wedding', 'gig', 'date'],
  errands: ['laundry', 'shopping', 'shop', 'clean', 'tidy', 'bins', 'bank', 'post', 'parcel', 'pharmacy', 'prescription', 'cook', 'admin', 'form', 'renew', 'library books', 'return'],
};

/** Dread is the one thing a calendar cannot know, so we read the words around it. */
const DREAD_PHRASES: Array<[RegExp, Dread]> = [
  [/\bdreading\b|\bterrified\b|\bhate\b|\bawful\b/i, 5],
  [/\bnot looking forward\b|\bnervous\b|\banxious\b|\bugh\b|\bnot keen\b/i, 4],
  [/\bshould really\b|\bneed to\b|\bhave to\b|\bmust\b/i, 3],
  [/\bfine\b|\bok\b|\beasy\b|\bquick\b|\bdon'?t mind\b/i, 2],
  [/\blooking forward\b|\bexcited\b|\benjoy\b|\blove\b|\bfun\b/i, 1],
];

const HARD_WORDS = /\bdue\b|\bdeadline\b|\bexam\b|\bhand ?in\b|\bsubmit\b|\bshift\b|\bappointment\b/i;
const SELF_WORDS = /\bshould\b|\bwant to\b|\bmaybe\b|\btry to\b|\bif i can\b|\bat some point\b/i;

const DAY_WORDS: Array<[RegExp, number]> = [
  [/\bmon(day)?\b/i, 0], [/\btue?s(day)?\b/i, 1], [/\bwed(nes)?(day)?\b/i, 2],
  [/\bthur?s?(day)?\b/i, 3], [/\bfri(day)?\b/i, 4], [/\bsat(urday)?\b/i, 5], [/\bsun(day)?\b/i, 6],
];

function parseHours(text: string): number | null {
  const minutes = text.match(/(\d+(?:\.\d+)?)\s*(?:m|min|mins|minutes)\b/i);
  if (minutes) return Math.round((Number(minutes[1]) / 60) * 100) / 100;
  const hours = text.match(/(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)\b/i);
  if (hours) return Number(hours[1]);
  if (/\bhalf an hour\b/i.test(text)) return 0.5;
  if (/\ball day\b/i.test(text)) return 8;
  if (/\ball (?:after)?noon\b|\bafternoon\b|\bmorning\b|\bevening\b/i.test(text)) return 4;
  return null;
}

function parseDate(text: string, today: string): string | null {
  if (/\btoday\b|\btonight\b/i.test(text)) return today;
  if (/\btomorrow\b/i.test(text)) return addDays(today, 1);
  const nextWeek = /\bnext week\b/i.test(text);
  for (const [pattern, target] of DAY_WORDS) {
    if (!pattern.test(text)) continue;
    const current = dayIndex(today);
    // "due thurs" said on a Monday means this Thursday, not next.
    let delta = (target - current + 7) % 7;
    if (delta === 0) delta = 7;
    return addDays(today, nextWeek ? delta + 7 : delta);
  }
  if (nextWeek) return addDays(today, 7);
  return null;
}

function parseBucket(text: string): BucketKey {
  const lower = text.toLowerCase();
  let best: { bucket: BucketKey; score: number } = { bucket: 'mental', score: 0 };
  for (const [bucket, words] of Object.entries(BUCKET_WORDS) as Array<[BucketKey, string[]]>) {
    const score = words.reduce((total, word) => (lower.includes(word) ? total + word.length : total), 0);
    if (score > best.score) best = { bucket, score };
  }
  return best.bucket;
}

function parseDread(text: string): Dread {
  for (const [pattern, value] of DREAD_PHRASES) if (pattern.test(text)) return value;
  return 3;
}

function parseCommitment(text: string): CommitmentKind {
  if (HARD_WORDS.test(text)) return 'hard';
  if (SELF_WORDS.test(text)) return 'self';
  return 'soft';
}

/**
 * Six things inferred from one sentence, every one of them shown back as a chip.
 * `unknown` is the honest part: when the parser has no idea it says so and asks
 * one question rather than guessing wildly.
 */
export function parse(text: string, today: string): ParsedDraft {
  const hours = parseHours(text);
  const date = parseDate(text, today);
  const unknown: ParsedDraft['unknown'] = [];
  if (hours === null) unknown.push('hours');
  if (date === null) unknown.push('date');

  return {
    bucket: parseBucket(text),
    hours: hours ?? 1,
    dread: parseDread(text),
    commitment: parseCommitment(text),
    date,
    dateLabel: date ? formatShort(date) : null,
    unknown,
  };
}

/** A title the student would recognise: their own words, trimmed of the metadata. */
export function titleFrom(text: string): string {
  const head = text.split(/[,.]/)[0].trim();
  const cleaned = head
    .replace(/\b(due|by|before)\b.*/i, '')
    .replace(/\b\d+(\.\d+)?\s*(h|hr|hrs|hour|hours|m|min|mins|minutes)\b/i, '')
    .trim();
  const title = cleaned || head || 'Untitled';
  return title.charAt(0).toUpperCase() + title.slice(1);
}
