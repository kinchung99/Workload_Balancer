/**
 * Filling a sample week so every day looks lived in.
 *
 * A real student's day is not one deadline and an empty calendar: it is
 * lunch with coursemates, a library session, the gym, cooking, a society
 * meeting, a call home. This places a few of those on each day - into gaps
 * that are genuinely free, inside the hours each thing belongs in - and books
 * study sessions for every piece of owing work, the way the planner would.
 *
 * Deterministic: the same key gives the same week every time, so seeded
 * accounts and the demo read the same on every rebuild.
 */
import { dayIndex, isSameWeek } from '@/lib/dates';
import { loadOf } from '@/lib/load';
import { freeSlots } from '@/lib/schedule';
import { planSessions, remaining } from '@/lib/prep';
import type { BucketKey, CommitmentKind, Dread, Item } from '@/lib/types';

export interface Filler {
  title: string;
  bucket: BucketKey;
  hours: number;
  dread: Dread;
  commitment: CommitmentKind;
  /** The hours it belongs in: lunch at lunchtime, the gym before or after the day. */
  from: number;
  to: number;
  /** Weekdays it happens on (0 Monday). Every day when absent. */
  days?: number[];
  want?: 1 | 2 | 3 | 4 | 5;
  isRecovery?: boolean;
  place?: string;
}

const WEEKDAYS = [0, 1, 2, 3, 4];
const WEEKEND = [5, 6];

/** What fills a student's days, around the classes and the shifts. */
export const STUDENT_DAY: Filler[] = [
  { title: 'Breakfast with housemates', bucket: 'social', hours: 0.5, dread: 1, commitment: 'self', from: 7.5, to: 9.5, want: 4 },
  { title: 'Library study session', bucket: 'mental', hours: 2, dread: 3, commitment: 'self', from: 9, to: 17, days: WEEKDAYS },
  { title: 'Review lecture notes', bucket: 'mental', hours: 1, dread: 2, commitment: 'self', from: 9, to: 21 },
  { title: 'Lunch with coursemates', bucket: 'social', hours: 1, dread: 1, commitment: 'soft', from: 12, to: 14, days: WEEKDAYS, want: 4 },
  { title: 'Coffee catch-up', bucket: 'social', hours: 1, dread: 1, commitment: 'soft', from: 15, to: 18, want: 4 },
  { title: 'Run around the lake', bucket: 'physical', hours: 1, dread: 2, commitment: 'self', from: 6.5, to: 8.5 },
  { title: 'Gym, upper body', bucket: 'physical', hours: 1, dread: 2, commitment: 'self', from: 17, to: 21 },
  { title: 'Yoga and stretching', bucket: 'physical', hours: 0.5, dread: 1, commitment: 'self', from: 21, to: 23, isRecovery: true },
  { title: 'Evening walk', bucket: 'physical', hours: 0.5, dread: 1, commitment: 'self', from: 18, to: 21, isRecovery: true },
  { title: 'Cook dinner', bucket: 'errands', hours: 1, dread: 1, commitment: 'self', from: 18, to: 20 },
  { title: 'Meal prep for the week', bucket: 'errands', hours: 1.5, dread: 2, commitment: 'self', from: 10, to: 15, days: [6] },
  { title: 'Tidy room', bucket: 'errands', hours: 0.5, dread: 2, commitment: 'self', from: 19, to: 22 },
  { title: 'Society committee meeting', bucket: 'social', hours: 1.5, dread: 2, commitment: 'soft', from: 17, to: 20, days: [1, 3] },
  { title: 'Call home', bucket: 'social', hours: 0.5, dread: 1, commitment: 'self', from: 20, to: 22.5, want: 5 },
  { title: 'Read something fun', bucket: 'mental', hours: 1, dread: 1, commitment: 'self', from: 21, to: 23, isRecovery: true },
  { title: 'Power nap', bucket: 'physical', hours: 0.5, dread: 1, commitment: 'self', from: 13, to: 16, isRecovery: true },
  { title: 'Coding practice', bucket: 'mental', hours: 1, dread: 3, commitment: 'self', from: 19, to: 22, days: WEEKDAYS },
  { title: 'Volunteering at the food bank', bucket: 'time', hours: 2, dread: 2, commitment: 'soft', from: 9, to: 13, days: WEEKEND },
  { title: 'Groceries', bucket: 'errands', hours: 1, dread: 2, commitment: 'self', from: 10, to: 19, days: WEEKEND },
  { title: 'Movie night', bucket: 'social', hours: 2, dread: 1, commitment: 'soft', from: 20, to: 23, days: [4, 5], want: 5 },
  { title: 'Brunch with friends', bucket: 'social', hours: 1.5, dread: 1, commitment: 'soft', from: 10, to: 13, days: WEEKEND, want: 5 },
  { title: 'Plan the week ahead', bucket: 'mental', hours: 0.5, dread: 1, commitment: 'self', from: 19, to: 22, days: [6] },
];

