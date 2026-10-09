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
  /**
   * How much you want to be there, 1 to 5.
   *
   * Not the same as importance and not the opposite of dread, which is why it
   * needs its own number. A lecture can be important and unwanted. A sibling's
   * wedding can be wanted and, strictly speaking, skippable. Dread is how much
   * the thing costs you; this is how much you would mind losing it.
   *
   * It is the one thing in this list the app cannot work out for itself.
   */
  want?: 1 | 2 | 3 | 4 | 5;
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

  // --- what happened, once its time came -----------------------------------
  /**
   * Marked after the fact: done, partly done, or did not happen.
   *
   * Absent means nobody has said yet. A class reads it as signed in or not, a
   * sitting as how much got done, an errand as done or moved - see
   * `lib/marking.ts` for the question each kind of thing asks.
   */
  outcome?: Outcome;
  /** How much of it got done, 0 to 1. Only meaningful on a partial outcome. */
  fraction?: number;
  /**
   * Marked by the app the morning after, because nobody answered.
   *
   * Assumed done rather than left hanging, and kept reviewable: the student can
   * keep it, change it, or say it did not happen.
   */
  autoMarked?: boolean;
  /** Hours a marked sitting moved its work forward by, so changing the answer can undo it exactly. */
  creditedHours?: number;
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
  flags?: FlagId[];

  // --- brought in from a calendar -------------------------------------------
  /**
   * The Google Calendar event this came from. Its time follows Google: move it
   * there and it moves here. Everything else - how draining, can it move - is
   * the student's own answer.
   */
  source?: { kind: 'google'; eventId: string; seriesId?: string | null };
}

export type SessionKind = 'lecture' | 'lab' | 'tutorial' | 'seminar';

/** What happened to a thing once its time came. */
export type Outcome = 'done' | 'partial' | 'missed';

/**
 * The three reasons a class is worth more than its hours.
 *
 *   tips       — exam hints, past papers, "this will come up"
 *   coursework — work gets set here, so it is where you find out what is coming
 *   attendance — it is counted, and missing it costs more than the hour
 */
export type ClassFlag = 'tips' | 'coursework' | 'attendance';

/** A built-in flag, or the id of one the student made. */
export type FlagId = ClassFlag | (string & {});

/**
 * A reason of the student's own.
 *
 * Three built-in reasons cover the common cases and miss the rest: "lab safety
 * sign-off", "the one where we pick groups", "bring the laptop". Protecting is
 * opt-in - most flags are a note to self, and only the ones that say so stop
 * the app from ever proposing to move the class.
 */
export interface CustomFlag {
  id: string;
  label: string;
  emoji: string;
  /** Never suggest moving or skipping a class carrying this flag. */
  protect: boolean;
  /**
   * The module it belongs to. "Lab sign-off" means something in Algorithms and
   * nothing in a lecture-only module, so a flag is offered on its own module's
   * classes and nowhere else. Absent only on flags made before modules owned them.
   */
  moduleId?: string;
}

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
  /** How many weeks it runs for. Set by the student, at import or after. */
  weeks?: number;
  /** The Monday of its first week, so "week 10 of 12" can be worked out. */
  startDate?: string;
  /** The module's own picture, picked by the student. Decoration only. */
  emoji?: string;
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
  /** A picture for the row. Decoration only. */
  emoji?: string;
  /** The detail in a few words, for the ledger's one line. */
  tag?: string;
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
  /** A picture for the card. Decoration only. */
  emoji?: string;
  /** How long it is meant to take, which sets the default length. */
  minutes?: number;
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
  /**
   * Minutes since they last updated their own battery.
   *
   * The only number in this app that exists to bring someone back. Seeing that
   * four people checked in this morning is the difference between an app you
   * remember on a bad week and one you remember once.
   */
  updatedMinsAgo?: number;
  /** One short line they wrote themselves. Never generated, never inferred. */
  status?: string;
  /** How they said they feel, as one emoji they picked. */
  mood?: string;
  /**
   * Their picture: a photo (any image URI) or an emoji they chose instead.
   * Absent falls back to initials on the coloured ring.
   */
  pic?: string;
  /**
   * How often you message or plan with them - the last month's count. It is
   * what puts the few people you actually talk to on top of a list of eighty.
   */
  frequency?: number;
  /**
   * Their number, for handing a message to WhatsApp.
   *
   * Held so the app never has to ask for it twice, and used in exactly one
   * place: building a `wa.me` link the student then presses send on.
   */
  phone?: string;
}

/**
 * One evening, reported by the student.
 *
 * `felt` moves your ceilings - report being flattened at 70% twice and 70%
 * becomes your line. `verdict` moves how the app ranks things. Two different
 * lessons from one question, which is why the question is worth asking.
 */
export interface DayReport {
  date: string;
  felt: 'fine' | 'meh' | 'hard';
  percent: number;
  verdict?: 'good' | 'too-much' | 'wrong-order';
}

/**
 * How much each factor counts when deciding what comes first.
 *
 * One each for the three things a ranking can over-weight. They start at 1 and
 * are moved only by the evening question - never by the app deciding on its own
 * that it knows better. See `lib/review.ts`.
 */
export interface Weights {
  urgency: number;
  importance: number;
  want: number;
}

