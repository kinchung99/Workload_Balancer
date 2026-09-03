/**
 * App state. Zustand, because the whole model is small, local and synchronous.
 *
 * Frontend study: state lives in memory and starts from the seeded semester on
 * every launch. The place a real build would swap in SQLite is `seedItems` and
 * nowhere else - every screen already reads through the selectors below.
 */
import { create } from 'zustand';
import type {
  BucketKey, Contact, ContributionTag, Dread, Errand, Item, Meal, MealStatus, MoodCheckIn,
  MoodQuadrant, Trade,
} from '@/lib/types';
import { loadOf, percentByBucket, overallPercent, isMovable } from '@/lib/load';
import { isSameWeek, addDays } from '@/lib/dates';
import {
  CEILINGS, OVERALL_CEILING, TODAY, contacts as seedContacts, errands as seedErrands,
  meals as seedMeals, moodHistory, seedItems,
} from '@/data/seed';

interface State {
  today: string;
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

  addItem: (item: Omit<Item, 'id'>) => void;
  setDread: (id: string, dread: Dread) => void;
  toggleTrade: (id: string) => void;
  applyTrades: (trades: Trade[]) => void;
  setShowEverything: (value: boolean) => void;
  setMinimumViableWeek: (value: boolean) => void;
  reportDay: (felt: 'fine' | 'meh' | 'hard', percent: number) => void;
  logMood: (quadrant: MoodQuadrant, tags: ContributionTag[]) => void;
  setMealStatus: (id: string, status: MealStatus) => void;
  toggleErrand: (id: string) => void;
  cycleContact: (id: string) => void;
  reset: () => void;
}

export const useStore = create<State>((set) => ({
  today: TODAY,
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

  reset: () =>
    set({
      items: seedItems, trades: {}, showEverythingAnyway: false, minimumViableWeek: false,
      moods: moodHistory, meals: seedMeals, errands: seedErrands, contacts: seedContacts,
    }),
}));

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

/** Everything movable this week, largest saving first. Hard deadlines never appear. */
export const movableIn = (items: Item[]): Item[] =>
  items.filter(isMovable).sort((a, b) => loadOf(b) - loadOf(a));
