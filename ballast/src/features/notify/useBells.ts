/**
 * The bell's list and its badge, and the quick-update count - read once from
 * the store so Home, the bell and the update page always agree.
 */
import { useMemo } from 'react';
import { bells, quickUpdate, unseen } from '@/lib/notify';
import { restOwedFrom, useStore } from '@/state/store';
import { useItemsWithLogs, useReading } from '@/state/selectors';
import { useCalendar } from '@/features/calendar/useCalendar';

export function useBells() {
  const { items, today, moods, sleepHours, requests, groupInvites, received, circle, notices, recovery, seenNotices } = useStore();
  const withLogs = useItemsWithLogs();
  const reading = useReading();
  const { picture, expired } = useCalendar();
  const fresh = picture.fresh.length;
  const update = useMemo(() => quickUpdate({ items, today, moods, sleepHours }), [items, today, moods, sleepHours]);
  const list = useMemo(() => bells({
    items: withLogs, today, requests, groupInvites, received, circle, notices,
    restOwed: restOwedFrom(recovery), charge: reading.charge, update, calendar: { fresh, expired },
  }), [withLogs, today, requests, groupInvites, received, circle, notices, recovery, reading.charge, update, fresh, expired]);
  return { list, update, unseen: unseen(list, seenNotices), calendar: picture };
}
