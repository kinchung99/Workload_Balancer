/**
 * Signed in, or sent to sign in.
 *
 * Two jobs, both mounted once at the root. First, ask the server whether this
 * device still has a session - a reload is not a sign-out - and, if it does,
 * bring that account's week in. Then send anyone who is neither signed in nor
 * (in a preview build) looking around as a guest to the sign-in screen,
 * whatever route they arrived on.
 *
 * A device that was signed in last time waits for the server's answer behind a
 * splash rather than flashing the sign-in screen; one that never was is sent
 * to sign in at once.
 */
import { useEffect } from 'react';
import { useRootNavigationState, useRouter, useSegments } from 'expo-router';
import { api, hasServer } from '@/lib/api';
import { demoBuild, guestAllowed } from '@/lib/access';
import { localISO } from '@/lib/marking';
import { useStore } from '@/state/store';
import { useHydrated } from './useHydrated';

/** Restore a saved session, once, on launch. */
export function useSession(): void {
  useEffect(() => {
    let live = true;
    void (async () => {
      if (!hasServer()) {
        useStore.getState().setSessionChecked();
        return;
      }
      const me = await api.me();
      if (!live) return;
      const state = useStore.getState();
      if (me.ok && me.data.isGuest && state.guest && guestAllowed()) {
        // A preview guest's AI pass (see lib/ai): a session for asking the
        // model, never an account - the sample week stays on screen.
      } else if (me.ok) {
        if (state.mode !== 'live' || state.account?.id !== me.data.id) state.goLive(me.data, localISO());
        else state.setAccount(me.data);
      } else if (state.lastAccountId && me.status === 401) {
        // The session this device remembered has gone: start from sign-in.
        state.endSession();
      }
      useStore.getState().setSessionChecked();
    })();
    return () => { live = false; };
  }, []);
}

/** Routes anyone may see without an account: the sign-in screen itself. */
const OPEN = new Set(['welcome']);

/** True while a remembered session is still being asked about. */
export function useWaitingForSession(): boolean {
  const hydrated = useHydrated();
  const account = useStore((state) => state.account);
  const remembered = useStore((state) => state.lastAccountId);
  const checked = useStore((state) => state.sessionChecked);
  return hydrated && !account && !!remembered && !checked;
}

/** Once per page load: the demo link starts every visit from the sample week. */
let demoFresh = false;

export function useGate(): void {
  const router = useRouter();
  const segments = useSegments();
  const navigation = useRootNavigationState();
  const hydrated = useHydrated();
  const waiting = useWaitingForSession();
  const account = useStore((state) => state.account);
  const guest = useStore((state) => state.guest);

  useEffect(() => {
    if (!navigation?.key || !hydrated || waiting) return;
    // Read the store as it is now, not as this render saw it: the first render
    // of a prerendered page is given the store's initial state to match the
    // server's HTML, a beat before the saved state lands.
    const now = useStore.getState();
    if (now.lastAccountId && !now.account && !now.sessionChecked) return;
    const allowed = !!now.account || (now.guest && guestAllowed());
    const top: string = segments[0] ?? '';
    if (demoBuild() && !demoFresh) {
      // A demo link: straight into the sample week, set up already - and the
      // same sample week on every visit. Whatever the last person tapped is
      // gone on a reload, so every judge starts from the same Monday.
      demoFresh = true;
      now.startGuest();
      useStore.getState().finishOnboarding();
      if (top === 'welcome' || top === 'setup') router.replace('/');
      return;
    }
    if (!allowed && !OPEN.has(top)) router.replace('/welcome');
  }, [navigation?.key, hydrated, waiting, account, guest, segments, router]);
}
