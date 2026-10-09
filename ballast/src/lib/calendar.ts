/**
 * Google Calendar, from the app's side: connect, read, choose, disconnect.
 *
 * Signed in, everything goes through the API, which holds the connection. In
 * the sample week there is no account to connect, so a sample calendar stands
 * in and every screen works the same way - which is how the flow can be shown
 * on a demo link.
 */
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { api } from './api';
import { fromGoogle } from './gcal';
import { useStore } from '@/state/store';

const live = () => useStore.getState().mode === 'live' && !!useStore.getState().account;

/** Where Google should send the student back to: this app's calendar page. */
function returnTo(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') return `${window.location.origin}/calendar`;
  return Linking.createURL('/calendar');
}

/** Connected or not, and whether connecting is possible at all. */
export async function refreshCalendar(): Promise<void> {
  if (!live()) return;
  const res = await api.calendarStatus();
  // An API from before calendars existed answers 404: nothing to connect to yet.
  if (!res.ok) {
    if (res.status === 404) useStore.getState().setCalendarLink(null, false);
    return;
  }
  const status = res.data;
  const store = useStore.getState();
  if (!status.connected) {
    store.setCalendarLink(null, status.available);
    return;
  }
  store.setCalendarLink({
    via: 'google',
    email: status.email,
    status: status.status === 'expired' ? 'expired' : 'ok',
    lastSyncedAt: status.lastSyncedAt,
    calendars: status.calendars,
  }, status.available);
}

/** What is coming up. Returns false when Google needs reconnecting or did not answer. */
export async function syncCalendar(): Promise<boolean> {
  const store = useStore.getState();
  if (!live()) {
    if (store.calendar?.via === 'sample') store.setSampleCalendarsOn(store.calendar.calendars.filter((c) => c.on).map((c) => c.id));
    return true;
  }
  const res = await api.calendarEvents();
  if (!res.ok) {
    if (res.status === 409 && store.calendar) store.setCalendarLink({ ...store.calendar, status: 'expired' });
    if (res.status === 404) store.setCalendarLink(null);
    return false;
  }
  const link = useStore.getState().calendar;
  useStore.getState().setCalendarLink({
    via: 'google',
    email: link?.email ?? null,
    status: 'ok',
    lastSyncedAt: res.data.syncedAt,
    calendars: res.data.calendars,
  });
  useStore.getState().setCalendarEvents(res.data.events.map(fromGoogle));
  return true;
}

/**
 * Off to Google to say yes. On the web this leaves the page; Google sends
 * the student back to /calendar?calendar=connected. Returns an error word
 * when it could not even start.
 */
export async function connectCalendar(): Promise<'ok' | 'unavailable' | 'offline'> {
  if (!live()) {
    useStore.getState().connectSampleCalendar();
    return 'ok';
  }
  const res = await api.calendarConnect(returnTo());
  if (!res.ok) return res.status === 503 || res.status === 404 ? 'unavailable' : 'offline';
  if (Platform.OS === 'web' && typeof window !== 'undefined') window.location.assign(res.data.url);
  else await Linking.openURL(res.data.url);
  return 'ok';
}

/** Which calendars to read. */
export async function chooseCalendars(on: string[]): Promise<void> {
  if (!live()) {
    useStore.getState().setSampleCalendarsOn(on);
    return;
  }
  const link = useStore.getState().calendar;
  if (link) useStore.getState().setCalendarLink({ ...link, calendars: link.calendars.map((c) => ({ ...c, on: on.includes(c.id) })) });
  await api.calendarChoose(on);
  await syncCalendar();
}

/** Stop reading it. What was already set up stays in your week - it is yours now. */
export async function disconnectCalendar(): Promise<void> {
  if (live()) await api.calendarDisconnect();
  useStore.getState().forgetCalendar();
}
