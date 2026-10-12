/// <reference types="node" />
/**
 * Five real accounts for the judges - made, filled and befriended through the
 * live API, exactly the way a student's own phone would.
 *
 *   npm run judges:seed              make them (or refresh them: they are rebuilt)
 *
 * Each is a believable Monash Malaysia student with a real timetable, coursework
 * with deadlines and hours of work, shifts, plans and a few moods. Their weeks
 * are built around *today*, so run this again whenever the dates go stale.
 * Rebuilding deletes the five accounts first (needs server/.env DATABASE_URL),
 * which also undoes anything the judges changed.
 *
 * Between them they show every social state: everyone is friends; one group
 * with everyone in it and one with an invitation waiting; plans that are
 * confirmed, waiting, and turned down; a friend who has been heavy for days.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { addDays, dayIndex, isSameWeek, startOfWeek } from '@/lib/dates';
import { classItems, type ClassSlot } from '@/lib/timetable';
import { bandFor, DEFAULT_CEILINGS, DEFAULT_OVERALL_CEILING, overallOf } from '@/lib/load';
import { countedOnce } from '@/lib/prep';
import { chargeOf } from '@/lib/battery';
import { published, DEFAULT_SHARE_RULES } from '@/lib/sharing';
import type { Item, Module, MoodCheckIn, RecoveryEntry, SessionKind } from '@/lib/types';
import { bookSittings, fillDays } from '@/data/dayFiller';

const API = process.env.API ?? 'https://ballast-ckc3.vercel.app';
const ORIGIN = 'https://load-balancer-ballast.expo.app';
export const PASSWORD = 'BallastDemo2026';

const pad = (n: number) => String(n).padStart(2, '0');
const now = new Date();
const TODAY = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
const W0 = startOfWeek(TODAY);
const at = (week: number, day: number) => addDays(W0, week * 7 + day);
/** Week 10 of 12 right now, so "week 10 of 12" reads true on every module. */
const TERM_START = addDays(W0, -63);

/* ------------------------------------------------------------ the people */

interface Persona {
  key: string;
  name: string;
  email: string;
  status: string;
  heavyForDays: number;
  /** Their own limit, as a share of the default - learnt from their own hard days. */
  capacity: number;
  modules: Array<Omit<Module, 'weeks' | 'startDate'>>;
  classes: Array<{ module: string; kind: SessionKind; day: number; start: number; hours: number; room: string; flags?: Item['flags'] }>;
  /** The same every week: shifts, sport, chores. */
  weekly: Array<Omit<Item, 'id' | 'date'> & { day: number }>;
  /** One-offs, by week (0 this week) and day (0 Monday). */
  once: Array<Omit<Item, 'id' | 'date' | 'deadline'> & { week: number; day: number; due?: boolean }>;
  moods: Array<{ daysAgo: number; quadrant: MoodCheckIn['quadrant']; tags: MoodCheckIn['tags'] }>;
  recovery: RecoveryEntry[];
}

const M = (id: string, code: string, name: string, dread: 1 | 2 | 3 | 4 | 5, importance: 1 | 2 | 3, attended: number, held: number, requiredAttendance: number | null, emoji: string) =>
  ({ id, code, name, dread, importance, attended, held, requiredAttendance, emoji }) as Omit<Module, 'weeks' | 'startDate'>;