/** A small, seeded random: the same key, the same week. */
function random(key: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i += 1) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Two to four things on each of these days, each in a real gap inside its own
 * hours, never on top of anything. Returns only what it added.
 */
export function fillDays(items: Item[], dates: string[], key: string, pool: Filler[] = STUDENT_DAY, perDay: [number, number] = [2, 4]): Item[] {
  const next = random(key);
  const added: Item[] = [];
  for (const date of dates) {
    const weekday = dayIndex(date);
    const want = perDay[0] + Math.floor(next() * (perDay[1] - perDay[0] + 1));
    const options = pool
      .filter((f) => !f.days || f.days.includes(weekday))
      .map((f) => ({ f, order: next() }))
      .sort((a, b) => a.order - b.order)
      .map((o) => o.f);
    let placed = 0;
    for (const f of options) {
      if (placed >= want) break;
      const busy = [...items, ...added];
      if (busy.some((i) => i.date === date && i.title === f.title)) continue;
      const slot = freeSlots(busy, date, f.hours).find((s) => Math.max(s.start, f.from) + f.hours <= Math.min(s.end, f.to));
      if (!slot) continue;
      const start = Math.ceil(Math.max(slot.start, f.from) * 2) / 2;
      if (start + f.hours > Math.min(slot.end, f.to)) continue;
      added.push({
        id: `${key}-fill-${date}-${placed}`,
        title: f.title, bucket: f.bucket, hours: f.hours, dread: f.dread, commitment: f.commitment,
        date, startHour: start,
        ...(f.want ? { want: f.want } : {}),
        ...(f.isRecovery ? { isRecovery: true } : {}),
        ...(f.place ? { place: f.place } : {}),
      });
      placed += 1;
    }
  }
  return added;
}

/** Study sessions for every piece of owing work that has none, where the planner would put them. */
export function bookSittings(items: Item[], today: string, nowHour: number, key: string): Item[] {
  const added: Item[] = [];
  for (const work of items.filter((i) => i.prepHours && !i.parentId && remaining(i) > 0)) {
    if ([...items, ...added].some((i) => i.parentId === work.id)) continue;
    planSessions(work, [...items, ...added], today, nowHour).forEach((session, index) => {
      added.push({
        id: `${key}-sit-${work.id}-${index}`,
        title: work.title, bucket: work.bucket, hours: session.hours, dread: work.dread, commitment: work.commitment,
        date: session.date, startHour: session.startHour, parentId: work.id,
        ...(work.mix ? { mix: work.mix } : {}),
      });
    });
  }
  return added;
}

/**
 * Trim a filled week back to the load it had, week by week.
 *
 * For a sample week whose numbers are quoted elsewhere (the pitch deck reads
 * the demo's battery): the days get fuller, the battery does not move. Keeps
 * the restful things and the cheap ones, and drops whichever filler best
 * closes the gap until each week's added load is within half a point of zero.
 */
export function loadNeutral(fills: Item[]): Item[] {
  const kept = [...fills];
  const weeks = [...new Set(fills.map((f) => f.date))];
  for (const anchor of weeks) {
    const inWeek = () => kept.filter((f) => isSameWeek(f.date, anchor));
    let net = inWeek().reduce((t, f) => t + loadOf(f), 0);
    while (Math.abs(net) > 0.5) {
      const candidates = inWeek().filter((f) => Math.sign(loadOf(f)) === Math.sign(net));
      if (!candidates.length) break;
      const best = candidates.reduce((a, b) => (Math.abs(net - loadOf(a)) <= Math.abs(net - loadOf(b)) ? a : b));
      if (Math.abs(net - loadOf(best)) >= Math.abs(net)) break;
      kept.splice(kept.indexOf(best), 1);
      net -= loadOf(best);
    }
  }
  return kept;
}
