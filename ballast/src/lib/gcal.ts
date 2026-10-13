/**
 * Google Calendar events, turned into things the week can weigh.
 *
 * A calendar knows when and where. It cannot know what a thing costs you, so
 * the app guesses everything it can from the title - a class, a shift, a
 * deadline, dinner - and asks only what a calendar never says: how draining it
 * is, whether it can move, and for a deadline how many hours of work it needs.
 *
 * Three rules keep it from becoming a second inbox:
 *
 *  - **A repeating event is one question.** Twelve weeks of a tutorial are set
 *    up once, and the weeks still to come are added the same way when they
 *    arrive.
 *  - **What is already in your week is left alone.** A class your timetable
 *    already has is not offered again.
 *  - **Time follows Google.** Move it there and it moves here, with a note.
 */
import { importanceOf } from './importance';
import { addDays, dayIndex, formatShort } from './dates';
import { withDrain } from './drain';
import { formatHour } from './schedule';
import type {
  BucketKey, CalDecision, CalendarEvent, CalKind, CalTemplate, CommitmentKind, Dread, Item, Mix, Module, SessionKind,
} from './types';
import type { CalendarEventDTO } from '@shared/contract';

/* ------------------------------------------------------------ from google */

const pad = (n: number) => String(n).padStart(2, '0');
const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** One event in this phone's own time: a day, an hour, a length. */
export function fromGoogle(dto: CalendarEventDTO): CalendarEvent {
  const base = { id: dto.id, seriesId: dto.seriesId, title: dto.title, location: dto.location, calendar: dto.calendar, color: dto.color };
  if (dto.allDay) return { ...base, date: dto.start.slice(0, 10), hours: 0, allDay: true };
  const start = new Date(dto.start);
  const end = new Date(dto.end);
  const startHour = start.getHours() + Math.round(start.getMinutes() / 15) / 4;
  const length = Math.round(((end.getTime() - start.getTime()) / 3_600_000) * 4) / 4;
  // Past midnight is tomorrow's problem; a day here ends at 24.
  const hours = Math.max(0.25, Math.min(length, 24 - startHour));
  return { ...base, date: localDate(start), startHour, hours, allDay: false };
}

/* ------------------------------------------------------------- the guess */

export interface KindInfo {
  label: string;
  emoji: string;
  bucket: BucketKey;
  mix: Mix;
  dread: Dread;
  commitment: CommitmentKind;
  want: 1 | 2 | 3 | 4 | 5;
  /** Work before the day, and how much it matters. */
  prep?: { hours: number; importance: 1 | 2 | 3 };
}

/** What each kind starts from. The loudest area of each mix is its drain. */
export const KIND: Record<CalKind, KindInfo> = {
  class:      { label: 'Class',      emoji: '🎓', bucket: 'mental',   mix: { mental: 3, time: 2 },               dread: 3, commitment: 'hard', want: 3 },
  assignment: { label: 'Deadline',   emoji: '📝', bucket: 'mental',   mix: { mental: 3, time: 2 },               dread: 3, commitment: 'hard', want: 3, prep: { hours: 6, importance: 2 } },
  exam:       { label: 'Exam',       emoji: '✍️', bucket: 'mental',   mix: { mental: 4, time: 2 },               dread: 4, commitment: 'hard', want: 3, prep: { hours: 10, importance: 3 } },
  shift:      { label: 'Shift',      emoji: '💼', bucket: 'time',     mix: { time: 3, physical: 2, social: 1 },  dread: 3, commitment: 'fixed', want: 3 },
  exercise:   { label: 'Exercise',   emoji: '🏃', bucket: 'physical', mix: { physical: 2 },                      dread: 2, commitment: 'self', want: 3 },
  people:     { label: 'See people', emoji: '👥', bucket: 'social',   mix: { social: 2, time: 1 },               dread: 2, commitment: 'fixed', want: 5 },
  chore:      { label: 'Errand',     emoji: '🧺', bucket: 'errands',  mix: { errands: 2, time: 1 },              dread: 2, commitment: 'soft', want: 1 },
  other:      { label: 'Other',      emoji: '📌', bucket: 'time',     mix: { time: 2 },                          dread: 2, commitment: 'soft', want: 3 },
};
export const KINDS = Object.keys(KIND) as CalKind[];

