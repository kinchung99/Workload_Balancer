/**
 * Persistence, without a backend.
 *
 * The app is frontend-only but it should not feel like a prototype: a week you
 * rebalanced stays rebalanced, a task you added is still there tomorrow, and the
 * intro does not run twice. AsyncStorage is device-local - on native it is the
 * platform store, on web it is localStorage. Nothing leaves the phone.
 *
 * The guard matters: `expo export` renders every route in Node, where there is
 * no window and no localStorage. Without this the static build crashes, so the
 * adapter degrades to an in-memory stub during prerender and the page hydrates
 * from real storage in the browser.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage, type StateStorage } from 'zustand/middleware';

const memory = new Map<string, string>();

const inMemory: StateStorage = {
  getItem: (name) => memory.get(name) ?? null,
  setItem: (name, value) => void memory.set(name, value),
  removeItem: (name) => void memory.delete(name),
};

/** React Native and browsers both define `window`; Node during prerender does not. */
export const isClient = typeof window !== 'undefined';

export const storage = createJSONStorage(() => (isClient ? AsyncStorage : inMemory));

export const STORAGE_KEY = 'ballast/v1';

/**
 * Saved-state schema version.
 *
 * Raise it when a fix changes what a saved week may contain, so devices holding
 * data written by the old code start clean instead of carrying the bug forward.
 *
 *   1  first persisted build
 *   2  de-duplicated plan blocks, and sleep stopped being a placeable block
 *   3  empty submits no longer create phantom "OS assignment" tasks
 */
export const SCHEMA_VERSION = 3;

/**
 * What survives an upgrade.
 *
 * Only facts about the person, never about their week. A save written before the
 * de-duplication fix can contain three walks stacked at 7am and a "Sleep tonight"
 * block that should never have existed; nothing in it is worth carrying forward,
 * so the week resets to the seeded semester and the intro stays done.
 */
export function migrateSaved<T extends { onboarded?: boolean }>(
  persisted: unknown,
  from: number,
): Partial<T> {
  if (from >= SCHEMA_VERSION) return (persisted ?? {}) as Partial<T>;
  const previous = persisted as { onboarded?: boolean } | undefined;
  return { onboarded: previous?.onboarded ?? false } as Partial<T>;
}
