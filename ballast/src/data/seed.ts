/**
 * A seeded fictional semester.
 *
 * The forecast is the best thing in this app and on an empty database it looks
 * like nothing at all, so this file is the first thing that was built, not the
 * last. Every number on every screen is computed from these items - nothing is
 * hard-coded into a component.
 *
 * Anchor: Monday 10 November 2025 is Monday of week 10. Fixed rather than
 * `new Date()` so the demo reads the same on every phone in every timezone.
 */
import type {
  CircleMember, Contact, Errand, Item, Meal, Module, MoodCheckIn, Prescription, RecoveryEntry,
} from '@/lib/types';
import { addDays } from '@/lib/dates';

export const TODAY = '2025-11-10';
export const WEEK_NUMBER = 10;

const W10 = TODAY;                 // Mon 10 Nov
const W11 = addDays(TODAY, 7);     // Mon 17 Nov

const d = (week: string, offset: number) => addDays(week, offset);

/**
 * Amira's ceilings, in load units per week.
 *
 * Not defaults. These are hers after ten weeks of calibration - the app started
 * her on a generic line and moved it every time she reported a day as hard at a
 * percentage below her current ceiling. That is why they are not round numbers
 * and why they differ wildly per bucket: a ceiling is a personal fact, not a
 * setting. See `recalibrate` in lib/load.ts.
 */
export const CEILINGS = {
  mental: 160,
  time: 160,
  errands: 34,
  social: 24,
  physical: 18,
};

/** Overall ceiling. Also hers, also moved. */
export const OVERALL_CEILING = 78;

/**
 * Four modules, second year computer science.
 *
 * Dread lives on the module rather than the class, because you do not dread
 * Tuesday - you dread networks. Changing it here changes every class in it.
 */
export const modules: Module[] = [
  { id: 'os',  code: 'CS2040', name: 'Operating Systems',   dread: 4, importance: 3, attended: 8,  held: 9,  requiredAttendance: 80 },
  { id: 'net', code: 'CS2035', name: 'Networks',            dread: 2, importance: 3, attended: 11, held: 12, requiredAttendance: 80 },
  { id: 'alg', code: 'CS2011', name: 'Algorithms',          dread: 3, importance: 2, attended: 7,  held: 9,  requiredAttendance: 80 },
  { id: 'ds',  code: 'CS3012', name: 'Distributed Systems', dread: 3, importance: 2, attended: 6,  held: 9,  requiredAttendance: null },
];

/**
 * The timetable, as fourteen real hours rather than one invisible lump.
 *
 * It used to be a single "Timetabled lectures and labs" item marked `spread`,
 * which counted toward the week and appeared nowhere in it - so the fullest part
 * of a student's day was the part the calendar could not show. These are the
 * same fourteen hours at the same dread, now with a time, a room and a module.
 */
const classes = (week: string, prefix: string): Item[] => [
  klass(prefix, 'os',  'Lecture',  week, 0, 9,  2, 'Kilburn LT1',  ['tips', 'attendance']),
  klass(prefix, 'net', 'Tutorial', week, 0, 11, 1, 'IT407',        ['coursework']),
  klass(prefix, 'alg', 'Tutorial', week, 1, 9,  1, 'Kilburn 1.5',  []),
  klass(prefix, 'os',  'Lab',      week, 1, 17, 2, 'Lab B',        ['attendance']),
  klass(prefix, 'ds',  'Seminar',  week, 2, 15, 2, 'Crawford H',   ['tips']),
  klass(prefix, 'net', 'Lecture',  week, 3, 8,  2, 'Stopford TH2', ['tips', 'coursework']),
  klass(prefix, 'alg', 'Lab',      week, 3, 14, 2, 'Lab A',        ['attendance']),
  klass(prefix, 'net', 'Lab',      week, 4, 8,  2, 'Lab C',        []),
];

function klass(
  prefix: string,
  moduleId: string,
  kind: string,
  week: string,
  offset: number,
  startHour: number,
  hours: number,
  room: string,
  flags: Item['flags'],
): Item {
  const module = modules.find((m) => m.id === moduleId)!;
  return {
    id: `${prefix}class-${moduleId}-${offset}-${startHour}`,
    title: `${module.name} ${kind.toLowerCase()}`,
    bucket: 'time',
    hours,
    // Every class in a module carries that module's dread, so the fourteen hours
    // still weigh exactly what the single blob weighed: 14 x 2.
    dread: 2,
    commitment: 'hard',
    date: d(week, offset),
    startHour,
    repeats: true,
    moduleId,
    sessionKind: kind.toLowerCase() as Item['sessionKind'],
    room,
    flags,
  };
}

