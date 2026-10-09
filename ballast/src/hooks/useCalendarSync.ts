/**
 * Google Calendar, kept current in the background.
 *
 * Signed in: the connection is checked when the app opens, and what is coming
 * up is read then, every fifteen minutes, and on coming back to the app (at
 * most every five). Each read also adds the next weeks of anything already set
 * up and follows anything Google moved. Never on the critical path of a screen.
 */
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { refreshCalendar, syncCalendar } from '@/lib/calendar';
import { useStore } from '@/state/store';

const EVERY_MS = 15 * 60_000;
const AT_MOST_MS = 5 * 60_000;

export function useCalendarSync(): void {
  const last = useRef(0);
  const live = useStore((state) => state.mode === 'live' && !!state.account);

  useEffect(() => {
    if (!live) return;
    const read = async (force = false) => {
      if (!force && Date.now() - last.current < AT_MOST_MS) return;
      last.current = Date.now();
      await refreshCalendar();
      const link = useStore.getState().calendar;
      if (link?.status === 'ok') await syncCalendar();
    };
    void read(true);
    const every = setInterval(() => void read(true), EVERY_MS);
    const app = AppState.addEventListener('change', (status) => { if (status === 'active') void read(); });
    return () => { clearInterval(every); app.remove(); };
  }, [live]);
}
