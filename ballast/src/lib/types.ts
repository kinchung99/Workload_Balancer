/** Domain types for Ballast. Deliberately small: this is a frontend study. */

/** The five buckets. Each carries its own ceiling, because shape beats total. */
export type BucketKey = 'mental' | 'time' | 'physical' | 'social' | 'errands';

/**
 * Tagged at capture, one tap. This is what lets the app suggest what to move
 * without ever suggesting you skip the exam.
 */
export type CommitmentKind = 'hard' | 'soft' | 'self';

/** How much are you dreading this, one to five. The one thing a calendar cannot know. */
export type Dread = 1 | 2 | 3 | 4 | 5;

/**
 * What one thing takes out of each of the five areas, 0 to 5.
 *
 * A single bucket per task was always the model's weakest assumption. A group
 * presentation is not "mental"; it is heavy mental, real time, and a social
 * cost most people would not have thought to name. Filing it under one heading
 * is how a week reads 60% while the person is finished.
 *
 * So capture takes five readings instead of one, and the load lands in the
 * proportions given. The total is unchanged - hours x dread still - because an
 * hour is still an hour. What changes is the SHAPE, which is the app's whole
 * argument, now available at the moment the thing is written down.
 */
export type Mix = Partial<Record<BucketKey, number>>;

export type BandName = 'steady' | 'busy' | 'heavy' | 'recovery';

export interface Item {
  id: string;
  title: string;
  bucket: BucketKey;
  /** Estimated hours. Corrected over time by what similar tasks actually took you. */
  hours: number;
  dread: Dread;
  commitment: CommitmentKind;
  /** ISO yyyy-mm-dd. */
  date: string;
  /** Human time, e.g. "5pm to 11pm". Display only, and derived where possible. */
  when?: string;
  /**
   * Hour the thing starts, 24h, decimals allowed (9.5 = 9:30am).
   *
   * Undefined means it has no slot yet - coursework you can do whenever. That
   * distinction matters: a fixed block and a floating one need different
   * treatment, and pretending everything is scheduled is what makes other
   * planners useless.
   */
  startHour?: number;
  /** Set once in onboarding and counted forever: shifts, commute, chores, caring. */
  repeats?: boolean;
  /**
   * Load distributed across the whole week rather than happening in one block -
   * the timetable, the commute. It counts towards the week and never appears in
   * a day's list, because "today" is things you do today.
   */
  spread?: boolean;
  /** Recovery is counted in the same units as work, and protected by default. */
  isRecovery?: boolean;
  /** Where a batched saving comes from, e.g. "in town". */
  place?: string;
  /**
   * Load stated directly instead of derived from hours x dread, and signed.
   *
   * Only today's logs use this. A night of five hours' sleep is strain you are
   * already carrying with no "hours" to multiply, and a good night removes some,
   * which needs to go negative. Everything else keeps the honest multiplication.
   */
  loadOverride?: number;
  /** Derived from a log rather than entered as a task. Never shown in a list. */
  isLog?: boolean;

  // --- work that takes more than one sitting -------------------------------
  /**
   * When it is due, which is not the same as when you do it.
   *
   * An assignment due Thursday is not a Thursday task; it is up to nine hours
   * spread across the days before Thursday. Conflating the two is why a to-do
   * list can look empty right up until the night it ruins.
   */
  deadline?: string;
  /** Total hours of preparation it needs. Absent for things you just attend. */
  prepHours?: number;
  /** Hours done so far. It stays on every day's list until this reaches prepHours. */
  prepDone?: number;
  /** 1 low, 2 normal, 3 high. Used to order what gets scheduled first. */
  importance?: 1 | 2 | 3;
  /** A booked sitting of a larger piece of work. */
  parentId?: string;
  /**
   * This sitting has been done.
   *
   * Progress is recorded by ticking sittings off rather than by dragging a
   * percentage: "I did the two hours I booked" is a thing you know, and "I am
   * 40% through" is a thing you guess.
   */
  sessionDone?: boolean;
  /** What you mean to get through in this sitting. Yours, in your words. */
  note?: string;
  /**
   * Where this lands across all five areas, when one heading was not enough.
   *
   * Absent means the old behaviour: the whole load sits in `bucket`. Present
   * means `bucket` is only the loudest of several, kept for the icon and the
   * filters, while the load itself is split by these weights.
   */
  mix?: Mix;

