/**
 * Pop-ups outside the app, for the one thing worth one: a class or task whose
 * time has passed and is not marked yet.
 *
 * Everything else waits quietly behind the bell. This uses the browser's own
 * notifications, so it only shows once you have said yes to them, and only
 * when the app is not already in front of you - inside it, the banner at the
 * top asks the same question. Each class or task pops up once.
 */
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { KIND, clockHour, markKind, toMark } from '@/lib/marking';
import { useStore } from '@/state/store';

interface SystemNotice { onclick: (() => void) | null; close: () => void }
interface NoticeApi {
  new (title: string, options?: { body?: string; tag?: string }): SystemNotice;
  permission: 'default' | 'granted' | 'denied';
  requestPermission: () => Promise<'default' | 'granted' | 'denied'>;
}

/** The browser's notifications, when there are any. */
export const noticeApi = (): NoticeApi | null =>
  Platform.OS === 'web' && typeof globalThis !== 'undefined' && 'Notification' in globalThis
    ? (globalThis as unknown as { Notification: NoticeApi }).Notification
    : null;

const KEY = 'ballast/popped';
const popped = (): Set<string> => {
  try { return new Set(JSON.parse(globalThis.localStorage?.getItem(KEY) ?? '[]') as string[]); } catch { return new Set(); }
};
const remember = (ids: Set<string>) => {
  try { globalThis.localStorage?.setItem(KEY, JSON.stringify([...ids].slice(-200))); } catch { /* fine */ }
};

let go: ((to: Href) => void) | null = null;

/** Pop up every unmarked class or task not popped before. `always` ignores whether the app is in front. */
export function popDue(always = false): void {
  const api = noticeApi();
  if (!api || api.permission !== 'granted') return;
  const doc = (globalThis as unknown as { document?: { visibilityState: string; hasFocus: () => boolean } }).document;
  if (!always && doc && doc.visibilityState === 'visible' && doc.hasFocus()) return;
  const state = useStore.getState();
  const seen = popped();
  for (const item of toMark(state.items, state.today, clockHour(state.today))) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    const info = KIND[markKind(item)];
    const shown = new api(`${info.emoji} ${item.title}`, { body: `${info.question} Tap to update.`, tag: item.id });
    shown.onclick = () => {
      (globalThis as unknown as { focus?: () => void }).focus?.();
      go?.('/update' as Href);
      shown.close();
    };
  }
  remember(seen);
}

export function usePopups(): void {
  const router = useRouter();
  useEffect(() => {
    go = (to) => router.push(to);
    if (!noticeApi()) return;
    const check = () => popDue();
    const doc = (globalThis as unknown as { document?: { addEventListener: (e: string, f: () => void) => void; removeEventListener: (e: string, f: () => void) => void } }).document;
    doc?.addEventListener('visibilitychange', check);
    const every = setInterval(check, 60_000);
    check();
    return () => { clearInterval(every); doc?.removeEventListener('visibilitychange', check); };
  }, [router]);
}
