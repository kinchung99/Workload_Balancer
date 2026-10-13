/**
 * Whether the AI can be asked, getting it ready to be, and asking.
 *
 * Every AI call goes through the server, which only answers someone with a
 * session. A signed-in student has one. A preview guest looking around the
 * sample week does not - so the first time they ask, a quiet anonymous session
 * is opened just for the AI. It is never treated as an account: the sample week
 * stays on screen (see `useSession`). Real builds have no guests, so this only
 * ever happens on a preview link.
 */
import { useEffect, useRef, useState } from 'react';
import { api, hasServer, hasSessionToken } from './api';
import { guestAllowed } from './access';
import { useStore } from '@/state/store';

/** True when asking the AI can work: a server, and an account or a preview guest. */
export function useAiOpen(): boolean {
  const account = useStore((state) => state.account);
  const guest = useStore((state) => state.guest);
  return hasServer() && (!!account || (guest && guestAllowed()));
}

let pass: Promise<boolean> | null = null;

/** Make sure there is a session to ask with. False when there cannot be one. */
export async function ensureAi(): Promise<boolean> {
  if (!hasServer()) return false;
  const state = useStore.getState();
  if (state.account) return true;
  if (!(state.guest && guestAllowed())) return false;
  pass ??= (async () => {
    // A guest pass from earlier is reused; with none, asking first would only earn a 401.
    if (await hasSessionToken()) {
      const me = await api.me();
      if (me.ok) return true;
    }
    return (await api.signInGuest()).ok;
  })().catch(() => false);
  const ok = await pass;
  if (!ok) pass = null;
  return ok;
}

/** Answers already given this visit, by what was asked. */
const answers = new Map<string, unknown>();
/** When a question last failed, so a broken connection is not asked every render. */
const failedAt = new Map<string, number>();
const RETRY_AFTER_MS = 2 * 60_000;

/**
 * The AI's words for part of a screen, asked for when the screen opens.
 *
 * Null until they arrive, and null for good when the AI cannot be asked or
 * does not answer - so every caller shows its own content first and swaps the
 * AI's in when it lands. One question per key per visit: coming back to a
 * screen does not spend another call. A null key asks nothing.
 */
export function useAiAnswer<T>(key: string | null, ask: () => Promise<T | null>): T | null {
  const open = useAiOpen();
  const [answer, setAnswer] = useState<T | null>(() => (key ? (answers.get(key) as T | undefined) ?? null : null));
  const latest = useRef(ask);
  latest.current = ask;

  useEffect(() => {
    if (!key) { setAnswer(null); return; }
    const kept = answers.get(key) as T | undefined;
    if (kept) { setAnswer(kept); return; }
    setAnswer(null);
    if (!open || Date.now() - (failedAt.get(key) ?? 0) < RETRY_AFTER_MS) return;
    let live = true;
    void (async () => {
      const result = (await ensureAi()) ? await latest.current().catch(() => null) : null;
      if (result) answers.set(key, result);
      else failedAt.set(key, Date.now());
      if (live && result) setAnswer(result);
    })();
    return () => { live = false; };
  }, [key, open]);

  return answer;
}
