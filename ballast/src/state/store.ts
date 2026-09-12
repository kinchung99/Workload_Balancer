/**
 * App state. Zustand, because the whole model is small, local and synchronous.
 *
 * Frontend study: state lives in memory and starts from the seeded semester on
 * every launch. The place a real build would swap in SQLite is `seedItems` and
 * nowhere else - every screen already reads through the selectors below.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { SCHEMA_VERSION, STORAGE_KEY, migrateSaved, storage } from './storage';
import type {
  BucketKey, Contact, ContributionTag, Dread, Errand, Item, Meal, MealStatus, MoodCheckIn,
  MoodQuadrant, ClassFlag, Dread as DreadLevel, ErrandCategory, Invite, Module, Moment, Prescription,
  RecoveryEntry, SimAction, Trade, Mix,
} from '@/lib/types';
import { loadOf, percentByBucket, overallPercent, isMovable, recalibrate } from '@/lib/load';
import { applySelection } from '@/lib/rebalance';
import { completionCredit } from '@/lib/errands';
import { isSameWeek, addDays } from '@/lib/dates';
import { formatHour } from '@/lib/schedule';
import {
  CEILINGS, OVERALL_CEILING, TODAY, contacts as seedContacts, errands as seedErrands,
  meals as seedMeals, modules as seedModules, moodHistory, recoveryLedger, seedItems,
} from '@/data/seed';

interface State {
  today: string;
  /** False until the intro has been through once. Drives the first-run route. */
  onboarded: boolean;
  items: Item[];
  ceilings: Record<BucketKey, number>;
  overallCeiling: number;
  /** Past the calm-mode line the interface collapses. Overridable, per session. */
  showEverythingAnyway: boolean;
  /** One switch for the worst weeks. Nothing is deleted, it is out of sight. */
  minimumViableWeek: boolean;
  /** The one daily tap. Feeds ceiling calibration. */
  dayReports: Array<{ date: string; felt: 'fine' | 'meh' | 'hard'; percent: number }>;

  // Per-area logs. Each area records the thing it is actually made of.
  moods: MoodCheckIn[];
  meals: Meal[];
  errands: Errand[];
  contacts: Contact[];
  /** The ledger, mutable: booking recovery writes a credit into it. */
  recovery: RecoveryEntry[];
  /** Prescription ids already in the calendar, so they stop being suggested. */
  booked: string[];
  /** Hours slept last night. Null until logged; nothing is assumed. */
  sleepHours: number | null;
  /** Gatherings you proposed. Local until someone accepts - the honest state. */
  invites: Invite[];
  /** One-tap records of things that went well. The only input that adds charge. */
  moments: Moment[];
  /**
   * When your day is your own.
   *
   * Booking a run at 11am is not a plan for someone with a 5pm finish, so nothing
   * on the Tonight screen is placed before this hour.
   */
  offHour: number;
  /** Activities the student added themselves - badminton, a night run. */
  customActions: SimAction[];
  /** The courses behind the timetable. Dread lives here, not on each class. */
  modules: Module[];

  addItem: (item: Omit<Item, 'id'>) => void;
  setDread: (id: string, dread: Dread) => void;
  applyTrades: (trades: Trade[]) => void;
  setShowEverything: (value: boolean) => void;
  setMinimumViableWeek: (value: boolean) => void;
  finishOnboarding: () => void;
  bookRecovery: (prescription: Prescription, startHour: number, hours: number, date?: string) => void;
  markContacted: (id: string) => void;
  logSleep: (hours: number) => void;
  sendInvite: (invite: Omit<Invite, 'id'>) => void;
  logMoment: (kind: string, bucket: BucketKey, credit: number, note?: string) => void;
  logProgress: (id: string, hours: number) => void;
  moveItem: (id: string, date: string) => void;
  scheduleSessions: (
    parentId: string,
    sessions: Array<{ date: string; startHour: number; hours: number; note?: string }>,
    options?: { replace?: boolean },
  ) => void;
  unscheduleSession: (sessionId: string) => void;
  setSessionNote: (sessionId: string, note: string) => void;
  completeSitting: (sessionId: string) => void;
  logUnbookedHours: (id: string, hours: number) => void;
  keepItem: (id: string, pushId: string) => void;
  applyPlan: (
    blocks: Array<{ id: string; label: string; bucket: BucketKey; hours: number; credit: number; startHour?: number }>,
    sleepHours?: number,
    date?: string,
  ) => void;
  clearPlan: (date: string) => void;
  setOffHour: (hour: number) => void;
  addCustomAction: (action: SimAction) => void;
  removeCustomAction: (id: string) => void;
  pushSittings: (parentId: string, from: string, to: string) => void;
  setModuleDread: (moduleId: string, dread: DreadLevel) => void;
  setModuleImportance: (moduleId: string, importance: 1 | 2 | 3) => void;
  toggleClassFlag: (itemId: string, flag: ClassFlag) => void;
  markAttendance: (moduleId: string, attended: boolean) => void;
  importTimetable: (items: Item[], modules: Module[]) => void;
  reportDay: (felt: 'fine' | 'meh' | 'hard', percent: number) => void;
  logMood: (quadrant: MoodQuadrant, tags: ContributionTag[]) => void;
  setMealStatus: (id: string, status: MealStatus) => void;
  toggleErrand: (id: string) => void;
  addErrand: (
    title: string,
    category: ErrandCategory,
    hours: number,
    effort: 1 | 2 | 3,
    when: { date: string; startHour?: number },
    bucket?: BucketKey,
    mix?: Mix,
  ) => void;
  scheduleItem: (id: string, startHour: number | undefined) => void;
  cycleContact: (id: string) => void;
  reset: () => void;
}

