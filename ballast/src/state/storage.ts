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