export const seedItems: Item[] = [
  ...classes(W10, ''),
  ...classes(W11, 'w11-'),
  // ---------------------------------------------------------------- week 10
  // Mental. Coursework and the thinking that comes with it.
  { id: 'os-2',      title: 'Operating systems, part 2',  bucket: 'mental',  hours: 4,    dread: 4, commitment: 'hard', date: d(W10, 0), when: 'Hard deadline Thursday', startHour: 13 },
  { id: 'net-lab',   title: 'Networks lab report',        bucket: 'mental',  hours: 5,    dread: 2, commitment: 'hard', date: d(W10, 1), startHour: 10 },
  { id: 'pres-prep', title: 'Group presentation prep',    bucket: 'mental',  hours: 3,    dread: 4, commitment: 'hard', date: d(W10, 4), startHour: 10 },
  { id: 'seminar',   title: 'Seminar prep, distributed systems', bucket: 'mental', hours: 3, dread: 3, commitment: 'soft', date: d(W10, 2), startHour: 11 },
  { id: 'tutorial',  title: 'Tutorial exercises',         bucket: 'mental',  hours: 2,    dread: 3, commitment: 'soft', date: d(W10, 3), startHour: 10 },
  { id: 'ch9',       title: 'Chapter 9 reading',          bucket: 'mental',  hours: 3,    dread: 2, commitment: 'self', date: d(W10, 5) },
  { id: 'algo-set',  title: 'Algorithms problem set',     bucket: 'mental',  hours: 4,    dread: 3, commitment: 'soft', date: d(W10, 3), deadline: d(W10, 3), prepHours: 4, prepDone: 1, importance: 3 },
  { id: 'revision',  title: 'Week 10 catch-up revision',  bucket: 'mental',  hours: 5,    dread: 3, commitment: 'self', date: d(W10, 5), startHour: 10 },
  { id: 'emails',    title: 'Emails I have been avoiding',bucket: 'mental',  hours: 4,    dread: 3, commitment: 'self', date: d(W10, 2), deadline: d(W10, 2), prepHours: 4, prepDone: 0, importance: 1 },
  { id: 'good-read', title: 'Reading you actually enjoy', bucket: 'mental',  hours: 6,    dread: 1, commitment: 'self', date: d(W10, 6) },

  // Time. The invisible half of the week, entered once in September.
  { id: 'shift-mon', title: 'Café shift',                 bucket: 'time',    hours: 6,    dread: 2, commitment: 'hard', date: d(W10, 0), when: '5pm to 11pm', repeats: true, startHour: 17 },
  { id: 'shift-fri', title: 'Café shift',                 bucket: 'time',    hours: 6,    dread: 2, commitment: 'hard', date: d(W10, 4), when: '5pm to 11pm', repeats: true, startHour: 17 },
  { id: 'bus',       title: 'Bus to campus',              bucket: 'time',    hours: 8,    dread: 2, commitment: 'hard', date: d(W10, 0), when: '50 minutes each way', repeats: true, spread: true },

  // Errands. Small, many, mostly batchable.
  { id: 'books',     title: 'Return the library books',   bucket: 'errands', hours: 0.33, dread: 1, commitment: 'self', date: d(W10, 0) },
  { id: 'laundry',   title: 'Laundry and shopping',       bucket: 'errands', hours: 2,    dread: 2, commitment: 'self', date: d(W10, 6), when: 'Sunday, 2h', repeats: true, startHour: 11 },
  { id: 'kitchen',   title: 'Kitchen and bins',           bucket: 'errands', hours: 1.5,  dread: 2, commitment: 'self', date: d(W10, 3), repeats: true, startHour: 18 },
  { id: 'cook',      title: 'Cook and prep for the week', bucket: 'errands', hours: 2,    dread: 2, commitment: 'self', date: d(W10, 6), repeats: true, startHour: 17 },
  { id: 'pharmacy',  title: 'Pharmacy, the prescription', bucket: 'errands', hours: 0.75, dread: 2, commitment: 'self', date: d(W10, 1), place: 'in town', startHour: 16 },
  { id: 'bank',      title: 'Bank, sort the card out',    bucket: 'errands', hours: 1,    dread: 3, commitment: 'self', date: d(W10, 2), place: 'in town', startHour: 13 },
  { id: 'post',      title: 'Post office, parcel home',   bucket: 'errands', hours: 0.75, dread: 2, commitment: 'self', date: d(W10, 3), place: 'in town', startHour: 12 },
  { id: 'phone',     title: 'Phone shop, fix the contract', bucket: 'errands', hours: 1,  dread: 2, commitment: 'self', date: d(W10, 4), place: 'in town', startHour: 13 },

  // Social.
  { id: 'standup',   title: 'Project group, Wednesday standup', bucket: 'social', hours: 1.5, dread: 3, commitment: 'soft', date: d(W10, 2), startHour: 9.5 },
  { id: 'flatmates', title: 'Flatmates, Sunday dinner',   bucket: 'social',  hours: 2,    dread: 1, commitment: 'soft', date: d(W10, 6), startHour: 19 },
  { id: 'call-home', title: 'Call home',                  bucket: 'social',  hours: 1,    dread: 2, commitment: 'self', date: d(W10, 6), startHour: 15 },
  { id: 'jo-coffee', title: 'Coffee with Jo',             bucket: 'social',  hours: 1.5,  dread: 1, commitment: 'self', date: d(W10, 4), startHour: 15 },

  // Physical. Two walks in nine days, which is the other half of the problem.
  { id: 'walk-shop', title: 'Walk to the shops and back', bucket: 'physical', hours: 1,   dread: 1, commitment: 'self', date: d(W10, 1), startHour: 8 },
  { id: 'walk-river',title: 'Walk by the river',          bucket: 'physical', hours: 1,   dread: 2, commitment: 'self', date: d(W10, 5), startHour: 16 },

  // ---------------------------------------------------------------- week 11
  // The wall: four things inside seventy-two hours, Tuesday to Thursday.
  { id: 'w11-net-lab',  title: 'Networks lab report',     bucket: 'mental',  hours: 5,    dread: 2, commitment: 'hard', date: d(W11, 1), when: 'Tue', startHour: 10 },
  { id: 'w11-pres',     title: 'Group presentation',      bucket: 'mental',  hours: 6,    dread: 4, commitment: 'hard', date: d(W11, 2), when: 'Wed', startHour: 9, deadline: d(W11, 2), prepHours: 6, prepDone: 0, importance: 3 },
  { id: 'w11-amin',     title: 'Café shift, covering Amin', bucket: 'time',  hours: 7,    dread: 2, commitment: 'soft', date: d(W11, 2), when: 'Wed evening', startHour: 16 },
  { id: 'w11-birthday', title: "Aisyah's birthday dinner", bucket: 'social', hours: 3,    dread: 3, commitment: 'soft', date: d(W11, 3), when: 'Thu', startHour: 19 },

  // The rest of week 11, so the wall has a week around it.
  { id: 'w11-ch9',      title: 'Chapter 9 reading',       bucket: 'mental',  hours: 3,    dread: 2, commitment: 'self', date: d(W11, 5) },
  { id: 'w11-os3',      title: 'Operating systems, part 3', bucket: 'mental', hours: 4,   dread: 4, commitment: 'hard', date: d(W11, 5), startHour: 10 },
  { id: 'w11-seminar',  title: 'Seminar prep, week 11',   bucket: 'mental',  hours: 2,    dread: 3, commitment: 'soft', date: d(W11, 0), startHour: 15 },
  { id: 'w11-algo',     title: 'Algorithms problem set',  bucket: 'mental',  hours: 5,    dread: 3, commitment: 'soft', date: d(W11, 6), startHour: 11 },
  { id: 'w11-net-prep', title: 'Networks lab prep',      bucket: 'mental',  hours: 2,    dread: 3, commitment: 'soft', date: d(W11, 0), startHour: 10 },
  { id: 'w11-catchup',  title: 'Lecture catch-up, week 11', bucket: 'mental', hours: 4,   dread: 2, commitment: 'self', date: d(W11, 0), startHour: 13 },
  { id: 'w11-set-read', title: 'Set reading, week 11',    bucket: 'mental',  hours: 4,    dread: 2, commitment: 'self', date: d(W11, 5) },
  { id: 'w11-revision', title: 'Revision, week 11',       bucket: 'mental',  hours: 4,    dread: 3, commitment: 'self', date: d(W11, 5), startHour: 15 },
  { id: 'w11-shift-mon',title: 'Café shift',              bucket: 'time',    hours: 6,    dread: 2, commitment: 'hard', date: d(W11, 0), when: '5pm to 11pm', repeats: true, startHour: 17 },
  { id: 'w11-shift-fri',title: 'Café shift',              bucket: 'time',    hours: 6,    dread: 2, commitment: 'hard', date: d(W11, 4), when: '5pm to 11pm', repeats: true, startHour: 17 },
  { id: 'w11-bus',      title: 'Bus to campus',           bucket: 'time',    hours: 8,    dread: 2, commitment: 'hard', date: d(W11, 0), when: '50 minutes each way', repeats: true, spread: true },
  { id: 'w11-laundry',  title: 'Laundry and shopping',    bucket: 'errands', hours: 2,    dread: 2, commitment: 'self', date: d(W11, 6), repeats: true, startHour: 9 },
  { id: 'w11-kitchen',  title: 'Kitchen and bins',        bucket: 'errands', hours: 1.5,  dread: 2, commitment: 'self', date: d(W11, 3), repeats: true, startHour: 17 },
  { id: 'w11-cook',     title: 'Cook and prep for the week', bucket: 'errands', hours: 2, dread: 2, commitment: 'self', date: d(W11, 6), repeats: true, startHour: 17 },
  { id: 'w11-pharmacy', title: 'Pharmacy, the prescription', bucket: 'errands', hours: 0.75, dread: 2, commitment: 'self', date: d(W11, 1), place: 'in town', startHour: 16 },
  { id: 'w11-bank',     title: 'Bank, sort the card out', bucket: 'errands', hours: 1,    dread: 3, commitment: 'self', date: d(W11, 2), place: 'in town', startHour: 15 },
  { id: 'w11-post',     title: 'Post office, parcel home',bucket: 'errands', hours: 0.75, dread: 2, commitment: 'self', date: d(W11, 3), place: 'in town', startHour: 12 },
  { id: 'w11-phone',    title: 'Phone shop, fix the contract', bucket: 'errands', hours: 1, dread: 2, commitment: 'self', date: d(W11, 4), place: 'in town', startHour: 13 },
  { id: 'w11-standup',  title: 'Project group, standup',  bucket: 'social',  hours: 1.5,  dread: 3, commitment: 'soft', date: d(W11, 2), startHour: 8 },
  { id: 'w11-flatmates',title: 'Flatmates, Sunday dinner',bucket: 'social',  hours: 2,    dread: 1, commitment: 'soft', date: d(W11, 6), startHour: 19 },
  // Recovery, protected by default. The first thing a stressed student cuts.
  { id: 'w11-swim',     title: 'Swim, Thursday morning',  bucket: 'physical', hours: 1,   dread: 2, commitment: 'self', date: d(W11, 3), isRecovery: true, startHour: 7 },
  { id: 'w11-walk',     title: 'Walk to the shops and back', bucket: 'physical', hours: 1, dread: 1, commitment: 'self', date: d(W11, 5), startHour: 8 },
  { id: 'w11-football', title: 'Football, Saturday',       bucket: 'physical', hours: 2,    dread: 2, commitment: 'soft', date: d(W11, 5), startHour: 14 },
];