export const useStore = create<State>()(
  persist(
    (set) => ({
  today: TODAY,
  onboarded: false,
  items: seedItems,
  ceilings: CEILINGS,
  overallCeiling: OVERALL_CEILING,
  showEverythingAnyway: false,
  minimumViableWeek: false,
  dayReports: [],
  moods: moodHistory,
  meals: seedMeals,
  errands: seedErrands,
  contacts: seedContacts,
  recovery: recoveryLedger,
  booked: [],
  sleepHours: null,
  invites: [],
  moments: [],
  offHour: 17,
  customActions: [],
  modules: seedModules,

  addItem: (item) =>
    set((state) => {
      // The same title, same day, same hour is one thing, however many times the
      // button was pressed.
      const duplicate = state.items.some(
        (existing) =>
          existing.title === item.title &&
          existing.date === item.date &&
          existing.startHour === item.startHour,
      );
      if (duplicate) return {};
      return { items: [...state.items, { ...item, id: `user-${Date.now()}` }] };
    }),

  setDread: (id, dread) =>
    set((state) => ({ items: state.items.map((i) => (i.id === id ? { ...i, dread } : i)) })),

  /**
   * What "apply" actually does: moves the calendar blocks and batches the
   * errand trip. It does not send anything without you reading it first, so the
   * two messages that need sending are drafted, not sent.
   */
  /**
   * What "apply" actually does: drops what you chose to put down and adds the
   * batched errand trip back, because batching is a re-plan rather than a
   * deletion.
   *
   * This read its selection from a store field the screen never wrote to, so the
   * set of taken trades was always empty and the button changed nothing at all.
   * The selection now travels on the trades themselves.
   */
  applyTrades: (trades) =>
    set((state) => ({
      items: applySelection(
        state.items,
        trades,
        Object.fromEntries(trades.map((trade) => [trade.id, !!trade.selected])),
      ),
    })),

  setShowEverything: (value) => set({ showEverythingAnyway: value }),
  setMinimumViableWeek: (value) => set({ minimumViableWeek: value }),

  finishOnboarding: () => set({ onboarded: true }),

  /**
   * Booking recovery is a real write, not a navigation. It puts a protected
   * block in the week and credits the ledger in the same units as work, which
   * is the entire "rest is a debt you are owed" claim made operational.
   */
  bookRecovery: (prescription, startHour, hours, date) =>
    set((state) => {
      // One block per prescription. Booking the same walk twice is not two walks.
      if (state.booked.includes(prescription.id)) return {};
      // Credit scales with how long you actually give it, not a fixed figure.
      const credit = Math.round(prescription.credit * hours * 10) / 10;
      return {
        booked: [...state.booked, prescription.id],
        items: [
          ...state.items,
          {
            id: `recovery-${prescription.id}`,
            title: prescription.title,
            bucket: prescription.refills,
            hours,
            dread: 1,
            commitment: 'self',
            date: date ?? state.today,
            startHour,
            isRecovery: true,
            // An hour of real rest is worth more than an hour of work costs.
            // Left as hours x dread it came to minus one, which is nothing
            // against a ceiling of a hundred and sixty - so booking the thing
            // the app had just recommended moved the battery by less than a
            // percent. It is worth what the ledger says it is worth.
            loadOverride: -credit,
          },
        ],
        recovery: [
          {
            id: `booked-${prescription.id}`,
            label: prescription.title,
            detail: `Booked for ${formatHour(startHour)}${date && date !== state.today ? ` on ${date.slice(8)}` : ''}`,
            hours: credit,
          },
          ...state.recovery,
        ],
      };
    }),

  /**
   * The simulator's plan, committed. Every action worth charge becomes a real
   * protected block in the week, so "what if I slept nine hours" turns into
   * something the forecast and the rebalancer can both see.
   */
  applyPlan: (blocks, sleepHours, date) =>
    set((state) => {
      const day = date ?? state.today;
      // A day has one plan, not a pile of them.
      //
      // Ids are stable per activity per day, but clearing only the ids in *this*
      // call left blocks from previous presses behind: booking a walk-only plan
      // after a walk-and-message one kept the message. The plan owns the whole
      // `plan-*` namespace for its day, so applying replaces it outright.
      const isPlanBlock = (id: string) => id.startsWith('plan-') && id.endsWith(`-${day}`);
      const ids = blocks.map((block) => `plan-${block.id}-${day}`);
      return {
        // Sleep is the night, not a block. It lands as a log and moves the
        // battery that way; it is never placed on a timeline.
        ...(sleepHours === undefined ? {} : { sleepHours }),
        items: [
          ...state.items.filter((item) => !isPlanBlock(item.id)),
          ...blocks.map((block, index) => ({
            id: ids[index],
            title: block.label,
            bucket: block.bucket,
            hours: block.hours,
            dread: 1 as const,
            commitment: 'self' as const,
            date: day,
            startHour: block.startHour,
            isRecovery: true,
            // Same rule as a booked prescription: rest is worth its credit.
            loadOverride: -block.credit,
          })),
        ],
        recovery: [
          ...blocks.map((block, index) => ({
            id: ids[index],
            label: block.label,
            detail: 'From tonight’s plan',
            hours: block.credit,
          })),
          ...state.recovery.filter((row) => !isPlanBlock(row.id)),
        ],
      };
    }),

  setOffHour: (hour) => set({ offHour: hour }),

  /**
   * You do not dread Tuesday, you dread networks.
   *
   * Dread belongs to the module, so setting it here re-prices every class in it
   * at once - which is the only way the number stays honest without asking for a
   * rating on all fourteen contact hours.
   */
  setModuleDread: (moduleId, dread) =>
    set((state) => ({
      modules: state.modules.map((m) => (m.id === moduleId ? { ...m, dread } : m)),
      items: state.items.map((item) => (item.moduleId === moduleId ? { ...item, dread } : item)),
    })),

  setModuleImportance: (moduleId, importance) =>
    set((state) => ({
      modules: state.modules.map((m) => (m.id === moduleId ? { ...m, importance } : m)),
    })),

  /**
   * Mark why an hour is worth more than its length.
   *
   * A flagged class is never proposed for moving: the lecture where the hints
   * get given is the one a stressed student is most likely to skip and least
   * able to afford to.
   */
  toggleClassFlag: (itemId, flag) =>
    set((state) => ({
      items: state.items.map((item) => {
        if (item.id !== itemId) return item;
        const flags = item.flags ?? [];
        return { ...item, flags: flags.includes(flag) ? flags.filter((f) => f !== flag) : [...flags, flag] };
      }),
    })),

  markAttendance: (moduleId, attended) =>
    set((state) => ({
      modules: state.modules.map((m) =>
        m.id === moduleId ? { ...m, held: m.held + 1, attended: m.attended + (attended ? 1 : 0) } : m,
      ),
    })),

  /** Replace the timetable wholesale. A paste is an import, not an append. */
  importTimetable: (items, modules) =>
    set((state) => ({
      items: [...state.items.filter((item) => !item.moduleId), ...items],
      modules,
    })),

  addCustomAction: (action) =>
    set((state) => ({
      customActions: [...state.customActions.filter((a) => a.id !== action.id), action],
    })),

  removeCustomAction: (id) =>
    set((state) => ({ customActions: state.customActions.filter((a) => a.id !== id) })),

  /**
   * Move a day's sittings of one piece of work onto another day.
   *
   * "Push to tomorrow" used to move the deadline itself, which is the one thing
   * a student cannot do. It moves the work instead: the sittings go, the due
   * date stays where the world put it.
   */
  pushSittings: (parentId, from, to) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.parentId === parentId && item.date === from ? { ...item, date: to, startHour: undefined } : item,
      ),
    })),

  /** Throw the whole plan for a day away. One plan per day, and it is undoable. */
  clearPlan: (date) =>
    set((state) => {
      const isPlanBlock = (id: string) => id.startsWith('plan-') && id.endsWith(`-${date}`);
      return {
        items: state.items.filter((item) => !isPlanBlock(item.id)),
        recovery: state.recovery.filter((row) => !isPlanBlock(row.id)),
      };
    }),

  /** Reconnecting resets the gap. That is the only thing the social screen tracks. */
  markContacted: (id) =>
    set((state) => ({
      contacts: state.contacts.map((c) => (c.id === id ? { ...c, lastSpokeDays: 0, state: 'talked' } : c)),
    })),

  /** The one input that gives charge back rather than taking it. */
  logMoment: (kind, bucket, credit, note) =>
    set((state) => ({
      moments: [...state.moments, { id: `moment-${Date.now()}`, date: state.today, kind, bucket, credit, note }],
    })),

  /** Chipping away at a longer piece of work. Percent undone falls as this rises. */
  logProgress: (id, hours) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id
          ? { ...item, prepDone: Math.min(item.prepHours ?? 0, Math.round(((item.prepDone ?? 0) + hours) * 10) / 10) }
          : item,
      ),
    })),

  /** Push it to another day. Losing a day is a decision, not a failure. */
  moveItem: (id, date) =>
    set((state) => ({
      items: state.items.map((item) => (item.id === id ? { ...item, date } : item)),
    })),

  /**
   * Book the sittings a plan proposed. Replaces any previous plan for the same
   * piece of work, so re-planning does not leave the old sessions behind.
   */
  /**
   * Book sittings of a longer piece of work.
   *
   * `replace` is for the planner, which proposes a whole schedule; adding one
   * sitting by hand keeps the ones already there.
   */
  scheduleSessions: (parentId, sessions, options) =>
    set((state) => {
      const parent = state.items.find((item) => item.id === parentId);
      if (!parent) return {};
      const kept = options?.replace
        ? state.items.filter((item) => item.parentId !== parentId)
        : state.items;
      const existing = kept.filter((item) => item.parentId === parentId).length;
      return {
        items: [
          ...kept,
          ...sessions.map((session, index) => ({
            id: `session-${parentId}-${Date.now()}-${existing + index}`,
            title: parent.title,
            bucket: parent.bucket,
            hours: session.hours,
            dread: parent.dread,
            commitment: parent.commitment,
            date: session.date,
            startHour: session.startHour,
            parentId,
            note: session.note,
            // A sitting costs what the whole piece costs, in the same places.
            mix: parent.mix,
          })),
        ],
      };
    }),

  /** Giving a sitting back. The unplanned part of the bar grows again. */
  unscheduleSession: (sessionId) =>
    set((state) => ({ items: state.items.filter((item) => item.id !== sessionId) })),

  setSessionNote: (sessionId, note) =>
    set((state) => ({
      items: state.items.map((item) => (item.id === sessionId ? { ...item, note } : item)),
    })),

  /**
   * Tick a sitting off, and the work it belongs to moves forward by its hours.
   *
   * This is the whole progress mechanism. Dragging a percentage asked the
   * student to estimate something they do not know; "I did the two hours I
   * booked on Tuesday" is something they do.
   */
  completeSitting: (sessionId) =>
    set((state) => {
      const session = state.items.find((item) => item.id === sessionId);
      if (!session || session.sessionDone || !session.parentId) return {};
      return {
        items: state.items.map((item) => {
          if (item.id === sessionId) return { ...item, sessionDone: true };
          if (item.id !== session.parentId) return item;
          const done = Math.min(item.prepHours ?? 0, (item.prepDone ?? 0) + session.hours);
          return { ...item, prepDone: Math.round(done * 10) / 10 };
        }),
      };
    }),

  /** Work done without booking a sitting first, which happens. */
  logUnbookedHours: (id, hours) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id
          ? { ...item, prepDone: Math.round(Math.min(item.prepHours ?? 0, (item.prepDone ?? 0) + hours) * 10) / 10 }
          : item,
      ),
    })),

  /** One tap on waking. The battery moves before you put the phone down. */
  logSleep: (hours) => set({ sleepHours: hours }),

  /**
   * Proposing a gathering puts it in your own week straight away. Seeing people
   * is load like anything else - pleasant load, but it still occupies an evening,
   * and hiding that would be the same lie every other planner tells.
   */
  sendInvite: (invite) =>
    set((state) => {
      // The same people, the same evening, twice, is one gathering.
      const duplicate = state.invites.some(
        (existing) =>
          existing.date === invite.date &&
          existing.startHour === invite.startHour &&
          existing.people.join() === invite.people.join(),
      );
      if (duplicate) return {};
      const id = `invite-${invite.date}-${invite.startHour}-${invite.people.join('-')}`;
      return {
        invites: [...state.invites, { ...invite, id }],
        items: [
          ...state.items,
          {
            id,
            title: invite.title,
            bucket: 'social',
            hours: invite.hours,
            dread: 1,
            commitment: 'soft',
            date: invite.date,
            startHour: invite.startHour,
          },
        ],
      };
    }),

  /**
   * "Actually, I'm going." Going is not the wrong answer, so the week re-plans
   * around it: the kept item stays and a self-imposed one moves to Sunday.
   */
  keepItem: (_id, pushId) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.id === pushId ? { ...item, date: addDays(item.date, 7 - ((new Date(`${item.date}T00:00:00Z`).getUTCDay() + 6) % 7) - 1) } : item,
      ),
    })),

  reportDay: (felt, percent) =>
    set((state) => ({ dayReports: [...state.dayReports, { date: state.today, felt, percent }] })),

  logMood: (quadrant, tags) =>
    set((state) => ({
      moods: [
        { id: `mood-${Date.now()}`, date: state.today, at: 'Just now', quadrant, tags },
        ...state.moods,
      ],
    })),

  setMealStatus: (id, status) =>
    set((state) => ({ meals: state.meals.map((m) => (m.id === id ? { ...m, status } : m)) })),

  /**
   * Ticking one off. Yours stops costing you; a seeded one pays out its weight
   * as a credit, so finishing something always moves the number.
   */
  toggleErrand: (id) =>
    set((state) => {
      const errand = state.errands.find((e) => e.id === id);
      if (!errand) return {};
      const credit = completionCredit(errand);
      const momentId = `errand-done-${id}`;
      return {
        errands: state.errands.map((e) => (e.id === id ? { ...e, done: !e.done } : e)),
        moments: errand.done
          ? state.moments.filter((m) => m.id !== momentId)
          : credit > 0
            ? [...state.moments, { id: momentId, date: state.today, kind: 'errand-done', bucket: 'errands' as const, credit, note: errand.title }]
            : state.moments,
      };
    }),

  /**
   * One list for everything you just do.
   *
   * Whether it arrives from the errands screen or from capture as a thing you
   * only have to turn up to, it is the same kind of object and lands in the same
   * place - so it shows up on its day *and* in the list, rather than one or the
   * other depending on where it was typed.
   */
  addErrand: (title, category, hours, effort, when, bucket, mix) =>
    set((state) => ({
      errands: [
        { id: `errand-${Date.now()}`, title, category, done: false, hours, effort, addedByUser: true, bucket, mix, ...when },
        ...state.errands,
      ],
    })),

  /**
   * Give a floating task a slot, or take one away.
   *
   * The point of separating scheduled from unscheduled is that you can act on
   * it: an hour of coursework with nowhere to go is the thing that quietly slides
   * to midnight, and this is how it stops.
   */
  scheduleItem: (id, startHour) =>
    set((state) => ({
      items: state.items.map((item) => (item.id === id ? { ...item, startHour } : item)),
    })),

  /** Not communicated -> talked -> saw -> not communicated. One tap, three states. */
  cycleContact: (id) =>
    set((state) => ({
      contacts: state.contacts.map((c) =>
        c.id === id
          ? { ...c, state: c.state === 'none' ? 'talked' : c.state === 'talked' ? 'saw' : 'none', lastSpokeDays: c.state === 'none' ? 0 : c.lastSpokeDays }
          : c,
      ),
    })),

  /** Back to the seeded semester. The intro stays done - resetting is not a punishment. */
  reset: () =>
    set({
      items: seedItems, showEverythingAnyway: false, minimumViableWeek: false,
      moods: moodHistory, meals: seedMeals, errands: seedErrands, contacts: seedContacts,
      recovery: recoveryLedger, booked: [], dayReports: [],
      sleepHours: null, invites: [], moments: [], offHour: 17, customActions: [], modules: seedModules,
      // Ceilings too. They move when you report a hard day below your line, and
      // reset clears the day reports that moved them - leaving the lowered line
      // in place with the evidence for it gone made every later reading read
      // worse than the seeded semester it claims to restore.
      ceilings: CEILINGS, overallCeiling: OVERALL_CEILING,
    }),
    }),
    {
      name: STORAGE_KEY,
      storage,
      /**
       * Only whether the intro has run survives a reload.
       *
       * Every launch starts from the seeded semester on purpose. A week you can
       * accidentally wreck and cannot get back is worse than one that forgets:
       * the demo is repeatable, nothing half-finished carries over, and a bug
       * fixed in code cannot be kept alive by data written before it. The intro
       * flag is the exception because replaying a three-step tour on every
       * refresh would be its own kind of punishment.
       */
      partialize: ({ onboarded }) => ({ onboarded }) as unknown as State,
      /**
       * Bump this whenever a fix changes what a *saved* week can contain.
       *
       * De-duplication and the sleep-is-not-a-block rule only stop new bad data;
       * a phone that had already stacked three walks at 7am, or written a "Sleep
       * tonight" block, would carry them forever. Raising the version drops the
       * old save and starts from the seeded semester again.
       */
      version: SCHEMA_VERSION,
      migrate: (persisted, from) => migrateSaved<State>(persisted, from) as State,
    },
  ),
);

