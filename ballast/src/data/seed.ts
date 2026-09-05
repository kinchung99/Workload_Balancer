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
  Block, CircleMember, Contact, Errand, Item, Meal, MoodCheckIn, Prescription, RecoveryEntry,
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
  mental: 100,
  time: 83,
  errands: 26,
  social: 17.2,
  physical: 9.7,
};

/** Overall ceiling. Also hers, also moved. */
export const OVERALL_CEILING = 85;

export const seedItems: Item[] = [
  // ---------------------------------------------------------------- week 10
  // Mental. Coursework and the thinking that comes with it.
  { id: 'os-2',      title: 'Operating systems, part 2',  bucket: 'mental',  hours: 4,    dread: 4, commitment: 'hard', date: d(W10, 0), when: 'Hard deadline Thursday' },
  { id: 'net-lab',   title: 'Networks lab report',        bucket: 'mental',  hours: 5,    dread: 2, commitment: 'hard', date: d(W10, 1) },
  { id: 'pres-prep', title: 'Group presentation prep',    bucket: 'mental',  hours: 3,    dread: 4, commitment: 'hard', date: d(W10, 4) },
  { id: 'seminar',   title: 'Seminar prep, distributed systems', bucket: 'mental', hours: 3, dread: 3, commitment: 'soft', date: d(W10, 2) },
  { id: 'tutorial',  title: 'Tutorial exercises',         bucket: 'mental',  hours: 2,    dread: 3, commitment: 'soft', date: d(W10, 3) },
  { id: 'ch9',       title: 'Chapter 9 reading',          bucket: 'mental',  hours: 3,    dread: 2, commitment: 'self', date: d(W10, 5) },
  { id: 'algo-set',  title: 'Algorithms problem set',     bucket: 'mental',  hours: 4,    dread: 3, commitment: 'soft', date: d(W10, 3) },
  { id: 'revision',  title: 'Week 10 catch-up revision',  bucket: 'mental',  hours: 5,    dread: 3, commitment: 'self', date: d(W10, 5) },
  { id: 'emails',    title: 'Emails I have been avoiding',bucket: 'mental',  hours: 4,    dread: 3, commitment: 'self', date: d(W10, 2) },
  { id: 'good-read', title: 'Reading you actually enjoy', bucket: 'mental',  hours: 6,    dread: 1, commitment: 'self', date: d(W10, 6) },

  // Time. The invisible half of the week, entered once in September.
  { id: 'timetable', title: 'Timetabled lectures and labs', bucket: 'time', hours: 14,   dread: 2, commitment: 'hard', date: d(W10, 0), when: 'Across the week', repeats: true, spread: true },
  { id: 'shift-mon', title: 'Café shift',                 bucket: 'time',    hours: 6,    dread: 2, commitment: 'hard', date: d(W10, 0), when: '5pm to 11pm', repeats: true },
  { id: 'shift-fri', title: 'Café shift',                 bucket: 'time',    hours: 6,    dread: 2, commitment: 'hard', date: d(W10, 4), when: '5pm to 11pm', repeats: true },
  { id: 'bus',       title: 'Bus to campus',              bucket: 'time',    hours: 8,    dread: 2, commitment: 'hard', date: d(W10, 0), when: '50 minutes each way', repeats: true, spread: true },

  // Errands. Small, many, mostly batchable.
  { id: 'books',     title: 'Return the library books',   bucket: 'errands', hours: 0.33, dread: 1, commitment: 'self', date: d(W10, 0) },
  { id: 'laundry',   title: 'Laundry and shopping',       bucket: 'errands', hours: 2,    dread: 2, commitment: 'self', date: d(W10, 6), when: 'Sunday, 2h', repeats: true },
  { id: 'kitchen',   title: 'Kitchen and bins',           bucket: 'errands', hours: 1.5,  dread: 2, commitment: 'self', date: d(W10, 3), repeats: true },
  { id: 'cook',      title: 'Cook and prep for the week', bucket: 'errands', hours: 2,    dread: 2, commitment: 'self', date: d(W10, 6), repeats: true },
  { id: 'pharmacy',  title: 'Pharmacy, the prescription', bucket: 'errands', hours: 0.75, dread: 2, commitment: 'self', date: d(W10, 1), place: 'in town' },
  { id: 'bank',      title: 'Bank, sort the card out',    bucket: 'errands', hours: 1,    dread: 3, commitment: 'self', date: d(W10, 2), place: 'in town' },
  { id: 'post',      title: 'Post office, parcel home',   bucket: 'errands', hours: 0.75, dread: 2, commitment: 'self', date: d(W10, 3), place: 'in town' },
  { id: 'phone',     title: 'Phone shop, fix the contract', bucket: 'errands', hours: 1,  dread: 2, commitment: 'self', date: d(W10, 4), place: 'in town' },

  // Social.
  { id: 'standup',   title: 'Project group, Wednesday standup', bucket: 'social', hours: 1.5, dread: 3, commitment: 'soft', date: d(W10, 2) },
  { id: 'flatmates', title: 'Flatmates, Sunday dinner',   bucket: 'social',  hours: 2,    dread: 1, commitment: 'soft', date: d(W10, 6) },
  { id: 'call-home', title: 'Call home',                  bucket: 'social',  hours: 1,    dread: 2, commitment: 'self', date: d(W10, 6) },
  { id: 'jo-coffee', title: 'Coffee with Jo',             bucket: 'social',  hours: 1.5,  dread: 1, commitment: 'self', date: d(W10, 4) },

  // Physical. Two walks in nine days, which is the other half of the problem.
  { id: 'walk-shop', title: 'Walk to the shops and back', bucket: 'physical', hours: 1,   dread: 1, commitment: 'self', date: d(W10, 1) },
  { id: 'walk-river',title: 'Walk by the river',          bucket: 'physical', hours: 1,   dread: 2, commitment: 'self', date: d(W10, 5) },

  // ---------------------------------------------------------------- week 11
  // The wall: four things inside seventy-two hours, Tuesday to Thursday.
  { id: 'w11-net-lab',  title: 'Networks lab report',     bucket: 'mental',  hours: 5,    dread: 2, commitment: 'hard', date: d(W11, 1), when: 'Tue' },
  { id: 'w11-pres',     title: 'Group presentation',      bucket: 'mental',  hours: 6,    dread: 4, commitment: 'hard', date: d(W11, 2), when: 'Wed' },
  { id: 'w11-amin',     title: 'Café shift, covering Amin', bucket: 'time',  hours: 7,    dread: 2, commitment: 'soft', date: d(W11, 2), when: 'Wed evening' },
  { id: 'w11-birthday', title: "Aisyah's birthday dinner", bucket: 'social', hours: 3,    dread: 3, commitment: 'soft', date: d(W11, 3), when: 'Thu' },

  // The rest of week 11, so the wall has a week around it.
  { id: 'w11-ch9',      title: 'Chapter 9 reading',       bucket: 'mental',  hours: 3,    dread: 2, commitment: 'self', date: d(W11, 5) },
  { id: 'w11-os3',      title: 'Operating systems, part 3', bucket: 'mental', hours: 4,   dread: 4, commitment: 'hard', date: d(W11, 5) },
  { id: 'w11-seminar',  title: 'Seminar prep, week 11',   bucket: 'mental',  hours: 2,    dread: 3, commitment: 'soft', date: d(W11, 0) },
  { id: 'w11-algo',     title: 'Algorithms problem set',  bucket: 'mental',  hours: 5,    dread: 3, commitment: 'soft', date: d(W11, 6) },
  { id: 'w11-net-prep', title: 'Networks lab prep',      bucket: 'mental',  hours: 2,    dread: 3, commitment: 'soft', date: d(W11, 0) },
  { id: 'w11-catchup',  title: 'Lecture catch-up, week 11', bucket: 'mental', hours: 4,   dread: 2, commitment: 'self', date: d(W11, 0) },
  { id: 'w11-set-read', title: 'Set reading, week 11',    bucket: 'mental',  hours: 4,    dread: 2, commitment: 'self', date: d(W11, 5) },
  { id: 'w11-revision', title: 'Revision, week 11',       bucket: 'mental',  hours: 4,    dread: 3, commitment: 'self', date: d(W11, 5) },
  { id: 'w11-timetable',title: 'Timetabled lectures and labs', bucket: 'time', hours: 14, dread: 2, commitment: 'hard', date: d(W11, 0), when: 'Across the week', repeats: true, spread: true },
  { id: 'w11-shift-mon',title: 'Café shift',              bucket: 'time',    hours: 6,    dread: 2, commitment: 'hard', date: d(W11, 0), when: '5pm to 11pm', repeats: true },
  { id: 'w11-shift-fri',title: 'Café shift',              bucket: 'time',    hours: 6,    dread: 2, commitment: 'hard', date: d(W11, 4), when: '5pm to 11pm', repeats: true },
  { id: 'w11-bus',      title: 'Bus to campus',           bucket: 'time',    hours: 8,    dread: 2, commitment: 'hard', date: d(W11, 0), when: '50 minutes each way', repeats: true, spread: true },
  { id: 'w11-laundry',  title: 'Laundry and shopping',    bucket: 'errands', hours: 2,    dread: 2, commitment: 'self', date: d(W11, 6), repeats: true },
  { id: 'w11-kitchen',  title: 'Kitchen and bins',        bucket: 'errands', hours: 1.5,  dread: 2, commitment: 'self', date: d(W11, 3), repeats: true },
  { id: 'w11-cook',     title: 'Cook and prep for the week', bucket: 'errands', hours: 2, dread: 2, commitment: 'self', date: d(W11, 6), repeats: true },
  { id: 'w11-pharmacy', title: 'Pharmacy, the prescription', bucket: 'errands', hours: 0.75, dread: 2, commitment: 'self', date: d(W11, 1), place: 'in town' },
  { id: 'w11-bank',     title: 'Bank, sort the card out', bucket: 'errands', hours: 1,    dread: 3, commitment: 'self', date: d(W11, 2), place: 'in town' },
  { id: 'w11-post',     title: 'Post office, parcel home',bucket: 'errands', hours: 0.75, dread: 2, commitment: 'self', date: d(W11, 3), place: 'in town' },
  { id: 'w11-phone',    title: 'Phone shop, fix the contract', bucket: 'errands', hours: 1, dread: 2, commitment: 'self', date: d(W11, 4), place: 'in town' },
  { id: 'w11-standup',  title: 'Project group, standup',  bucket: 'social',  hours: 1.5,  dread: 3, commitment: 'soft', date: d(W11, 2) },
  { id: 'w11-flatmates',title: 'Flatmates, Sunday dinner',bucket: 'social',  hours: 2,    dread: 1, commitment: 'soft', date: d(W11, 6) },
  // Recovery, protected by default. The first thing a stressed student cuts.
  { id: 'w11-swim',     title: 'Swim, Thursday morning',  bucket: 'physical', hours: 1,   dread: 2, commitment: 'self', date: d(W11, 3), isRecovery: true },
  { id: 'w11-walk',     title: 'Walk to the shops and back', bucket: 'physical', hours: 1, dread: 1, commitment: 'self', date: d(W11, 5) },
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
  { id: 'river', title: 'Walk the river loop', detail: '40 minutes. Free. Six minutes from your block. No phone needed.', refills: 'physical', credit: 2, slot: 'today at 5pm', tags: ['Costs nothing', 'Under an hour', 'Alone'], best: true },
  { id: 'nap',   title: 'Nap, 25 minutes',     detail: 'Between your 2pm and your shift', refills: 'mental',   credit: 3, slot: 'this afternoon' },
  { id: 'pool',  title: 'Campus pool, Thursday', detail: 'Already in your calendar',      refills: 'physical', credit: 4, slot: 'Thursday, 7am' },
  { id: 'empty', title: 'An evening with nothing in it', detail: 'Wednesday is now free', refills: 'mental',   credit: 6, slot: 'Wednesday evening' },
];