/**
 * Seeded, and we say so in the pitch. Sleep and step signals need a health
 * permission dialogue that eats an hour and demos identically either way.
 */
export const recoveryLedger: RecoveryEntry[] = [
  { id: 'sleep',    label: 'Sleep',           detail: '6.1h average, 1.4h under your own baseline', hours: -9 },
  { id: 'movement', label: 'Movement',        detail: 'Two walks in nine days',                     hours: -4 },
  { id: 'downtime', label: 'Downtime',        detail: 'Sunday afternoon, uninterrupted',            hours: 2 },
  { id: 'dayoff',   label: 'Last full day off', detail: '23 days ago',                              hours: null },
];

export const DEFICIT_DAYS = 9;

/**
 * The whole library is free, under ninety minutes and within walking distance of
 * campus. Anything that needs money or a car is not recovery for most students,
 * it is another thing to organise.
 */
export const prescriptions: Prescription[] = [
  { id: 'river', title: 'Walk the river loop', detail: '40 minutes. Free. Six minutes from your block. No phone needed.', refills: 'physical', credit: 2, slot: 'today at 5pm', preferred: [12, 19], tags: ['Costs nothing', 'Under an hour', 'Alone'], best: true },
  { id: 'nap',   title: 'Nap, 25 minutes',     detail: 'Between your 2pm and your shift', refills: 'mental',   credit: 3, slot: 'this afternoon', preferred: [13, 16] },
  { id: 'pool',  title: 'Campus pool, Thursday', detail: 'Already in your calendar',      refills: 'physical', credit: 4, slot: 'Thursday, 7am', preferred: [7, 10] },
  { id: 'empty', title: 'An evening with nothing in it', detail: 'Wednesday is now free', refills: 'mental',   credit: 6, slot: 'Wednesday evening', preferred: [18, 22] },
];