/** First match wins: "CS2040 quiz" is an exam before it is a class. */
const WORDS: Array<[CalKind, RegExp]> = [
  ['exam', /\b(exams?|midterms?|mid-terms?|finals?|quiz(zes)?|tests?)\b/i],
  ['assignment', /\b(due|deadline|submit|submission|hand[- ]?in|assignments?|essay|report|coursework|project|homework|problem sets?)\b/i],
  ['class', /\b(lectures?|lect|tutorials?|tut|labs?|seminars?|class(es)?|practicals?|workshops?|recitations?|studio)\b/i],
  ['shift', /\b(shifts?|work|job|part[- ]?time|internship|tutoring|volunteer(ing)?)\b/i],
  ['exercise', /\b(gym|run|running|swim(ming)?|yoga|badminton|football|futsal|basketball|tennis|training|climb(ing)?|cycling|pilates|workout|hike)\b/i],
  ['people', /\b(dinner|lunch|brunch|party|birthday|drinks|coffee|hang ?out|meet ?up|date|wedding|gathering|movie|film|karaoke|bbq|catch ?up)\b/i],
  ['chore', /\b(dentist|doctor|clinic|appointment|bank|haircut|groceries|laundry|errands?|post office|pharmacy|admin)\b/i],
];
/** A module code on its own - "CS2040" - is a class. */
const CODE = /\b[A-Z]{2,4}\s?\d{3,4}[A-Z]?\b/;
const FIXED_APPOINTMENT = /\b(dentist|doctor|clinic|appointment)\b/i;

export function kindOf(title: string): CalKind {
  for (const [kind, words] of WORDS) if (words.test(title)) return kind;
  return CODE.test(title) ? 'class' : 'other';
}

function sessionOf(title: string): SessionKind {
  if (/\b(labs?|practicals?|workshops?)\b/i.test(title)) return 'lab';
  if (/\b(tutorials?|tut|recitations?)\b/i.test(title)) return 'tutorial';
  if (/\bseminars?\b/i.test(title)) return 'seminar';
  return 'lecture';
}

/** The module a title is about, by its code or its name. */
export function moduleFor(title: string, modules: Module[]): Module | undefined {
  const flat = title.toUpperCase().replace(/\s+/g, '');
  return modules.find((m) => (m.code && flat.includes(m.code.toUpperCase().replace(/\s+/g, '')))
    || title.toLowerCase().includes(m.name.toLowerCase()));
}

/** Everything that can be filled in for a kind, from that kind's defaults. */
export function templateFor(kind: CalKind, title: string, module?: Module): CalTemplate {
  const info = KIND[kind];
  const dread = (module && kind === 'class' ? module.dread : info.dread) as Dread;
  return {
    title,
    kind,
    bucket: info.bucket,
    mix: withDrain({ mental: 0, time: 0, physical: 0, social: 0, errands: 0, ...info.mix }, dread, info.bucket),
    dread,
    commitment: kind === 'chore' && FIXED_APPOINTMENT.test(title) ? 'fixed' : info.commitment,
    want: info.want,
    ...(info.prep ? { prep: { hours: info.prep.hours, importance: module?.importance ?? info.prep.importance, daysBefore: 0 } } : {}),
    ...(module && (kind === 'class' || kind === 'exam' || kind === 'assignment') ? { moduleId: module.id } : {}),
    ...(kind === 'class' ? { sessionKind: sessionOf(title) } : {}),
  };
}

/** The app's best guess at a whole event, before anybody has said anything. */
export function guessFor(event: Pick<CalendarEvent, 'title'>, modules: Module[] = []): CalTemplate {
  const kind = kindOf(event.title);
  return templateFor(kind, event.title, moduleFor(event.title, modules));
}

/* --------------------------------------------------------- what is new */

