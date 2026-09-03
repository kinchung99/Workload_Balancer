/**
 * Date helpers. Deliberately string-based (ISO yyyy-mm-dd) and UTC-anchored so
 * the seeded demo renders identically on every judge's phone in every timezone.
 */

export const DAY_LETTER = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DAY_NAME = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const parseISO = (iso: string): Date => new Date(`${iso}T00:00:00Z`);
export const toISO = (date: Date): string => date.toISOString().slice(0, 10);

export function addDays(iso: string, days: number): string {
  const date = parseISO(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return toISO(date);
}

/** 0 = Monday. */
export const dayIndex = (iso: string): number => (parseISO(iso).getUTCDay() + 6) % 7;

export const startOfWeek = (iso: string): string => addDays(iso, -dayIndex(iso));

export const isSameWeek = (a: string, b: string): boolean => startOfWeek(a) === startOfWeek(b);

export const dayName = (iso: string): string => DAY_NAME[dayIndex(iso)];

export function formatShort(iso: string): string {
  const date = parseISO(iso);
  return `${DAY_NAME[dayIndex(iso)].slice(0, 3)} ${date.getUTCDate()} ${MONTH_SHORT[date.getUTCMonth()]}`;
}

export function formatLong(iso: string): string {
  const date = parseISO(iso);
  return `${DAY_NAME[dayIndex(iso)]} ${date.getUTCDate()} ${MONTH_LONG[date.getUTCMonth()]}`;
}

export const daysBetween = (from: string, to: string): number =>
  Math.round((parseISO(to).getTime() - parseISO(from).getTime()) / 86_400_000);

/** The n-day window the forecast strip draws. */
export const range = (from: string, days: number): string[] =>
  Array.from({ length: days }, (_, i) => addDays(from, i));
