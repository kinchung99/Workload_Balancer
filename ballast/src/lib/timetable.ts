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
import { addDays, dayIndex, daysBetween } from './dates';
import { loadOf } from './load';
import type { ClassFlag, CustomFlag, FlagId, Item, Module, SessionKind } from './types';

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

export const BUILT_IN_FLAGS: ClassFlag[] = ['tips', 'coursework', 'attendance'];

export const FLAG_EMOJI: Record<ClassFlag, string> = {
  tips: '💡',
  coursework: '📝',
  attendance: '✋',
};

/**
 * A custom flag's id says whether it protects the class.
 *
 * `lock-…` protects, `note-…` does not. Carrying it in the id rather than only
 * on the flag record means every pure function that asks "can this move?" -
 * the rebalancer, the ranking, the swap - gets the right answer from the item
 * alone, without each of them being handed the student's list of flags.
 * Protection is therefore fixed when the flag is made, which is also the
 * honest behaviour: a flag that quietly stopped protecting would be a trap.
 */
export const customFlagId = (protect: boolean, now = Date.now()): string => `${protect ? 'lock' : 'note'}-${now}`;

const protects = (flag: FlagId): boolean => flag === 'tips' || flag === 'attendance' || flag.startsWith('lock-');

/** A class carrying any of these is never proposed for moving or skipping. */
export const isProtectedClass = (item: Item): boolean =>
  !!item.moduleId && (item.flags ?? []).some(protects);

/** The student's own flags that belong on this module's classes. */
export const flagsFor = (moduleId: string | undefined, custom: CustomFlag[]): CustomFlag[] =>
  custom.filter((flag) => !flag.moduleId || flag.moduleId === moduleId);

/** Any flag, built-in or the student's own, as words and a picture. Null if it was deleted. */
export function flagInfo(flag: FlagId, custom: CustomFlag[] = []): { label: string; short: string; emoji: string; protect: boolean } | null {
  if ((BUILT_IN_FLAGS as string[]).includes(flag)) {
    const known = flag as ClassFlag;
    return { label: FLAG_LABEL[known], short: FLAG_SHORT[known], emoji: FLAG_EMOJI[known], protect: protects(flag) };
  }
  const mine = custom.find((c) => c.id === flag);
  return mine ? { label: mine.label, short: mine.label, emoji: mine.emoji, protect: protects(flag) } : null;
}

/** A picture for a module the student has not picked one for, guessed from its name. */
const GUESS: Array<[RegExp, string]> = [
  [/operat|system program|kernel/i, '💻'], [/algorithm|math|calcul|statistic/i, '🧮'],
  [/network|web|internet/i, '🌐'], [/distribut|cloud|parallel/i, '🛰️'], [/data|database/i, '🗄️'],
  [/\bai\b|machine|learning|intelligen/i, '🤖'], [/design|art|media/i, '🎨'], [/bio|chem|physic|lab/i, '🧪'],
  [/econ|business|financ|account/i, '📈'], [/law|legal/i, '⚖️'], [/history|literat|english|writing/i, '📜'],
  [/psych|mind|neuro/i, '🧠'], [/security|crypt/i, '🔐'],
];

export const moduleEmoji = (module: Module): string =>
  module.emoji ?? GUESS.find(([pattern]) => pattern.test(module.name))?.[1] ?? '📘';

export const MODULE_EMOJIS = ['💻', '🧮', '🌐', '🛰️', '🗄️', '🤖', '🧪', '📈', '🎨', '📜', '⚖️', '🧠', '🔐', '📘', '🎧', '⚙️'];

export const FLAG_EMOJIS = ['⭐', '🔥', '📣', '👥', '🎤', '📌', '⚠️', '🎯', '🧪', '💻', '🍕', '🎓'];

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

/**
 * Where the module is in its run: "week 10 of 12".
 *
 * Null until the student has said how many weeks it runs, because a term
 * length the app guessed would make every number below it a guess too.
 */
export function moduleTerm(module: Module, today: string): { week: number; weeks: number } | null {
  if (!module.weeks || !module.startDate) return null;
  const week = Math.floor(daysBetween(module.startDate, today) / 7) + 1;
  return { week: Math.max(1, Math.min(module.weeks, week)), weeks: module.weeks };
}

/**
 * The best attendance still possible: every class left signed into.
 *
 * Classes left are this week's not yet marked, plus the same number of classes
 * a week for every week still to run. Null where nobody counts, or while the
 * module's length is unknown.
 */
export function bestCase(module: Module, items: Item[], days: string[], today: string): number | null {
  const term = moduleTerm(module, today);
  if (module.requiredAttendance === null || !term) return null;
  const thisWeek = classesInWeek(items, days).filter((item) => item.moduleId === module.id);
  const open = thisWeek.filter((item) => !item.outcome).length;
  const left = open + Math.max(0, term.weeks - term.week) * thisWeek.length;
  const held = module.held + left;
  return held === 0 ? 100 : Math.round(((module.attended + left) / held) * 100);
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
    .trim()
    // "Algorithms Lab in Lab A": the room went, and must take its "in" with it.
    .replace(/\s+(?:in|at|room|rm)$/i, '');

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
/**
 * The modules a pasted timetable describes, one per code (or name).
 *
 * Each gets a picture: the one the student picked on the import screen, or a
 * guess from its name. Picked once, at import, because that is the one moment
 * the student is looking at the list of their modules with nothing else to do.
 */
export function modulesFrom(
  items: Item[],
  pictures: Record<string, string> = {},
  weeks: Record<string, number> = {},
  startDate?: string,
): Module[] {
  return [...new Set(items.map((item) => item.moduleId!).filter(Boolean))].map((id) => {
    const first = items.find((item) => item.moduleId === id)!;
    const module: Module = {
      id,
      code: id.replace('imported-', '').toUpperCase().slice(0, 8),
      name: first.title.replace(/\s\w+$/, ''),
      dread: 2,
      importance: 2,
      attended: 0,
      held: 0,
      requiredAttendance: null,
      weeks: weeks[id] ?? 12,
      startDate,
    };
    return { ...module, emoji: pictures[id] ?? moduleEmoji(module) };
  });
}

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