  // --- timetabled classes ---------------------------------------------------
  /** The module this belongs to. Lets load roll up per course. */
  moduleId?: string;
  /** What kind of contact hour it is. */
  sessionKind?: SessionKind;
  /** Where it is. Two rooms ten minutes apart is a real scheduling problem. */
  room?: string;
  /**
   * Why this particular hour matters more than its length suggests.
   *
   * A lecture is an hour of load like any other until it is the one where the
   * exam hints get given. Marking it changes what the app will let you move.
   */
  flags?: ClassFlag[];
}

export type SessionKind = 'lecture' | 'lab' | 'tutorial' | 'seminar';

/**
 * The three reasons a class is worth more than its hours.
 *
 *   tips       — exam hints, past papers, "this will come up"
 *   coursework — work gets set here, so it is where you find out what is coming
 *   attendance — it is counted, and missing it costs more than the hour
 */
export type ClassFlag = 'tips' | 'coursework' | 'attendance';

export interface Module {
  id: string;
  code: string;
  name: string;
  /** How much you mind this subject. Sets the dread on every class in it. */
  dread: Dread;
  importance: 1 | 2 | 3;
  /** Sessions attended out of those held so far. */
  attended: number;
  held: number;
  /** Percentage the department expects. Null when nobody is counting. */
  requiredAttendance: number | null;
}

/**
 * A good moment.
 *
 * The battery only ever went down, which is a miserable thing to hand someone
 * and also wrong: a day can genuinely go well. These are the small things that
 * give a little back, logged in one tap.
 */
export interface Moment {
  id: string;
  date: string;
  kind: string;
  bucket: BucketKey;
  /** Load returned, before diminishing returns are applied. */
  credit: number;
  /** Why, in the student's own words. The part worth reading back later. */
  note?: string;
}

/** One row of the recovery ledger. Positive is credit, negative is debt. */
export interface RecoveryEntry {
  id: string;
  label: string;
  detail: string;
  /** Hours. Negative means you are down. */
  hours: number | null;
}

/** One card on the matched-prescription screen. */
export interface Prescription {
  id: string;
  title: string;
  detail: string;
  /** Which empty bucket this refills. */
  refills: BucketKey;
  credit: number;
  /** When it goes in the calendar. An unscheduled suggestion is one you ignore. */
  slot: string;
  /** The window this belongs in. A nap at 7am is not a nap. */
  preferred?: readonly [number, number];
  tags?: string[];
  best?: boolean;
}

/** A specific thing you could put down, and the exact price of it. */
export interface Trade {
  id: string;
  itemId: string;
  title: string;
  /** The one line that names the trade. */
  detail: string;
  /** Load returned if you take this trade. */
  saves: number;
  /** Hard deadlines are locked, not just discouraged. */
  locked?: boolean;
  /** Recovery is protected by default; overriding takes a deliberate tap. */
  protected?: boolean;
  selected: boolean;
}

export interface CircleMember {
  id: string;
  name: string;
  initials: string;
  band: BandName;
  isYou?: boolean;
  /** Days stuck heavy. Surfaced quietly, with no script and no prompt to act. */
  heavyForDays?: number;
  /** Their battery. A band and a number is all anyone shares - never a task. */
  charge?: number;
  /** Evenings they are free, by date. The raw material for finding an overlap. */
  free?: Array<{ date: string; start: number; end: number }>;
}

/** A gathering you proposed. Local until someone accepts, which is the honest state. */
export interface Invite {
  id: string;
  title: string;
  date: string;
  startHour: number;
  hours: number;
  people: string[];
}