/** A gathering you proposed. Local until someone accepts, which is the honest state. */
export interface Invite {
  id: string;
  title: string;
  date: string;
  startHour: number;
  hours: number;
  people: string[];
  /** The group it was planned in, when it was. */
  groupId?: string;
  /** Each guest's answer so far, by circle id. No entry is still waiting. */
  answers?: Record<string, 'yes' | 'no'>;
  /** Put in your own week - a plan is only an invitation until you do. */
  scheduled?: boolean;
  sentAt?: string;
}

/** A plan somebody else made and asked you to. Yours to answer. */
export interface ReceivedInvite {
  id: string;
  title: string;
  date: string;
  startHour: number;
  hours: number;
  /** Who asked. */
  from: string;
  /** Everyone else asked, with their answer so far. */
  others: Array<{ id: string; name: string; answer?: 'yes' | 'no' }>;
  /** Yours, once given. */
  answer?: 'yes' | 'no';
  at?: string;
}

/**
 * A group of friends you plan with often.
 *
 * A group chat without the chat: a name, a picture and who is in it. Opening one
 * shows when everybody in it is free, which is the only thing a group chat is
 * ever trying to find out.
 */
export interface Group {
  id: string;
  name: string;
  emoji: string;
  /** Circle member ids who said yes. You are always in it and never listed. */
  members: string[];
  /** Friends asked to join who have not answered yet, with when they were asked. */
  invited?: Array<{ id: string; at: string }>;
  /** You made it: only its maker removes other people or deletes it. */
  owner?: boolean;
  /** What this group usually does together, so planning starts from it. */
  activities?: PlanActivity[];
}

/** Somebody asked you into one of their groups. Yours to answer. */
export interface GroupInvite {
  id: string;
  name: string;
  emoji: string;
  /** Who asked. */
  from: string;
  at: string;
  /** Who is already in it, as circle ids, when known. */
  members?: string[];
}

/**
 * Something that happened, worth telling you about once: a friend said yes,
 * somebody joined your group. Things that still need you - a request to
 * answer, a class to mark - are worked out live instead, so they disappear the
 * moment they are dealt with.
 */
export interface Notice {
  id: string;
  at: string;
  emoji: string;
  title: string;
  body?: string;
  /** Where tapping it goes. */
  to?: string;
}

/**
 * Something you plan with people: "Badminton, 2h", "Library session, 3h".
 *
 * The built-in list is dinner, a walk, a film. The thing a particular group
 * actually does every week is never on it, so it can be added once and offered
 * every time after.
 */
export interface PlanActivity {
  id: string;
  label: string;
  emoji: string;
  hours: number;
}

/** One weekday's shareable hours. Null means that day is never shared. */
export type ShareWindow = { start: number; end: number } | null;

/**
 * Sharing, beyond the three presets.
 *
 * The presets are right for most people and wrong for some: the student whose
 * Sunday mornings are nobody's business, the one who only wants to be asked
 * out on Fridays. This says exactly which hours of which days may be offered,
 * how short a window is worth showing, and who sees nothing at all.
 */
export interface ShareRules {
  /** Seven entries, Monday first. */
  week: ShareWindow[];
  /** Shorter free windows than this are left out. */
  minHours: number;
  /** How far ahead your free time is published. */
  ahead: 7 | 14;
  /** Friends who see no times, whichever mode is on. */
  hiddenFrom: string[];
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
  /** Work done before the day - an essay, a report - rather than something you turn up to. */
  prep: boolean;
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
  /** How much you want to be there. Same scale and same purpose as `Item.want`. */
  want?: 1 | 2 | 3 | 4 | 5;
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
  /** Load given back per unit above baseline (four is about one percent of a week). Negative costs it. */
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

/* ---------------------------------------------------------- google calendar */

/** A Google Calendar event, in the phone's own time. */
export interface CalendarEvent {
  /** `calendarId|eventId`. */
  id: string;
  /** Shared by every week of a repeating event. */
  seriesId: string | null;
  title: string;
  date: string;
  /** Absent for an all-day event. */
  startHour?: number;
  hours: number;
  allDay: boolean;
  location: string | null;
  calendar: string;
  color: string | null;
}

/** What kind of thing an event is - the one answer that sets up the rest. */
export type CalKind = 'class' | 'assignment' | 'exam' | 'shift' | 'exercise' | 'people' | 'chore' | 'other';

/** How a calendar event was set up, so the next weeks of it can be set up the same. */
export interface CalTemplate {
  title: string;
  kind: CalKind;
  bucket: BucketKey;
  mix: Mix;
  dread: Dread;
  commitment: CommitmentKind;
  want?: 1 | 2 | 3 | 4 | 5;
  /** Work before the day, for assignments and exams. */
  prep?: { hours: number; importance: 1 | 2 | 3; daysBefore: number };
  moduleId?: string;
  sessionKind?: SessionKind;
}

/** Your answer to a calendar event (or a whole repeating series). */
export type CalDecision = { as: 'added'; template: CalTemplate } | { as: 'skipped' };

/** The connection, as the app knows it. */
export interface CalendarLink {
  /** Live: through the API. Demo: a sample calendar, so the flow can be tried. */
  via: 'google' | 'sample';
  email: string | null;
  status: 'ok' | 'expired';
  lastSyncedAt: string | null;
  calendars: Array<{ id: string; name: string; color: string | null; on: boolean }>;
}