const PEOPLE: Persona[] = [
  {
    key: 'aisyah', name: 'Aisyah Rahman', email: 'aisyah.ballast@example.com',
    status: '😵‍💫 Two deadlines next week', heavyForDays: 2, capacity: 0.72,
    modules: [
      M('fit2004', 'FIT2004', 'Algorithms and Data Structures', 4, 3, 16, 18, 80, '🧮'),
      M('fit2100', 'FIT2100', 'Operating Systems', 3, 3, 14, 18, null, '💻'),
      M('fit2014', 'FIT2014', 'Theory of Computation', 4, 2, 15, 18, null, '🧠'),
      M('fit2099', 'FIT2099', 'Object-Oriented Design', 2, 2, 17, 18, 80, '🧩'),
    ],
    classes: [
      { module: 'fit2004', kind: 'lecture', day: 0, start: 10, hours: 2, room: 'LT1', flags: ['tips'] },
      { module: 'fit2004', kind: 'tutorial', day: 2, start: 14, hours: 2, room: 'Lab 4-05', flags: ['attendance'] },
      { module: 'fit2100', kind: 'lecture', day: 1, start: 9, hours: 2, room: 'LT3' },
      { module: 'fit2100', kind: 'lab', day: 3, start: 13, hours: 2, room: 'Lab 2-12' },
      { module: 'fit2014', kind: 'lecture', day: 2, start: 10, hours: 2, room: 'LT2' },
      { module: 'fit2014', kind: 'tutorial', day: 4, start: 11, hours: 1, room: '5-14' },
      { module: 'fit2099', kind: 'lecture', day: 0, start: 14, hours: 1, room: 'LT4' },
      { module: 'fit2099', kind: 'lab', day: 3, start: 9, hours: 2, room: 'Lab 4-02', flags: ['attendance'] },
    ],
    weekly: [
      { title: 'Algorithms practice problems', bucket: 'mental', hours: 3, dread: 4, commitment: 'self', day: 1, startHour: 13, repeats: true },
      { title: 'OS lecture catch-up', bucket: 'mental', hours: 2, dread: 3, commitment: 'self', day: 2, startHour: 19, repeats: true },
      { title: 'Theory of Computation readings', bucket: 'mental', hours: 3, dread: 4, commitment: 'self', day: 4, startHour: 14, repeats: true },
      { title: 'Commute, LRT to campus', bucket: 'time', hours: 5, dread: 2, commitment: 'hard', day: 0, repeats: true, spread: true },
      { title: 'Tutoring, SPM maths', bucket: 'time', hours: 2, dread: 2, commitment: 'hard', day: 1, startHour: 18, repeats: true },
      { title: 'Tutoring, SPM maths', bucket: 'time', hours: 3, dread: 2, commitment: 'hard', day: 5, startHour: 10, repeats: true },
      { title: 'Gym at Sunway campus', bucket: 'physical', hours: 1, dread: 2, commitment: 'self', day: 0, startHour: 19, repeats: true },
      { title: 'Laundry and groceries', bucket: 'errands', hours: 1.5, dread: 2, commitment: 'self', day: 6, startHour: 10, repeats: true },
      { title: 'Call mum', bucket: 'social', hours: 1, dread: 1, commitment: 'self', day: 6, startHour: 20, repeats: true },
    ],
    once: [
      { title: 'FIT2004 Assignment 3: graph algorithms', bucket: 'mental', hours: 12, dread: 4, commitment: 'hard', week: 1, day: 3, due: true, prepHours: 12, prepDone: 7, importance: 3, moduleId: 'fit2004' },
      { title: 'FIT2100 Assignment 2: process scheduler', bucket: 'mental', hours: 10, dread: 4, commitment: 'hard', week: 1, day: 2, due: true, prepHours: 10, prepDone: 6, importance: 3, moduleId: 'fit2100' },
      { title: 'FIT2014 Problem set 8', bucket: 'mental', hours: 4, dread: 3, commitment: 'soft', week: 1, day: 4, due: true, prepHours: 4, prepDone: 0, importance: 2, moduleId: 'fit2014' },
      { title: 'FIT2099 Sprint review with the team', bucket: 'social', hours: 2, dread: 3, commitment: 'hard', week: 1, day: 1, startHour: 15 },
      { title: 'Mamak with Daniel and Mei Ling', bucket: 'social', hours: 2, dread: 1, commitment: 'soft', week: 0, day: 5, startHour: 21, want: 5 },
      { title: 'Renew student pass, photos', bucket: 'errands', hours: 1, dread: 3, commitment: 'hard', week: 1, day: 0, startHour: 12, place: 'in Sunway' },
      { title: 'Swim, Wednesday morning', bucket: 'physical', hours: 1, dread: 2, commitment: 'self', week: 1, day: 2, startHour: 7, isRecovery: true },
      { title: 'Exam revision plan', bucket: 'mental', hours: 3, dread: 3, commitment: 'self', week: 2, day: 5, startHour: 10 },
      // Next week's movable things - what Rebalance can actually offer her.
      { title: 'Read ahead: FIT2014 chapter 7', bucket: 'mental', hours: 3, dread: 3, commitment: 'self', week: 1, day: 5, startHour: 15 },
      { title: 'Extra tutoring, covering Mr Lee', bucket: 'time', hours: 3, dread: 3, commitment: 'soft', week: 1, day: 2, startHour: 17, want: 2 },
      { title: 'CS society games night', bucket: 'social', hours: 3, dread: 2, commitment: 'soft', week: 1, day: 2, startHour: 20, want: 3 },
      { title: 'Post office, parcel home', bucket: 'errands', hours: 1, dread: 2, commitment: 'self', week: 1, day: 1, startHour: 12, place: 'in Sunway' },
      { title: 'Bank, update my card', bucket: 'errands', hours: 1, dread: 3, commitment: 'self', week: 1, day: 3, startHour: 12, place: 'in Sunway' },
    ],
    moods: [
      { daysAgo: 1, quadrant: 'high-unpleasant', tags: ['Academics'] },
      { daysAgo: 2, quadrant: 'low-pleasant', tags: ['Social'] },
      { daysAgo: 3, quadrant: 'low-unpleasant', tags: ['Academics', 'Health'] },
    ],
    recovery: [
      { id: 'sleep', label: 'Sleep', detail: '6.3h average, an hour under your baseline', hours: -6, emoji: '😴', tag: '6.3h a night' },
      { id: 'movement', label: 'Movement', detail: 'Two gym sessions this week', hours: 2, emoji: '🏋️', tag: '2 sessions' },
    ],
  },
  {
    key: 'daniel', name: 'Daniel Lim', email: 'daniel.ballast@example.com',
    status: '🏸 Free most evenings', heavyForDays: 0, capacity: 0.8,
    modules: [
      M('acf3200', 'ACF3200', 'Financial Reporting', 3, 3, 15, 18, null, '📊'),
      M('bfc3140', 'BFC3140', 'Corporate Finance', 3, 3, 16, 18, null, '💹'),
      M('mkt2150', 'MKT2150', 'Consumer Behaviour', 2, 2, 17, 18, null, '🛍️'),
      M('mgx3100', 'MGX3100', 'Strategic Management', 2, 2, 14, 18, 80, '♟️'),
    ],
    classes: [
      { module: 'acf3200', kind: 'lecture', day: 0, start: 13, hours: 2, room: 'LT5' },
      { module: 'acf3200', kind: 'tutorial', day: 2, start: 9, hours: 1, room: '3-11' },
      { module: 'bfc3140', kind: 'lecture', day: 1, start: 15, hours: 2, room: 'LT2', flags: ['tips'] },
      { module: 'bfc3140', kind: 'tutorial', day: 3, start: 11, hours: 1, room: '3-08' },
      { module: 'mkt2150', kind: 'lecture', day: 2, start: 16, hours: 2, room: 'LT6' },
      { module: 'mgx3100', kind: 'seminar', day: 4, start: 10, hours: 2, room: '6-02', flags: ['attendance'] },
    ],
    weekly: [
      { title: 'Finance readings', bucket: 'mental', hours: 2, dread: 2, commitment: 'self', day: 2, startHour: 19, repeats: true },
      { title: 'Group project catch-up', bucket: 'social', hours: 1.5, dread: 2, commitment: 'soft', day: 3, startHour: 16, repeats: true },
      { title: 'Barista shift, Sunway Pyramid', bucket: 'time', hours: 5, dread: 2, commitment: 'hard', day: 4, startHour: 18, repeats: true },
      { title: 'Barista shift, Sunway Pyramid', bucket: 'time', hours: 6, dread: 2, commitment: 'hard', day: 6, startHour: 9, repeats: true },
      { title: 'Badminton with the club', bucket: 'physical', hours: 2, dread: 1, commitment: 'self', day: 1, startHour: 20, repeats: true, want: 5 },
      { title: 'Groceries at Jaya Grocer', bucket: 'errands', hours: 1, dread: 1, commitment: 'self', day: 5, startHour: 11, repeats: true },
    ],
    once: [
      { title: 'BFC3140 Valuation report (group)', bucket: 'mental', hours: 8, dread: 3, commitment: 'hard', week: 1, day: 4, due: true, prepHours: 8, prepDone: 3, importance: 3, moduleId: 'bfc3140' },
      { title: 'ACF3200 Quiz 4 revision', bucket: 'mental', hours: 3, dread: 3, commitment: 'hard', week: 1, day: 2, due: true, prepHours: 3, prepDone: 1, importance: 2, moduleId: 'acf3200' },
      { title: 'MKT2150 Survey analysis', bucket: 'mental', hours: 6, dread: 2, commitment: 'soft', week: 2, day: 0, due: true, prepHours: 6, prepDone: 0, importance: 2, moduleId: 'mkt2150' },
      { title: 'Internship application, Big 4', bucket: 'mental', hours: 4, dread: 3, commitment: 'self', week: 2, day: 4, due: true, prepHours: 4, prepDone: 1, importance: 3 },
      { title: 'Mamak with Aisyah and Mei Ling', bucket: 'social', hours: 2, dread: 1, commitment: 'soft', week: 0, day: 5, startHour: 21, want: 5 },
      { title: 'Family dinner', bucket: 'social', hours: 2, dread: 1, commitment: 'soft', week: 0, day: 6, startHour: 19, want: 5 },
    ],
    moods: [
      { daysAgo: 1, quadrant: 'high-pleasant', tags: ['Social'] },
      { daysAgo: 2, quadrant: 'low-pleasant', tags: [] },
      { daysAgo: 4, quadrant: 'high-unpleasant', tags: ['Personal'] },
    ],
    recovery: [
      { id: 'sleep', label: 'Sleep', detail: '7.4h average, right on your baseline', hours: 1, emoji: '😴', tag: '7.4h a night' },
      { id: 'movement', label: 'Movement', detail: 'Badminton twice this week', hours: 3, emoji: '🏸', tag: '2 games' },
    ],
  },
  {
    key: 'priya', name: 'Priya Nair', email: 'priya.ballast@example.com',
    status: '🧪 Lab report weekend', heavyForDays: 6, capacity: 0.66,
    modules: [
      M('bms2021', 'BMS2021', 'Human Neurobiology', 4, 3, 16, 18, 80, '🧠'),
      M('bms2042', 'BMS2042', 'Molecular Cell Biology', 3, 3, 17, 18, 80, '🧬'),
      M('bms2031', 'BMS2031', 'Body Systems', 3, 2, 15, 18, null, '🫀'),
      M('bms2062', 'BMS2062', 'Introduction to Bioinformatics', 4, 2, 13, 18, null, '💻'),
    ],
    classes: [
      { module: 'bms2021', kind: 'lecture', day: 0, start: 9, hours: 2, room: 'LT1', flags: ['tips'] },
      { module: 'bms2021', kind: 'lab', day: 2, start: 13, hours: 3, room: 'Bio Lab 2', flags: ['attendance'] },
      { module: 'bms2042', kind: 'lecture', day: 1, start: 11, hours: 2, room: 'LT3' },
      { module: 'bms2042', kind: 'lab', day: 3, start: 14, hours: 3, room: 'Bio Lab 1', flags: ['attendance'] },
      { module: 'bms2031', kind: 'lecture', day: 3, start: 9, hours: 2, room: 'LT2' },
      { module: 'bms2062', kind: 'lab', day: 4, start: 13, hours: 2, room: 'Lab 4-01' },
    ],
    weekly: [
      { title: 'Neurobiology lecture review', bucket: 'mental', hours: 3, dread: 4, commitment: 'self', day: 0, startHour: 19, repeats: true },
      { title: 'Lab prep and pre-lab quiz', bucket: 'mental', hours: 2, dread: 4, commitment: 'hard', day: 1, startHour: 19, repeats: true },
      { title: 'Bioinformatics coding practice', bucket: 'mental', hours: 3, dread: 5, commitment: 'self', day: 3, startHour: 19, repeats: true },
      { title: 'Cell biology flashcards', bucket: 'mental', hours: 2, dread: 3, commitment: 'self', day: 4, startHour: 16, repeats: true },
      { title: 'Commute, bus from Subang', bucket: 'time', hours: 8, dread: 3, commitment: 'hard', day: 0, repeats: true, spread: true },
      { title: 'Volunteering, Sunway Medical Centre', bucket: 'time', hours: 4, dread: 2, commitment: 'soft', day: 5, startHour: 9, repeats: true },
      { title: 'Yoga', bucket: 'physical', hours: 1, dread: 1, commitment: 'self', day: 2, startHour: 19, repeats: true, isRecovery: true },
      { title: 'Laundry', bucket: 'errands', hours: 1, dread: 2, commitment: 'self', day: 6, startHour: 11, repeats: true },
    ],
    once: [
      { title: 'BMS2042 Lab report: PCR and gel', bucket: 'mental', hours: 8, dread: 4, commitment: 'hard', week: 0, day: 6, due: true, prepHours: 8, prepDone: 4, importance: 3, moduleId: 'bms2042' },
      { title: 'BMS2031 Online quiz 3', bucket: 'mental', hours: 2, dread: 4, commitment: 'hard', week: 0, day: 3, startHour: 21 },
      { title: 'Extra volunteering shift, covering a friend', bucket: 'time', hours: 5, dread: 3, commitment: 'soft', week: 0, day: 2, startHour: 17, want: 2 },
      { title: 'BMS2021 Mid-semester exam revision', bucket: 'mental', hours: 10, dread: 5, commitment: 'hard', week: 1, day: 0, due: true, prepHours: 10, prepDone: 2, importance: 3, moduleId: 'bms2021' },
      { title: 'BMS2062 Python practical 5', bucket: 'mental', hours: 4, dread: 4, commitment: 'soft', week: 1, day: 3, due: true, prepHours: 4, prepDone: 0, importance: 2, moduleId: 'bms2062' },
      { title: 'Journal summary for bioinformatics', bucket: 'mental', hours: 3, dread: 2, commitment: 'self', week: 2, day: 2, due: true, prepHours: 3, prepDone: 0, importance: 1, moduleId: 'bms2062' },
      { title: 'Movie night with housemates', bucket: 'social', hours: 3, dread: 1, commitment: 'soft', week: 1, day: 4, startHour: 20, want: 4 },
    ],
    moods: [
      { daysAgo: 1, quadrant: 'low-unpleasant', tags: ['Academics'] },
      { daysAgo: 2, quadrant: 'high-unpleasant', tags: ['Academics', 'Health'] },
      { daysAgo: 3, quadrant: 'low-unpleasant', tags: ['Health'] },
    ],
    recovery: [
      { id: 'sleep', label: 'Sleep', detail: '5.8h average, 1.5h under your baseline', hours: -10, emoji: '😴', tag: '5.8h a night' },
      { id: 'dayoff', label: 'Last full day off', detail: '19 days ago', hours: null, emoji: '📅', tag: '19 days ago' },
    ],
  },
  {
    key: 'hafiz', name: 'Hafiz Ismail', email: 'hafiz.ballast@example.com',
    status: '🏗️ Design project crunch', heavyForDays: 1, capacity: 0.62,
    modules: [
      M('eng2005', 'ENG2005', 'Advanced Engineering Mathematics', 4, 3, 15, 18, null, '📐'),
      M('civ3221', 'CIV3221', 'Building Structures and Technology', 3, 3, 16, 18, 80, '🏗️'),
      M('civ3248', 'CIV3248', 'Groundwater and Environmental Engineering', 3, 2, 14, 18, null, '💧'),
      M('civ3283', 'CIV3283', 'Road Engineering', 2, 2, 16, 18, null, '🛣️'),
    ],
    classes: [
      { module: 'eng2005', kind: 'lecture', day: 0, start: 11, hours: 2, room: 'LT2', flags: ['tips'] },
      { module: 'eng2005', kind: 'tutorial', day: 2, start: 9, hours: 2, room: '9-03' },
      { module: 'civ3221', kind: 'lecture', day: 1, start: 10, hours: 2, room: 'LT4' },
      { module: 'civ3221', kind: 'lab', day: 3, start: 14, hours: 3, room: 'Design studio', flags: ['coursework', 'attendance'] },
      { module: 'civ3248', kind: 'lecture', day: 2, start: 15, hours: 2, room: 'LT5' },
      { module: 'civ3283', kind: 'lecture', day: 4, start: 9, hours: 2, room: 'LT1' },
    ],
    weekly: [
      { title: 'Engineering maths problem sheets', bucket: 'mental', hours: 3, dread: 4, commitment: 'self', day: 1, startHour: 14, repeats: true },
      { title: 'Design project drafting', bucket: 'mental', hours: 3, dread: 3, commitment: 'soft', day: 4, startHour: 14, repeats: true },
      { title: 'Commute, drive from Klang', bucket: 'time', hours: 6, dread: 3, commitment: 'hard', day: 0, repeats: true, spread: true },
      { title: 'Site survey assistant (part-time)', bucket: 'time', hours: 5, dread: 3, commitment: 'hard', day: 5, startHour: 8, repeats: true },
      { title: 'Futsal, Thursday league', bucket: 'physical', hours: 2, dread: 1, commitment: 'soft', day: 3, startHour: 21, repeats: true, want: 5 },
      { title: 'Kitchen duty, shared house', bucket: 'errands', hours: 1, dread: 2, commitment: 'soft', day: 1, startHour: 19, repeats: true },
    ],
    once: [
      { title: 'CIV3221 Design project: steel frame (group)', bucket: 'mental', hours: 14, dread: 4, commitment: 'hard', week: 1, day: 2, due: true, prepHours: 14, prepDone: 5, importance: 3, moduleId: 'civ3221' },
      { title: 'ENG2005 Assignment 3', bucket: 'mental', hours: 5, dread: 4, commitment: 'hard', week: 1, day: 0, due: true, prepHours: 5, prepDone: 1, importance: 3, moduleId: 'eng2005' },
      { title: 'CIV3248 Field trip report', bucket: 'mental', hours: 6, dread: 3, commitment: 'soft', week: 2, day: 1, due: true, prepHours: 6, prepDone: 0, importance: 2, moduleId: 'civ3248' },
      { title: 'Design project group meeting', bucket: 'social', hours: 2, dread: 3, commitment: 'hard', week: 1, day: 0, startHour: 16 },
      { title: 'My birthday dinner 🎂', bucket: 'social', hours: 2.5, dread: 1, commitment: 'soft', week: 1, day: 3, startHour: 18.5, want: 5 },
    ],
    moods: [
      { daysAgo: 1, quadrant: 'high-unpleasant', tags: ['Academics'] },
      { daysAgo: 2, quadrant: 'high-pleasant', tags: ['Social'] },
      { daysAgo: 4, quadrant: 'low-pleasant', tags: [] },
    ],
    recovery: [
      { id: 'sleep', label: 'Sleep', detail: '6.6h average', hours: -3, emoji: '😴', tag: '6.6h a night' },
      { id: 'movement', label: 'Movement', detail: 'Futsal every Thursday', hours: 2, emoji: '⚽', tag: 'Weekly futsal' },
    ],
  },
  {
    key: 'meiling', name: 'Mei Ling Tan', email: 'meiling.ballast@example.com',
    status: '🎨 Studio crit on Monday', heavyForDays: 0, capacity: 0.95,
    modules: [
      M('des1101', 'DES1101', 'Design Studio 1', 2, 3, 17, 18, 80, '🎨'),
      M('ats1325', 'ATS1325', 'Media and Society', 2, 2, 15, 18, null, '📰'),
      M('des1110', 'DES1110', 'Digital Imaging', 1, 2, 18, 18, null, '📸'),
      M('ats1310', 'ATS1310', 'Academic Writing', 3, 2, 14, 18, null, '✍️'),
    ],
    classes: [
      { module: 'des1101', kind: 'lab', day: 0, start: 10, hours: 3, room: 'Studio A', flags: ['attendance'] },
      { module: 'des1101', kind: 'lab', day: 2, start: 10, hours: 3, room: 'Studio A' },
      { module: 'ats1325', kind: 'lecture', day: 1, start: 14, hours: 2, room: 'LT6' },
      { module: 'ats1325', kind: 'tutorial', day: 3, start: 10, hours: 1, room: '2-07' },
      { module: 'des1110', kind: 'lab', day: 3, start: 14, hours: 2, room: 'Mac Lab' },
      { module: 'ats1310', kind: 'seminar', day: 4, start: 9, hours: 2, room: '2-11', flags: ['tips'] },
    ],
    weekly: [
      { title: 'Studio sketchbook', bucket: 'mental', hours: 2, dread: 1, commitment: 'self', day: 1, startHour: 10, repeats: true },
      { title: 'Retail shift, Uniqlo', bucket: 'time', hours: 6, dread: 2, commitment: 'hard', day: 5, startHour: 12, repeats: true },
      { title: 'Sketching at the lake', bucket: 'physical', hours: 2, dread: 1, commitment: 'self', day: 6, startHour: 16, repeats: true, isRecovery: true },
    ],
    once: [
      { title: 'Studio crit: poster series', bucket: 'mental', hours: 8, dread: 3, commitment: 'hard', week: 1, day: 0, due: true, prepHours: 8, prepDone: 4, importance: 3, moduleId: 'des1101' },
      { title: 'ATS1310 Essay draft, 1500 words', bucket: 'mental', hours: 6, dread: 4, commitment: 'soft', week: 1, day: 4, due: true, prepHours: 6, prepDone: 1, importance: 2, moduleId: 'ats1310' },
      { title: 'Digital Imaging portfolio', bucket: 'mental', hours: 5, dread: 2, commitment: 'soft', week: 2, day: 3, due: true, prepHours: 5, prepDone: 0, importance: 2, moduleId: 'des1110' },
      { title: 'Mamak with Aisyah and Daniel', bucket: 'social', hours: 2, dread: 1, commitment: 'soft', week: 0, day: 5, startHour: 21, want: 5 },
      { title: 'K-drama night', bucket: 'social', hours: 2, dread: 1, commitment: 'self', week: 1, day: 2, startHour: 20, want: 4 },
    ],
    moods: [
      { daysAgo: 1, quadrant: 'high-pleasant', tags: ['Social'] },
      { daysAgo: 2, quadrant: 'low-pleasant', tags: [] },
      { daysAgo: 3, quadrant: 'high-pleasant', tags: ['Academics'] },
    ],
    recovery: [
      { id: 'sleep', label: 'Sleep', detail: '7.8h average, above your baseline', hours: 3, emoji: '😴', tag: '7.8h a night' },
      { id: 'downtime', label: 'Downtime', detail: 'Sketching on Sunday', hours: 2, emoji: '🎨', tag: 'Sunday afternoon' },
    ],
  },
];