/** A thing on the calendar - one event, or every week of a repeating one. */
export interface Detected {
  key: string;
  title: string;
  /** The ones still to come that are not in your week yet, by date. */
  events: CalendarEvent[];
  first: CalendarEvent;
  /** Weekly, on this day, this many more times. */
  repeat: { day: number; count: number } | null;
  guess: CalTemplate;
}

export interface CalendarPicture {
  /** Waiting for you to say what they are. */
  fresh: Detected[];
  /** Set up, and following Google. */
  added: Detected[];
  /** Already in your week - the timetable had them. */
  there: Detected[];
  skipped: Detected[];
}

export const keyOf = (event: CalendarEvent): string => event.seriesId ?? event.id;

/**
 * Words that say what kind of thing it is, not which one. "Mum's birthday
 * dinner" and "Flatmates, Sunday dinner" are both dinners and still two
 * different evenings; "Distributed Systems seminar" is the same seminar.
 */
const GENERIC = new Set([
  'the', 'and', 'with', 'for', 'lecture', 'class', 'tutorial', 'lab', 'seminar', 'due', 'meeting', 'session', 'week',
  'dinner', 'lunch', 'brunch', 'breakfast', 'birthday', 'party', 'drinks', 'coffee', 'shift', 'work', 'gym', 'call',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'today', 'tonight', 'night', 'morning',
]);
const flat = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const words = (title: string) => new Set(flat(title).split(' ').filter((w) => w.length >= 3 && !GENERIC.has(w)));

/** The same thing by name: a word that picks it out in common, or the very same title. */
export function sameName(a: string, b: string): boolean {
  if (flat(a) === flat(b)) return true;
  const mine = words(a);
  return [...words(b)].some((w) => mine.has(w));
}

/** The same thing, already in your week by hand or from the timetable. */
export function alreadyThere(event: CalendarEvent, items: Item[]): boolean {
  return items.some((item) => {
    if (item.isLog || item.parentId || item.source) return false;
    if (!(item.date === event.date || item.deadline === event.date)) return false;
    if (!sameName(item.title, event.title)) return false;
    if (event.allDay || item.startHour === undefined || event.startHour === undefined) return true;
    return Math.abs(item.startHour - event.startHour) <= 0.5;
  });
}

const upcoming = (event: CalendarEvent, today: string, nowHour: number) =>
  event.date > today || (event.date === today && (event.allDay || (event.startHour ?? 0) + event.hours > nowHour));

/** The calendar, sorted into what needs you and what is done. */
export function calendarPicture(
  events: CalendarEvent[],
  items: Item[],
  handled: Record<string, CalDecision>,
  today: string,
  nowHour: number,
  modules: Module[] = [],
): CalendarPicture {
  const imported = new Set(items.map((item) => item.source?.eventId).filter(Boolean));
  const groups = new Map<string, CalendarEvent[]>();
  for (const event of events.filter((e) => upcoming(e, today, nowHour))) {
    const key = keyOf(event);
    groups.set(key, [...(groups.get(key) ?? []), event]);
  }
  const picture: CalendarPicture = { fresh: [], added: [], there: [], skipped: [] };
  for (const [key, all] of groups) {
    const sorted = [...all].sort((a, b) => a.date.localeCompare(b.date) || (a.startHour ?? 0) - (b.startHour ?? 0));
    const open = sorted.filter((e) => !imported.has(e.id) && !alreadyThere(e, items));
    const first = open[0] ?? sorted[0];
    const detected: Detected = {
      key,
      title: first.title,
      events: open,
      first,
      repeat: sorted.length > 1 && first.seriesId ? { day: dayIndex(first.date), count: sorted.length } : null,
      guess: guessFor(first, modules),
    };
    const decision = handled[key];
    if (decision?.as === 'skipped') picture.skipped.push(detected);
    else if (decision?.as === 'added' || (sorted.some((e) => imported.has(e.id)) && !open.length)) picture.added.push(detected);
    else if (!open.length) picture.there.push(detected);
    else picture.fresh.push(detected);
  }
  picture.fresh.sort((a, b) => a.first.date.localeCompare(b.first.date) || (a.first.startHour ?? 0) - (b.first.startHour ?? 0));
  return picture;
}

/* ------------------------------------------------------------ into items */

