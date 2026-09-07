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
  MoodQuadrant, ErrandCategory, Invite, Prescription, RecoveryEntry, Trade,
} from '@/lib/types';
import { loadOf, percentByBucket, overallPercent, isMovable, recalibrate } from '@/lib/load';
import { applySelection } from '@/lib/rebalance';
import { isSameWeek, addDays } from '@/lib/dates';
import { formatHour } from '@/lib/schedule';
import {
  CEILINGS, OVERALL_CEILING, TODAY, contacts as seedContacts, errands as seedErrands,
  meals as seedMeals, moodHistory, recoveryLedger, seedItems,
} from '@/data/seed';

interface State {
  today: string;
  /** False until the intro has been through once. Drives the first-run route. */
  onboarded: boolean;
  items: Item[];
  ceilings: Record<BucketKey, number>;
  overallCeiling: number;
  /** Above 90% the interface collapses. The student can override, per session. */
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
  keepItem: (id: string, pushId: string) => void;
  applyPlan: (
    blocks: Array<{ id: string; label: string; bucket: BucketKey; hours: number; credit: number; startHour?: number }>,
    sleepHours?: number,
  ) => void;
  reportDay: (felt: 'fine' | 'meh' | 'hard', percent: number) => void;
  logMood: (quadrant: MoodQuadrant, tags: ContributionTag[]) => void;
  setMealStatus: (id: string, status: MealStatus) => void;
  toggleErrand: (id: string) => void;
  addErrand: (title: string, category: ErrandCategory, hours: number, when?: { date: string; startHour: number }) => void;
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
  applyPlan: (blocks, sleepHours) =>
    set((state) => {
      // Ids are stable per activity per day, and anything matching is replaced
      // rather than appended. Applying the same plan three times used to leave
      // three walks stacked at 7am, 8am and 9am, which is not a plan.
      const ids = blocks.map((block) => `plan-${block.id}-${state.today}`);
      return {
        // Sleep is the night, not a block. It lands as a log and moves the
        // battery that way; it is never placed on a timeline.
        ...(sleepHours === undefined ? {} : { sleepHours }),
        items: [
          ...state.items.filter((item) => !ids.includes(item.id)),
          ...blocks.map((block, index) => ({
            id: ids[index],
            title: block.label,
            bucket: block.bucket,
            hours: block.hours,
            dread: 1 as const,
            commitment: 'self' as const,
            date: state.today,
            startHour: block.startHour,
            isRecovery: true,
          })),
        ],
        recovery: [
          ...blocks.map((block, index) => ({
            id: ids[index],
            label: block.label,
            detail: 'From tonight’s plan',
            hours: block.credit,
          })),
          ...state.recovery.filter((row) => !ids.includes(row.id)),
        ],
      };
    }),

  /** Reconnecting resets the gap. That is the only thing the social screen tracks. */
  markContacted: (id) =>
    set((state) => ({
      contacts: state.contacts.map((c) => (c.id === id ? { ...c, lastSpokeDays: 0, state: 'talked' } : c)),
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

  toggleErrand: (id) =>
    set((state) => ({ errands: state.errands.map((e) => (e.id === id ? { ...e, done: !e.done } : e)) })),

  addErrand: (title, category, hours, when) =>
    set((state) => ({
      errands: [
        { id: `errand-${Date.now()}`, title, category, done: false, hours, addedByUser: true, ...when },
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
      sleepHours: null, invites: [],
    }),
    }),
    {
      name: STORAGE_KEY,
      storage,
      /** `today` is the demo anchor and must not be frozen into a saved state. */
      partialize: ({ today, ...rest }) => rest,
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