// ---------------------------------------------------------------- selectors
// Kept as plain functions rather than hooks so the same maths is reachable from
// tests, the seed checker and the components without a React tree.

export const itemsInWeek = (items: Item[], anchor: string): Item[] =>
  items.filter((i) => isSameWeek(i.date, anchor));

export const itemsOnDay = (items: Item[], day: string): Item[] =>
  items.filter((i) => i.date === day && !i.spread);

export function weekReading(items: Item[], anchor: string, ceilings: Record<BucketKey, number>) {
  const week = itemsInWeek(items, anchor);
  const percents = percentByBucket(week, ceilings);
  return { week, percents, overall: overallPercent(percents) };
}

export const nextWeek = (anchor: string): string => addDays(anchor, 7);

/**
 * Your ceiling moves. Report a day as hard at a percentage below your current
 * line twice and that becomes the new line - the daily tap on the widget is the
 * only input, and this is where it lands.
 */
export const liveCeiling = (
  base: number,
  reports: Array<{ felt: 'fine' | 'meh' | 'hard'; percent: number }>,
): number => recalibrate(base, reports.filter((r) => r.felt === 'hard').map((r) => r.percent));

/** Hours of rest owed, from the live ledger rather than the seed constant. */
export const restOwedFrom = (rows: RecoveryEntry[]): number =>
  Math.abs(Math.round(rows.reduce((total, row) => total + (row.hours ?? 0), 0)));

/** Everything movable this week, largest saving first. Hard deadlines never appear. */
export const movableIn = (items: Item[]): Item[] =>
  items.filter(isMovable).sort((a, b) => loadOf(b) - loadOf(a));