/** A short, stable id for an event, so setting it up twice is still one item. */
export function itemIdFor(eventId: string): string {
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (let i = 0; i < eventId.length; i += 1) {
    a = Math.imul(a ^ eventId.charCodeAt(i), 0x01000193) >>> 0;
    b = Math.imul(b ^ eventId.charCodeAt(eventId.length - 1 - i), 0x811c9dc5) >>> 0;
  }
  return `gcal-${a.toString(36)}${b.toString(36)}`;
}

/** One event, set up the way the student said. */
export function itemFrom(event: CalendarEvent, template: CalTemplate): Item {
  const base = {
    id: itemIdFor(event.id),
    title: template.title,
    bucket: template.bucket,
    mix: template.mix,
    dread: template.dread,
    commitment: template.commitment,
    importance: template.importance ?? importanceOf({ want: template.want }),
    source: { kind: 'google' as const, eventId: event.id, seriesId: event.seriesId },
    ...(template.moduleId ? { moduleId: template.moduleId } : {}),
  };
  if (template.prep) {
    const due = addDays(event.date, -template.prep.daysBefore);
    return {
      ...base, date: due, deadline: due,
      hours: template.prep.hours, prepHours: template.prep.hours, prepDone: 0, importance: template.prep.importance,
    };
  }
  return {
    ...base,
    date: event.date,
    hours: event.allDay ? 1 : event.hours,
    ...(event.allDay || event.startHour === undefined ? {} : { startHour: event.startHour }),
    ...(template.want ? { want: template.want } : {}),
    ...(event.location ? { room: event.location } : {}),
    ...(template.sessionKind ? { sessionKind: template.sessionKind } : {}),
  };
}

export interface Followed {
  /** The next weeks of something already set up, set up the same way. */
  add: Item[];
  /** Things Google moved, with where they are now. */
  moved: Array<{ id: string; title: string; patch: Partial<Item> }>;
}

/** Keep the week in step with Google: new weeks of set-up series in, moved times moved. */
export function followCalendar(
  events: CalendarEvent[],
  items: Item[],
  handled: Record<string, CalDecision>,
  today: string,
  nowHour: number,
): Followed {
  const byId = new Map(events.map((e) => [e.id, e]));
  const imported = new Set(items.map((item) => item.source?.eventId).filter(Boolean));
  const add: Item[] = [];
  for (const event of events.filter((e) => upcoming(e, today, nowHour))) {
    const decision = handled[keyOf(event)];
    if (decision?.as !== 'added' || imported.has(event.id) || alreadyThere(event, items)) continue;
    // One week of a series you cancelled stays cancelled.
    if (handled[`event:${event.id}`]?.as === 'skipped') continue;
    add.push(itemFrom(event, decision.template));
  }

  const moved: Followed['moved'] = [];
  for (const item of items) {
    if (!item.source || item.outcome) continue;
    const event = byId.get(item.source.eventId);
    if (!event) continue;
    const patch: Partial<Item> = {};
    if (item.deadline !== undefined) {
      const due = event.date;
      if (item.deadline !== due) Object.assign(patch, { deadline: due, date: due });
    } else {
      if (item.date !== event.date) patch.date = event.date;
      if (!event.allDay && item.startHour !== event.startHour) patch.startHour = event.startHour;
      if (!event.allDay && item.hours !== event.hours) patch.hours = event.hours;
    }
    if (Object.keys(patch).length) moved.push({ id: item.id, title: item.title, patch });
  }
  return { add, moved };
}

/* ---------------------------------------------------------------- words */

const DAY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** "Tue 11 Nov · 6–8pm", or "Fri 21 Nov · all day". */
export function whenOf(event: CalendarEvent): string {
  if (event.allDay || event.startHour === undefined) return `${formatShort(event.date)} · all day`;
  return `${formatShort(event.date)} · ${formatHour(event.startHour)}–${formatHour(event.startHour + event.hours)}`;
}

/** "Every Tue · 4 weeks". */
export const repeatOf = (repeat: Detected['repeat']): string | null =>
  repeat ? `Every ${DAY[repeat.day]} · ${repeat.count} weeks` : null;