/** Seeded: needs other people. Bands only, never a task, never a number, never a mood. */
export const circle: CircleMember[] = [
  { id: 'you',    name: 'You',    initials: 'A',  band: 'heavy',  isYou: true, charge: 13 },
  {
    id: 'amin', name: 'Amin', initials: 'Am', band: 'steady', charge: 62,
    free: [
      { date: d(W10, 2), start: 18, end: 22 },
      { date: d(W10, 4), start: 19, end: 23 },
      { date: d(W10, 5), start: 13, end: 20 },
    ],
  },
  {
    id: 'jo', name: 'Jo', initials: 'J', band: 'busy', charge: 24,
    free: [
      { date: d(W10, 2), start: 20, end: 22 },
      { date: d(W10, 5), start: 15, end: 19 },
    ],
  },
  {
    id: 'aisyah', name: 'Aisyah', initials: 'Ai', band: 'heavy', heavyForDays: 11, charge: 8,
    free: [{ date: d(W10, 5), start: 17, end: 21 }],
  },
  {
    id: 'ravi', name: 'Ravi', initials: 'R', band: 'steady', charge: 71,
    free: [
      { date: d(W10, 2), start: 17, end: 23 },
      { date: d(W10, 3), start: 18, end: 22 },
      { date: d(W10, 5), start: 12, end: 22 },
    ],
  },
];