/** What the parser pulled out of one sentence. Every field is one tap from being fixed. */
export interface ParsedDraft {
  bucket: BucketKey;
  hours: number;
  dread: Dread;
  commitment: CommitmentKind;
  date: string | null;
  dateLabel: string | null;
  /** Fields the parser genuinely could not infer, so it asks instead of guessing. */
  unknown: Array<'hours' | 'date'>;
}

// ---------------------------------------------------------------- areas
// Each of the five buckets gets a screen of its own, and each one logs the
// thing that bucket is actually made of rather than a generic list.

/** Mental: a valence/arousal check-in. Two taps, no typing. */
export type MoodQuadrant = 'high-pleasant' | 'high-unpleasant' | 'low-pleasant' | 'low-unpleasant';

export type ContributionTag = 'Academics' | 'Social' | 'Finances' | 'Health' | 'Personal';

export interface MoodCheckIn {
  id: string;
  date: string;
  at: string;
  quadrant: MoodQuadrant;
  tags: ContributionTag[];
}

/** Physical: eating logged qualitatively, never as calories. */
export type MealStatus = 'filling' | 'light' | 'skipped' | 'pending';

export interface Meal {
  id: string;
  label: string;
  at: string;
  status: MealStatus;
}

/** Social: the gap since you last spoke, which is the thing nobody tracks. */
export interface Contact {
  id: string;
  name: string;
  initials: string;
  lastSpokeDays: number;
  state: 'talked' | 'saw' | 'none';
}

/** Errands: captured in one breath, sorted into batches you can do in one trip. */
export type ErrandCategory = 'Groceries' | 'Admin' | 'Academic' | 'Home';

export interface Errand {
  id: string;
  title: string;
  category: ErrandCategory;
  done: boolean;
  /** Rough size, hours. Used to price it against the errands ceiling. */
  hours?: number;
  /** How much it takes out of you, 1 to 3. Yours to set - a bank call is not a walk. */
  effort?: 1 | 2 | 3;
  /**
   * Added by the student rather than seeded. Only these count towards load, for
   * the same reason logs do: the seeded week has to keep reading as the
   * interface study states until someone puts something into it themselves.
   */
  addedByUser?: boolean;
  /** The day it belongs to. Everything you add lands on a day. */
  date?: string;
  /** Optional slot. With one it becomes a block; without, it waits on that day. */
  startHour?: number;
  /**
   * Which area it costs.
   *
   * Not everything you "just turn up" to is an errand: an interview costs mental,
   * a birthday costs social. The list holds one-off tasks of every kind; the
   * bucket is what keeps the load honest.
   */
  bucket?: BucketKey;
  /** The five-area split, when the student gave one at capture. */
  mix?: Mix;
}

/** Time: a block on the week grid. */
export interface Block {
  id: string;
  label: string;
  day: number;
  startHour: number;
  hours: number;
  kind: 'committed' | 'recovery';
}

// ---------------------------------------------------------------- simulator
/** One thing you could do tonight, and what it costs or gives back. */
export interface SimAction {
  id: string;
  label: string;
  bucket: BucketKey;
  /** Slider bounds, in whatever `unit` says. */
  min: number;
  max: number;
  step: number;
  baseline: number;
  unit: 'h' | 'min' | 'step';
  /** Charge points gained per unit above baseline. Negative costs you charge. */
  ptsPerUnit: number;
  /** Shown under the slider once it has moved off baseline. */
  goodNote: string;
  badNote: string;
  /** Discrete sliders read as words, not numbers: Skip / Quick hi / Properly. */
  labels?: string[];
  /** Added by the student rather than shipped. Their own evening, in the model. */
  custom?: boolean;
  /** The hours of the day this belongs in, so a walk is not booked at dawn. */
  preferred?: readonly [number, number];
  /**
   * Never becomes a block in a day. Sleep is the night, not an appointment, and
   * placing it on a timeline is how it ended up scheduled for the morning.
   */
  logOnly?: boolean;
}
