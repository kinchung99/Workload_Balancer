/**
 * The timetable.
 *
 * The interface study calls this "imported, zero effort", and it is the largest
 * single block of a student's week. It was previously a fourteen-hour lump that
 * counted toward the load and appeared nowhere on the calendar — the fullest
 * part of the day, invisible.
 *
 * Importing is a paste, not a scan. Every university portal will copy as text,
 * every student already has that text, and a parser that runs offline beats an
 * OCR round-trip that needs a camera, a permission dialogue and a network.
 */
import { addDays, dayIndex } from './dates';
import { loadOf } from './load';
import type { ClassFlag, Item, Module, SessionKind } from './types';

export const SESSION_KINDS: SessionKind[] = ['lecture', 'lab', 'tutorial', 'seminar'];

export const FLAG_LABEL: Record<ClassFlag, string> = {
  tips: 'Gives exam tips',
  coursework: 'Sets coursework',
  attendance: 'Attendance counted',
};

export const FLAG_SHORT: Record<ClassFlag, string> = {
  tips: 'Tips',
  coursework: 'Work set',
  attendance: 'Register',
};

/** A class carrying any of these is never proposed for moving or skipping. */
export const isProtectedClass = (item: Item): boolean =>
  !!item.moduleId && (item.flags ?? []).some((flag) => flag === 'tips' || flag === 'attendance');

export const classesOn = (items: Item[], date: string): Item[] =>
  items
    .filter((item) => item.moduleId && item.date === date)
    .sort((a, b) => (a.startHour ?? 0) - (b.startHour ?? 0));

export const classesInWeek = (items: Item[], days: string[]): Item[] =>
  days.flatMap((date) => classesOn(items, date));

/** Contact hours and load for one module across the given days. */
export function moduleWeek(items: Item[], moduleId: string, days: string[]) {
  const sessions = classesInWeek(items, days).filter((item) => item.moduleId === moduleId);
  return {
    sessions,
    hours: Math.round(sessions.reduce((total, item) => total + item.hours, 0) * 10) / 10,
    load: Math.round(sessions.reduce((total, item) => total + loadOf(item), 0) * 10) / 10,
  };
}

export const attendanceRate = (module: Module): number =>
  module.held === 0 ? 100 : Math.round((module.attended / module.held) * 100);

/** Below the line, or one absence away from it. */
export function attendanceStatus(module: Module): 'fine' | 'close' | 'below' | 'untracked' {
  if (module.requiredAttendance === null) return 'untracked';
  const now = attendanceRate(module);
  if (now < module.requiredAttendance) return 'below';
  const ifMissedOne = Math.round((module.attended / (module.held + 1)) * 100);
  return ifMissedOne < module.requiredAttendance ? 'close' : 'fine';
}

// ---------------------------------------------------------------- importing

const DAYS: Array<[RegExp, number]> = [
  [/\bmon/i, 0], [/\btue/i, 1], [/\bwed/i, 2], [/\bthu/i, 3], [/\bfri/i, 4], [/\bsat/i, 5], [/\bsun/i, 6],
];

const KIND_WORDS: Array<[RegExp, SessionKind]> = [
  [/\blec/i, 'lecture'], [/\blab|practical|workshop/i, 'lab'],
  [/\btut|seminar group|exercise/i, 'tutorial'], [/\bsem/i, 'seminar'],
];

const toHour = (text: string): number | null => {
  const match = text.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minutes = match[2] ? Number(match[2]) / 60 : 0;
  const suffix = match[3]?.toLowerCase();
  if (suffix === 'pm' && hour < 12) hour += 12;
  if (suffix === 'am' && hour === 12) hour = 0;
  return hour + minutes;
};

export interface ParsedClass {
  day: number;
  startHour: number;
  hours: number;
  code?: string;
  name: string;
  kind: SessionKind;
  room?: string;
}

/**
 * One line of a pasted timetable.
 *
 * Tolerant on purpose: portals export every shape of this, and a line the parser
 * cannot read is shown back rather than dropped, so nothing disappears silently.
 */
export function parseLine(line: string): ParsedClass | null {
  const text = line.trim();
  if (!text) return null;

  const day = DAYS.find(([pattern]) => pattern.test(text))?.[1];
  if (day === undefined) return null;

  const span = text.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:-|–|to|until)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
  if (!span) return null;
  const start = toHour(span[1].replace(/\s+/g, ''));
  const end = toHour(span[2].replace(/\s+/g, ''));
  if (start === null || end === null || end <= start) return null;

  const kind = KIND_WORDS.find(([pattern]) => pattern.test(text))?.[1] ?? 'lecture';
  const code = text.match(/\b([A-Z]{2,4}\s?\d{3,5})\b/)?.[1];
  const room = text.match(/\b(?:room|rm|in)\s+([A-Za-z0-9.\- ]{2,16})/i)?.[1]?.trim()
    ?? text.match(/\b([A-Z][A-Za-z]+\s(?:LT|TH)?\s?\d{1,4}[A-Za-z]?)\s*$/)?.[1];

  // Whatever is left once the machine-readable parts are removed is the name.
  const name = text
    .replace(span[0], ' ')
    .replace(/\b(mon|tue|wed|thu|fri|sat|sun)[a-z]*\b/i, ' ')
    .replace(code ?? '', ' ')
    .replace(room ?? '', ' ')
    .replace(/\b(lecture|lab|practical|workshop|tutorial|seminar|exercise)s?\b/i, ' ')
    .replace(/[|,;:]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return {
    day,
    startHour: start,
    hours: Math.round((end - start) * 10) / 10,
    code,
    name: name || code || 'Class',
    kind,
    room,
  };
}

export interface ImportResult {
  classes: ParsedClass[];
  /** Lines the parser could not read, shown back rather than dropped. */
  skipped: string[];
}

export function parseTimetable(text: string): ImportResult {
  const classes: ParsedClass[] = [];
  const skipped: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const parsed = parseLine(line);
    if (parsed) classes.push(parsed);
    else skipped.push(line.trim());
  }
  return { classes, skipped };
}

/** Turn parsed lines into real items on the week that `anchor` falls in. */
export function toItems(parsed: ParsedClass[], anchor: string, dread: 1 | 2 | 3 | 4 | 5): Item[] {
  const monday = addDays(anchor, -dayIndex(anchor));
  return parsed.map((entry, index) => ({
    id: `imported-${entry.day}-${entry.startHour}-${index}`,
    title: `${entry.name} ${entry.kind}`,
    bucket: 'time' as const,
    hours: entry.hours,
    dread,
    commitment: 'hard' as const,
    date: addDays(monday, entry.day),
    startHour: entry.startHour,
    repeats: true,
    moduleId: `imported-${(entry.code ?? entry.name).toLowerCase().replace(/[^a-z0-9]+/g, '')}`,
    sessionKind: entry.kind,
    room: entry.room,
    flags: [],
  }));
}
