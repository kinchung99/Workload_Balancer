/**
 * The calendar, sorted: what is new, what is set up, what was already there.
 * Read once here so Home's card, the bell and the calendar page agree.
 */
import { useMemo } from 'react';
import { calendarPicture } from '@/lib/gcal';
import { clockHour } from '@/lib/marking';
import { useStore } from '@/state/store';

export function useCalendar() {
  const calendar = useStore((state) => state.calendar);
  const events = useStore((state) => state.calendarEvents);
  const handled = useStore((state) => state.calendarHandled);
  const items = useStore((state) => state.items);
  const today = useStore((state) => state.today);
  const modules = useStore((state) => state.modules);
  const picture = useMemo(
    () => calendarPicture(events, items, handled, today, clockHour(today), modules),
    [events, items, handled, today, modules],
  );
  return { calendar, picture, expired: calendar?.status === 'expired' };
}