/* ------------------------------------------------------- their weeks */

/** This student's limits: the defaults, scaled to how much they can actually carry. */
const limitsOf = (p: Persona) =>
  Object.fromEntries(Object.entries(DEFAULT_CEILINGS).map(([area, v]) => [area, Math.round(v * p.capacity)])) as typeof DEFAULT_CEILINGS;

function weekOf(p: Persona): { items: Item[]; modules: Module[]; moods: MoodCheckIn[] } {
  const modules: Module[] = p.modules.map((m) => ({ ...m, weeks: 12, startDate: TERM_START }));
  const items: Item[] = [];
  // Classes for this week and the next three - so the app is full however long judging takes.
  for (let week = 0; week < 4; week += 1) {
    for (const c of p.classes) {
      const module = modules.find((m) => m.id === c.module)!;
      const slot: ClassSlot = { day: c.day, startHour: c.start, hours: c.hours, kind: c.kind, room: c.room };
      const [first] = classItems(module, slot, at(week, 0));
      items.push({ ...first, id: `${p.key}-w${week}-class-${c.module}-${c.day}-${c.start}`, ...(c.flags ? { flags: c.flags } : {}) });
    }
    p.weekly.forEach(({ day, ...rest }, i) => items.push({ ...rest, id: `${p.key}-w${week}-weekly-${i}`, date: at(week, day) } as Item));
  }
  p.once.forEach(({ week, day, due, ...rest }, i) => {
    const date = at(week, day);
    items.push({ ...rest, id: `${p.key}-once-${i}`, date, ...(due ? { deadline: date } : {}) } as Item);
  });
  // Every day lived in: a few of the ordinary things around the classes, and
  // study sessions booked for each piece of work - how a planned week looks.
  const days = Array.from({ length: 28 }, (_, i) => addDays(W0, i));
  // Tuesday and Thursday evenings stay clear of the filler and the study
  // sessions, for everyone - so friends planning together find real evenings
  // when they are all free, the way a group of friends would keep one.
  const kept = days.filter((d) => dayIndex(d) === 1 || dayIndex(d) === 3).map((d) => ({
    id: `hold-${d}`, title: 'Evening kept free', bucket: 'time', hours: 3.5, dread: 1, commitment: 'self', date: d, startHour: 19,
  }) as Item);
  items.push(...fillDays([...items, ...kept], days, p.key));
  items.push(...bookSittings([...items, ...kept], TODAY, now.getHours() + now.getMinutes() / 60, p.key));
  const moods: MoodCheckIn[] = p.moods.map((m, i) => ({
    id: `${p.key}-mood-${i}`, date: addDays(TODAY, -m.daysAgo), at: `${m.daysAgo === 1 ? 'Yesterday' : `${m.daysAgo} days ago`} 9:00 PM`,
    quadrant: m.quadrant, tags: m.tags,
  }));
  return { items, modules, moods };
}

