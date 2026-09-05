/**
 * App state. Zustand, because the whole model is small, local and synchronous.
 *
 * Frontend study: state lives in memory and starts from the seeded semester on
 * every launch. The place a real build would swap in SQLite is `seedItems` and
 * nowhere else - every screen already reads through the selectors below.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { STORAGE_KEY, storage } from './storage';
import type {
  BucketKey, Contact, ContributionTag, Dread, Errand, Item, Meal, MealStatus, MoodCheckIn,
  MoodQuadrant, Prescription, RecoveryEntry, Trade,
} from '@/lib/types';
import { loadOf, percentByBucket, overallPercent, isMovable, recalibrate } from '@/lib/load';
import { isSameWeek, addDays } from '@/lib/dates';
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
  /** Rebalance selections, keyed by trade id. */
  trades: Record<string, boolean>;
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
  /** Set once the free-evening window has been proposed to the circle. */
  windowSuggested: boolean;

  addItem: (item: Omit<Item, 'id'>) => void;
  setDread: (id: string, dread: Dread) => void;
  toggleTrade: (id: string) => void;
  applyTrades: (trades: Trade[]) => void;
  setShowEverything: (value: boolean) => void;
  setMinimumViableWeek: (value: boolean) => void;
  finishOnboarding: () => void;
  bookRecovery: (prescription: Prescription, when: string) => void;
  markContacted: (id: string) => void;
  suggestWindow: () => void;
  keepItem: (id: string, pushId: string) => void;
  applyPlan: (blocks: Array<{ id: string; label: string; bucket: BucketKey; hours: number; credit: number }>) => void;
  reportDay: (felt: 'fine' | 'meh' | 'hard', percent: number) => void;
  logMood: (quadrant: MoodQuadrant, tags: ContributionTag[]) => void;
  setMealStatus: (id: string, status: MealStatus) => void;
  toggleErrand: (id: string) => void;
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
  trades: {},
  dayReports: [],
  moods: moodHistory,
  meals: seedMeals,
  errands: seedErrands,
  contacts: seedContacts,
  recovery: recoveryLedger,
  booked: [],
  windowSuggested: false,

  addItem: (item) =>
    set((state) => ({ items: [...state.items, { ...item, id: `user-${Date.now()}` }] })),

  setDread: (id, dread) =>
    set((state) => ({ items: state.items.map((i) => (i.id === id ? { ...i, dread } : i)) })),

  toggleTrade: (id) => set((state) => ({ trades: { ...state.trades, [id]: !state.trades[id] } })),

  /**
   * What "apply" actually does: moves the calendar blocks and batches the
   * errand trip. It does not send anything without you reading it first, so the
   * two messages that need sending are drafted, not sent.
   */
  applyTrades: (trades) =>
    set((state) => {
      const taken = trades.filter((t) => state.trades[t.id] && !t.locked);
      const removed = new Set(taken.map((t) => t.itemId));
      return { items: state.items.filter((i) => !removed.has(i.id)), trades: {} };
    }),

  setShowEverything: (value) => set({ showEverythingAnyway: value }),
  setMinimumViableWeek: (value) => set({ minimumViableWeek: value }),

  finishOnboarding: () => set({ onboarded: true }),

  /**
   * Booking recovery is a real write, not a navigation. It puts a protected
   * block in the week and credits the ledger in the same units as work, which
   * is the entire "rest is a debt you are owed" claim made operational.
   */
  bookRecovery: (prescription, when) =>
    set((state) => ({
      booked: [...state.booked, prescription.id],
      items: [
        ...state.items,
        {
          id: `recovery-${prescription.id}`,
          title: prescription.title,
          bucket: prescription.refills,
          hours: Math.max(0.5, prescription.credit / 4),
          dread: 1,
          commitment: 'self',
          date: state.today,
          when,
          isRecovery: true,
        },
      ],
      recovery: [
        { id: `booked-${prescription.id}`, label: prescription.title, detail: `Booked for ${when}`, hours: prescription.credit },
        ...state.recovery,
      ],
    })),

  /**
   * The simulator's plan, committed. Every action worth charge becomes a real
   * protected block in the week, so "what if I slept nine hours" turns into
   * something the forecast and the rebalancer can both see.
   */
  applyPlan: (blocks) =>
    set((state) => ({
      items: [
        ...state.items,
        ...blocks.map((block) => ({
          id: `plan-${block.id}-${Date.now()}`,
          title: block.label,
          bucket: block.bucket,
          hours: block.hours,
          dread: 1 as const,
          commitment: 'self' as const,
          date: state.today,
          isRecovery: true,
        })),
      ],
      recovery: [
        ...blocks.map((block) => ({
          id: `plan-${block.id}-${Date.now()}`,
          label: block.label,
          detail: 'From tonight’s plan',
          hours: block.credit,
        })),
        ...state.recovery,
      ],
    })),

  /** Reconnecting resets the gap. That is the only thing the social screen tracks. */
  markContacted: (id) =>
    set((state) => ({
      contacts: state.contacts.map((c) => (c.id === id ? { ...c, lastSpokeDays: 0, state: 'talked' } : c)),
    })),

  suggestWindow: () => set({ windowSuggested: true }),

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
      items: seedItems, trades: {}, showEverythingAnyway: false, minimumViableWeek: false,
      moods: moodHistory, meals: seedMeals, errands: seedErrands, contacts: seedContacts,
      recovery: recoveryLedger, booked: [], windowSuggested: false, dayReports: [],
    }),
    }),
    {
      name: STORAGE_KEY,
      storage,
      /** `today` is the demo anchor and must not be frozen into a saved state. */
      partialize: ({ today, ...rest }) => rest,
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
