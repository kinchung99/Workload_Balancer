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
  /** Human time, e.g. "5pm to 11pm". Display only. */
  when?: string;
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
}