/* --------------------------------------------------------------- the API */

interface Session { id: string; token: string; code: string; email: string; name: string }

async function call<T>(path: string, init: { method?: string; body?: unknown; token?: string } = {}): Promise<{ status: number; data: T; token: string | null }> {
  const res = await fetch(API + path, {
    method: init.method ?? (init.body ? 'POST' : 'GET'),
    headers: { 'content-type': 'application/json', origin: ORIGIN, ...(init.token ? { authorization: `Bearer ${init.token}` } : {}) },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const text = await res.text();
  let data: unknown = text;
  try { data = JSON.parse(text); } catch { /* text */ }
  if (res.status >= 400) throw new Error(`${init.method ?? 'GET'} ${path} → ${res.status} ${text.slice(0, 200)}`);
  return { status: res.status, data: data as T, token: res.headers.get('set-auth-token') };
}

/** Delete the five accounts (and so everything they made) straight from the database. */
async function wipe(): Promise<void> {
  const env = readFileSync(join(process.cwd(), '..', 'server', '.env'), 'utf8');
  const url = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
  if (!url) throw new Error('server/.env has no DATABASE_URL');
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(url);
  const emails = PEOPLE.map((p) => p.email);
  const ids = (await sql`select id from "user" where email = any(${emails})`).map((r) => r.id as string);
  if (!ids.length) return;
  await sql.transaction([
    sql`delete from groups where owner_id = any(${ids})`,
    sql`delete from invites where host_id = any(${ids})`,
    sql`delete from "user" where id = any(${ids})`,
  ]);
  console.log(`  wiped ${ids.length} old judge accounts`);
}

async function main() {
  if (process.argv.includes('--dry')) {
    for (const p of PEOPLE) {
      const { items } = weekOf(p);
      const overall = overallOf(countedOnce(items).filter((i) => isSameWeek(i.date, TODAY)), limitsOf(p));
      const next = overallOf(countedOnce(items).filter((i) => isSameWeek(i.date, addDays(TODAY, 7))), limitsOf(p));
      console.log(`  ${p.name.padEnd(14)} ${items.length} items · battery ${chargeOf(overall)}% (${bandFor(overall)}) · next week ${chargeOf(next)}%`);
    }
    return;
  }
  console.log(`Seeding the judge accounts on ${API}, built around ${TODAY}`);
  await wipe();

  const people: Record<string, Session> = {};
  for (const [n, p] of PEOPLE.entries()) {
    // The API allows only a few sign-ups a minute from one place.
    if (n) await new Promise((r) => setTimeout(r, 11_000));
    const made = await call<{ user: { id: string } }>('/api/auth/sign-up/email', { body: { name: p.name, email: p.email, password: PASSWORD } });
    const token = made.token!;
    const me = await call<{ id: string; code: string }>('/api/me', { token });
    people[p.key] = { id: me.data.id, token, code: me.data.code, email: p.email, name: p.name };

    // Their week, through sync - the same documents their own phone would push.
    const { items, modules, moods } = weekOf(p);
    const stamp = new Date().toISOString();
    const doc = (collection: string, id: string, data: unknown) => ({ collection, id, data, updatedAt: stamp, deleted: false });
    const changes = [
      ...items.map((i) => doc('items', i.id, i)),
      ...modules.map((m) => doc('modules', m.id, m)),
      ...moods.map((m) => doc('moods', m.id, m)),
      ...p.recovery.map((r) => doc('recovery', r.id, r)),
      doc('settings', 'settings', {
        ceilings: limitsOf(p), overallCeiling: DEFAULT_OVERALL_CEILING, offHour: 17, sleepHours: null, booked: [],
        sharing: 'evenings', customActions: [], onboarded: true, customFlags: [], shareRules: DEFAULT_SHARE_RULES,
        planActivities: [], status: p.status.replace(/^\S+\s/, ''), vibe: p.status.split(' ')[0],
      }),
    ];
    await call('/api/sync', { token, body: { since: null, changes } });

    // What friends see: the battery the app would work out, and the free evenings.
    // The same reading the app makes: this week's items, each counted once, against the default limits.
    const overall = overallOf(countedOnce(items).filter((i) => isSameWeek(i.date, TODAY)), limitsOf(p));
    await call('/api/sharing/presence', {
      token, body: { band: bandFor(overall), charge: chargeOf(overall), status: p.status, heavyForDays: p.heavyForDays },
    });
    const days = Array.from({ length: 14 }, (_, i) => addDays(TODAY, i));
    const windows = days.flatMap((date) => published(items, date, 'evenings', 1, DEFAULT_SHARE_RULES).map((s) => ({ date, start: s.start, end: s.end })));
    await call('/api/sharing/publish', { token, body: { visibility: 'evenings', windows: windows.slice(0, 200), hiddenFrom: [] } });
    console.log(`  ${p.name.padEnd(14)} ${items.length} items · battery ${chargeOf(overall)}% · ${windows.length} free windows`);
  }

  // Everyone is friends with everyone.
  const keys = PEOPLE.map((p) => p.key);
  for (let i = 0; i < keys.length; i += 1) {
    for (let j = i + 1; j < keys.length; j += 1) {
      const a = people[keys[i]];
      const b = people[keys[j]];
      await call('/api/circle/request', { token: a.token, body: { code: b.code } });
      await call('/api/circle/respond', { token: b.token, body: { userId: a.id, action: 'accept' } });
    }
  }
  console.log('  everyone is friends');

  // Groups: one everyone joined, one with an invitation still waiting (for Mei Ling).
  const { aisyah, daniel, priya, hafiz, meiling } = people;
  const crew = await call<{ id: string }>('/api/groups', { token: aisyah.token, body: { name: 'Study crew', emoji: '📚', invite: [daniel.id, priya.id, hafiz.id, meiling.id] } });
  for (const s of [daniel, priya, hafiz, meiling]) await call(`/api/groups/${crew.data.id}/respond`, { token: s.token, body: { action: 'accept' } });
  const club = await call<{ id: string }>('/api/groups', { token: daniel.token, body: { name: 'Badminton club', emoji: '🏸', invite: [aisyah.id, hafiz.id, meiling.id] } });
  for (const s of [aisyah, hafiz]) await call(`/api/groups/${club.data.id}/respond`, { token: s.token, body: { action: 'accept' } });
  console.log('  groups: Study crew (5), Badminton club (3 + Mei Ling invited)');

  // Plans in every state.
  const plan = async (host: Session, title: string, week: number, day: number, startHour: number, hours: number, answers: Array<[Session, 'yes' | 'no' | null]>) => {
    const made = await call<{ id: string }>('/api/invites', { token: host.token, body: { title, date: at(week, day), startHour, hours, people: answers.map(([s]) => s.id) } });
    for (const [s, answer] of answers) if (answer) await call('/api/invites/respond', { token: s.token, body: { inviteId: made.data.id, response: answer } });
  };
  await plan(aisyah, 'Study session at the library', 1, 5, 14, 3, [[priya, 'yes'], [hafiz, 'yes']]);
  await plan(daniel, 'Mamak supper', 1, 5, 21, 2, [[meiling, 'yes'], [hafiz, 'yes'], [aisyah, null]]);
  await plan(hafiz, "Hafiz's birthday dinner", 1, 3, 18.5, 2.5, [[aisyah, 'yes'], [daniel, 'yes'], [priya, 'no'], [meiling, null]]);
  await plan(priya, 'Movie night', 1, 4, 20, 3, [[meiling, null]]);
  console.log('  plans: confirmed, waiting, turned down');
  console.log(`\nDone. Password for all five: ${PASSWORD}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