/** Seeded: needs other people. Bands only, never a task, never a number, never a mood. */
export const circle: CircleMember[] = [
  { id: 'you',    name: 'You',    initials: 'A',  band: 'heavy',  isYou: true },
  { id: 'amin',   name: 'Amin',   initials: 'Am', band: 'steady' },
  { id: 'jo',     name: 'Jo',     initials: 'J',  band: 'busy' },
  { id: 'aisyah', name: 'Aisyah', initials: 'Ai', band: 'heavy', heavyForDays: 11 },
  { id: 'ravi',   name: 'Ravi',   initials: 'R',  band: 'steady' },
];

/** Seeded: averages only, and only where enough students in a course opted in. */
export const cohort = {
  label: 'Computer science, year 2',
  percent: 84,
  note: 'Your whole cohort is heavy this week. Week 10 is like this for everyone, every year.',
};

export const freeEveningWindow = {
  people: ['You', 'Amin', 'Ravi'],
  day: 'Wednesday evening',
  note: 'First time that has happened in three weeks. Nobody has to do the asking.',
};

// ---------------------------------------------------------------- area data
// Seeded like the rest. Each area logs the thing it is actually made of.

export const moodHistory: MoodCheckIn[] = [
  { id: 'm1', date: TODAY,             at: 'Today 9:15 AM',   quadrant: 'high-unpleasant', tags: ['Academics'] },
  { id: 'm2', date: addDays(TODAY, -1), at: 'Yesterday 8:30 PM', quadrant: 'low-pleasant',  tags: [] },
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

/**
 * The week grid. Committed blocks come from the timetable; recovery blocks are
 * written back into it and protected, so rest occupies real time rather than
 * being what is left over.
 */
export const weekBlocks: Block[] = [
  { id: 'b1',  label: 'SDC',   day: 0, startHour: 13, hours: 1,   kind: 'committed' },
  { id: 'b2',  label: 'Work',  day: 0, startHour: 17, hours: 2.5, kind: 'committed' },
  { id: 'b3',  label: 'Work',  day: 1, startHour: 14, hours: 1.5, kind: 'committed' },
  { id: 'b4',  label: 'Study', day: 2, startHour: 14, hours: 2,   kind: 'committed' },
  { id: 'b5',  label: 'Work',  day: 2, startHour: 18, hours: 2,   kind: 'committed' },
  { id: 'b6',  label: 'Work',  day: 3, startHour: 18, hours: 2,   kind: 'committed' },
  { id: 'r1',  label: 'Rest',  day: 1, startHour: 13, hours: 1.5, kind: 'recovery' },
  { id: 'r2',  label: 'Walk',  day: 2, startHour: 12, hours: 1,   kind: 'recovery' },
  { id: 'r3',  label: 'Swim',  day: 3, startHour: 15, hours: 1.5, kind: 'recovery' },
  { id: 'r4',  label: 'Off',   day: 4, startHour: 16, hours: 2,   kind: 'recovery' },
];
