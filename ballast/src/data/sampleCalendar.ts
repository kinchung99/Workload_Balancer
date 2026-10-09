/**
 * A Google Calendar for the sample week.
 *
 * Nobody signs in to the demo, so there is no real calendar to read. This is
 * what a second-year's might look like over the next four weeks - a weekly
 * class the timetable does not have, a deadline, shifts, a birthday - plus a
 * seminar the timetable already has, so "already in your week" can be seen.
 */
import { addDays } from '@/lib/dates';
import type { CalendarEvent, CalendarLink } from '@/lib/types';

const BLUE = '#4285F4';
const GREEN = '#0B8043';
const GRAPE = '#8E24AA';

const weekly = (
  id: string, title: string, firstOffset: number, startHour: number, hours: number,
  today: string, calendar: string, color: string, location: string | null = null,
): CalendarEvent[] =>
  [0, 7, 14, 21].map((plus) => ({
    id: `${calendar}|${id}_${addDays(today, firstOffset + plus)}`,
    seriesId: `${calendar}|${id}`,
    title, date: addDays(today, firstOffset + plus), startHour, hours, allDay: false, location, calendar, color,
  }));

const once = (
  id: string, title: string, offset: number, startHour: number | null, hours: number,
  today: string, calendar: string, color: string, location: string | null = null,
): CalendarEvent => ({
  id: `${calendar}|${id}`, seriesId: null, title, date: addDays(today, offset),
  ...(startHour === null ? { allDay: true, hours: 0 } : { startHour, hours, allDay: false }),
  location, calendar, color,
});

export function sampleCalendar(today: string): CalendarEvent[] {
  return [
    ...weekly('mandarin', 'Mandarin class', 1, 18.5, 1.5, today, 'Main calendar', BLUE, 'Language Centre 2.04'),
    ...weekly('badminton', 'Badminton with the club', 3, 20, 2, today, 'Main calendar', BLUE, 'Sports Hall'),
    ...weekly('ds-seminar', 'Distributed Systems seminar', 2, 15, 2, today, 'Uni timetable', GREEN, 'Crawford H').slice(0, 2),
    ...weekly('cafe', 'Café shift', 5, 10, 6, today, 'Work', GRAPE, 'Bean There').slice(0, 2),
    once('essay', 'Ethics essay due', 11, null, 0, today, 'Main calendar', BLUE),
    once('dentist', 'Dentist', 3, 10, 0.5, today, 'Main calendar', BLUE, 'Smile Clinic'),
    once('mum', 'Mum’s birthday dinner', 6, 19, 2, today, 'Main calendar', BLUE),
    once('fair', 'Career fair', 9, 12, 3, today, 'Uni timetable', GREEN, 'Students’ Union'),
  ];
}

export const sampleLink = (now: string): CalendarLink => ({
  via: 'sample',
  email: 'you@gmail.com',
  status: 'ok',
  lastSyncedAt: now,
  calendars: [
    { id: 'Main calendar', name: 'Main calendar', color: BLUE, on: true },
    { id: 'Uni timetable', name: 'Uni timetable', color: GREEN, on: true },
    { id: 'Work', name: 'Work', color: GRAPE, on: true },
  ],
});
