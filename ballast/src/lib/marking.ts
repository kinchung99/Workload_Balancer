/**
 * What happened, once its time came.
 *
 * A planner that only looks forward never learns whether the plan happened, and
 * a student whose 9am lecture still reads "upcoming" at 3pm stops trusting the
 * rest of the screen. So everything with a time gets one question when it ends,
 * and the question depends on what it is: a class asks whether you signed in, a
 * sitting asks how much got done, an errand asks whether it is done or should
 * move. Nobody answers everything, so the morning after, whatever is still
 * unanswered is assumed done - and kept where it can be changed.
 *
 * Pure functions over items, so the rules are asserted in
 * `npm run behaviour:check` rather than trusted.
 */
import { DEMO_DAY, DEMO_HOUR } from '@/data/seed';
import type { Item, Module, Outcome } from './types';

/** Today on this device, in its own timezone. */
export function localISO(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * The time on `today`, as an hour: 14.5 is half past two.
 *
 * The seeded Monday keeps its own fixed afternoon, so the demo reads the same
 * on every phone at any hour - the morning lecture has ended, the afternoon's
 * work is under way. A real day uses the real clock; a day already gone is over.
 */
export function clockHour(today: string, now: Date = new Date()): number {
  if (today === DEMO_DAY) return DEMO_HOUR;
  const real = localISO(now);
  if (today < real) return 24;
  if (today > real) return 0;
  return now.getHours() + now.getMinutes() / 60;
}

export type MarkKind = 'class' | 'sitting' | 'work' | 'errand' | 'social' | 'shift' | 'rest';

export interface KindInfo {
  emoji: string;
  /** The one question this kind of thing asks once it is over. */
  question: string;
  /** How it is answered: attended or not, how much got done, or done or moved. */
  answer: 'attend' | 'progress' | 'errand';
  yes: string;
  no: string;
  /** The words a marked block wears. */
  doneWord: string;
  missWord: string;
}

export const KIND: Record<MarkKind, KindInfo> = {
  class: {
    emoji: '🎓', question: 'Did you sign in?', answer: 'attend',
    yes: 'Signed in', no: 'Didn’t attend', doneWord: 'Signed in', missWord: 'Missed',
  },
  sitting: {
    emoji: '✍️', question: 'How much did you get done?', answer: 'progress',
    yes: 'All of it', no: 'Didn’t start', doneWord: 'Done', missWord: 'Didn’t start',
  },
  work: {
    emoji: '🧠', question: 'How much did you get done?', answer: 'progress',
    yes: 'All of it', no: 'Didn’t start', doneWord: 'Done', missWord: 'Didn’t start',
  },
  errand: {
    emoji: '🧺', question: 'Done?', answer: 'errand',
    yes: 'Done', no: 'Move it', doneWord: 'Done', missWord: 'Not done',
  },
  social: {
    emoji: '🫶', question: 'Did you go?', answer: 'attend',
    yes: 'Went', no: 'Skipped', doneWord: 'Went', missWord: 'Skipped',
  },
  shift: {
    emoji: '💼', question: 'Did you work it?', answer: 'attend',
    yes: 'Worked it', no: 'Didn’t happen', doneWord: 'Worked', missWord: 'Didn’t happen',
  },
  rest: {
    emoji: '🌿', question: 'Did you do it?', answer: 'attend',
    yes: 'Did it', no: 'Skipped', doneWord: 'Did it', missWord: 'Skipped',
  },
};

/** Which question a thing asks. */
export function markKind(item: Item): MarkKind {
  if (item.moduleId) return 'class';
  if (item.parentId) return 'sitting';
  if (item.isRecovery || item.bucket === 'physical') return 'rest';
  if (item.bucket === 'social') return 'social';
  if (item.bucket === 'time') return 'shift';
  if (item.bucket === 'errands') return 'errand';
  return 'work';
}

/**
 * Things that happen on a day and can be said to have happened.
 *
 * Not logs, not load spread across the week, and not owing work itself - an
 * assignment is finished by its sittings, not by a tap on its due date.
 */
export const isMarkable = (item: Item): boolean =>
  !item.isLog && !item.spread && !(item.prepHours && !item.parentId);

/** A sitting ticked off before marking existed counts as done. */
export const outcomeOf = (item: Item): Outcome | undefined =>
  item.outcome ?? (item.parentId && item.sessionDone ? 'done' : undefined);

const endOf = (item: Item): number => (item.startHour === undefined ? 24 : item.startHour + item.hours);

export const hasEnded = (item: Item, today: string, hour: number): boolean =>
  item.date < today || (item.date === today && item.startHour !== undefined && endOf(item) <= hour);

export const hasStarted = (item: Item, today: string, hour: number): boolean =>
  item.date < today || (item.date === today && item.startHour !== undefined && item.startHour <= hour);

/**
 * How a block should read right now.
 *
 *   done / partial / missed - answered
 *   due   - its time is over and nobody has said
 *   now   - under way
 *   later - still ahead
 */
export type MarkStatus = Outcome | 'due' | 'now' | 'later';

export function markStatus(item: Item, today: string, hour: number): MarkStatus {
  const outcome = outcomeOf(item);
  if (outcome) return outcome;
  if (!isMarkable(item)) return 'later';
  if (hasEnded(item, today, hour)) return 'due';
  if (hasStarted(item, today, hour)) return 'now';
  return 'later';
}

/** The words for an answered block: "Signed in", "50% done", "Skipped". */
export function outcomeWord(item: Item): string | null {
  const outcome = outcomeOf(item);
  if (!outcome) return null;
  const info = KIND[markKind(item)];
  if (outcome === 'partial') return `${Math.round((item.fraction ?? 0) * 100)}% done`;
  return outcome === 'done' ? info.doneWord : info.missWord;
}

/** A class can only be signed into once it has started. Everything else can be ticked early. */
export const canMark = (item: Item, today: string, hour: number): boolean =>
  markKind(item) !== 'class' || hasStarted(item, today, hour);

/** Today's things whose time is over and nobody has answered, earliest first. */
export function toMark(items: Item[], today: string, hour: number): Item[] {
  return items
    .filter((item) => item.date === today && isMarkable(item) && !outcomeOf(item) && hasEnded(item, today, hour))
    .sort((a, b) => (a.startHour ?? 24) - (b.startHour ?? 24));
}

/** What the app marked by itself, newest day first. */
export const autoMarkedIn = (items: Item[]): Item[] =>
  items
    .filter((item) => item.autoMarked)
    .sort((a, b) => (a.date === b.date ? (a.startHour ?? 24) - (b.startHour ?? 24) : a.date < b.date ? 1 : -1));

const round1 = (value: number) => Math.round(value * 10) / 10;

export interface Marked {
  items: Item[];
  /** Register changes for a class: +1 attended, +1 held, and their undoing. */
  register?: { moduleId: string; attended: number; held: number };
}

/**
 * Answer one thing, or take an answer back (`outcome` undefined).
 *
 * A sitting moves its work forward by the share of its hours that got done, and
 * changing the answer later undoes exactly what the last one added. A class
 * moves its module's register by one session, once - answering twice cannot
 * count twice, which is what the old "+1" buttons got wrong.
 */
export function applyMark(
  items: Item[],
  id: string,
  outcome: Outcome | undefined,
  fraction?: number,
  auto = false,
): Marked {
  const item = items.find((candidate) => candidate.id === id);
  if (!item) return { items };
  const previous = outcomeOf(item);

  const share = outcome === 'done' ? 1
    : outcome === 'partial' ? Math.min(0.95, Math.max(0.05, fraction ?? 0.5))
    : 0;

  let next = items.map((candidate) => {
    if (candidate.id !== id) return candidate;
    const marked: Item = { ...candidate, outcome, autoMarked: auto || undefined };
    if (outcome === 'partial') marked.fraction = share;
    else delete marked.fraction;
    if (!outcome) delete marked.outcome;
    if (!marked.autoMarked) delete marked.autoMarked;
    return marked;
  });

  // A sitting: the work it belongs to moves by what this one actually did.
  if (item.parentId) {
    const credit = round1(item.hours * share);
    const before = item.creditedHours ?? (item.sessionDone ? item.hours : 0);
    const delta = credit - before;
    next = next.map((candidate) => {
      if (candidate.id === id) {
        return { ...candidate, sessionDone: outcome === 'done' || outcome === 'partial', creditedHours: credit };
      }
      if (candidate.id !== item.parentId) return candidate;
      const done = Math.max(0, Math.min(candidate.prepHours ?? 0, (candidate.prepDone ?? 0) + delta));
      return { ...candidate, prepDone: round1(done) };
    });
  }

  // A class: one session in the register, counted once.
  const counts = (o: Outcome | undefined) => ({ attended: o === 'done' ? 1 : 0, held: o ? 1 : 0 });
  const register = item.moduleId
    ? {
        moduleId: item.moduleId,
        attended: counts(outcome).attended - counts(previous).attended,
        held: counts(outcome).held - counts(previous).held,
      }
    : undefined;

  return { items: next, register };
}

/** Fold register changes into the modules they belong to. */
export function applyRegister(modules: Module[], changes: Array<Marked['register']>): Module[] {
  return modules.map((module) => {
    const mine = changes.filter((change) => change?.moduleId === module.id);
    if (!mine.length) return module;
    return {
      ...module,
      attended: Math.max(0, module.attended + mine.reduce((sum, change) => sum + (change?.attended ?? 0), 0)),
      held: Math.max(0, module.held + mine.reduce((sum, change) => sum + (change?.held ?? 0), 0)),
    };
  });
}

/**
 * The morning after: anything from an earlier day still unanswered is assumed
 * done, flagged as the app's guess so it can be reviewed.
 */
export function autoMark(items: Item[], modules: Module[], today: string): { items: Item[]; modules: Module[] } {
  const stale = items.filter((item) => item.date < today && isMarkable(item) && !outcomeOf(item));
  if (!stale.length) return { items, modules };
  let next = items;
  const changes: Array<Marked['register']> = [];
  for (const item of stale) {
    const result = applyMark(next, item.id, 'done', 1, true);
    next = result.items;
    changes.push(result.register);
  }
  return { items: next, modules: applyRegister(modules, changes) };
}