/** Seeded: averages only, and only where enough students in a course opted in. */
export const cohort = {
  label: 'Computer science, year 2',
  percent: 84,
  note: 'Your whole cohort is heavy this week. Week 10 is like this for everyone, every year.',
};


// ---------------------------------------------------------------- area data
// Seeded like the rest. Each area logs the thing it is actually made of.

export const moodHistory: MoodCheckIn[] = [
  { id: 'm1', date: addDays(TODAY, -1), at: 'Yesterday 9:15 AM', quadrant: 'high-unpleasant', tags: ['Academics'] },
  { id: 'm2', date: addDays(TODAY, -2), at: 'Sunday 8:30 PM',   quadrant: 'low-pleasant',  tags: [] },
  { id: 'm3', date: addDays(TODAY, -3), at: 'Fri 11:00 AM',   quadrant: 'low-unpleasant',  tags: ['Finances', 'Health'] },
  { id: 'm4', date: addDays(TODAY, -4), at: 'Thu 7:00 PM',    quadrant: 'high-pleasant',   tags: ['Social'] },
];

export const meals: Meal[] = [
  { id: 'breakfast', label: 'Breakfast', at: '8:30 AM',  status: 'filling' },
  { id: 'lunch',     label: 'Lunch',     at: '12:45 PM', status: 'light' },
  { id: 'dinner',    label: 'Dinner',    at: 'Evening',  status: 'pending' },
];

export const activity = { steps: 4200, goal: 8000, activeMinutes: 32 };

/** Sorted longest gap first: the person you have quietly dropped. */
export const contacts: Contact[] = [
  { id: 'sam',    name: 'Sam K.',  initials: 'S', lastSpokeDays: 9, state: 'none' },
  { id: 'jordan', name: 'Jordan',  initials: 'J', lastSpokeDays: 5, state: 'none' },
  { id: 'alex',   name: 'Alex',    initials: 'A', lastSpokeDays: 3, state: 'talked' },
  { id: 'riley',  name: 'Riley',   initials: 'R', lastSpokeDays: 1, state: 'saw' },
];

export const errands: Errand[] = [
  { id: 'e1', title: 'Pick up oat milk',      category: 'Groceries', done: false },
  { id: 'e2', title: 'Laundry detergent',     category: 'Groceries', done: true },
  { id: 'e3', title: 'Bananas and spinach',   category: 'Groceries', done: false },
  { id: 'e4', title: 'Reply to the landlord', category: 'Admin',     done: false },
  { id: 'e5', title: 'Pay the phone bill',    category: 'Admin',     done: false },
  { id: 'e6', title: 'Print the lab report',  category: 'Academic',  done: false },
  { id: 'e7', title: 'Return library books',  category: 'Academic',  done: true },
  { id: 'e8', title: 'Email Prof. Chen',      category: 'Academic',  done: false },
];
