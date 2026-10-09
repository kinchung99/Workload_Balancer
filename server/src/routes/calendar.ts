/**
 * Google Calendar - connect, read what is coming up, disconnect.
 *
 * The connection is the standard OAuth round trip, done here rather than on the
 * phone so the refresh token never touches the device and every one of the
 * student's phones sees the same calendar:
 *
 *   1. The app asks `POST /connect` for a Google link. The state in that link is
 *      signed and says who asked and where to send them back.
 *   2. Google sends them to `GET /callback`, which needs no cookie - the signed
 *      state is the proof - swaps the code for a refresh token, seals it, and
 *      redirects back into the app.
 *   3. `GET /events` reads the next four weeks from the calendars they chose.
 *
 * Events are read on request and never stored. What the student keeps from
 * them becomes their own items, set up on the phone like anything else.
 */
import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import {
  calendarChooseSchema, calendarConnectSchema,
  type CalendarDTO, type CalendarEventDTO, type CalendarEventsResponse, type CalendarStatusDTO,
} from '../../../shared/contract.js';
import { calendarLinks } from '../db/schema.js';
import { trustedReturn } from '../lib/auth.js';
import { GoogleGone, type GoogleCalendarClient, type GoogleCalendarEntry, type GoogleEvent } from '../lib/google.js';
import { readState, seal, signState, unseal } from '../lib/seal.js';
import type { Env } from '../types.js';

const DAY = 24 * 60 * 60 * 1000;
/** Yesterday to four weeks out: enough to plan with, little enough to read in one go. */
const WINDOW_BACK = 1 * DAY;
const WINDOW_AHEAD = 28 * DAY;
const MAX_CALENDARS = 10;
const MAX_EVENTS = 400;

const redirectUri = (): string => `${process.env.BASE_URL ?? 'http://localhost:8787'}/api/calendar/callback`;

/** Public holidays and contacts' birthdays are calendars too; neither is a plan. */
const noisy = (id: string): boolean => /#holiday@|#contacts@|#weeknum@/.test(id);

/** Their calendars, keeping what they switched on or off before. */
function merge(found: GoogleCalendarEntry[], saved: CalendarDTO[] | null): CalendarDTO[] {
  return found.map((entry) => {
    const before = saved?.find((s) => s.id === entry.id);
    return {
      id: entry.id,
      name: entry.primary ? 'Main calendar' : entry.name,
      color: entry.color,
      on: before ? before.on : entry.primary || (entry.selected && !noisy(entry.id)),
    };
  });
}

/** One Google event as the app reads it, or null when it is not something to plan around. */
export function toEvent(raw: GoogleEvent, calendar: CalendarDTO): CalendarEventDTO | null {
  if (raw.status === 'cancelled') return null;
  if (raw.eventType && !['default', 'fromGmail', 'focusTime'].includes(raw.eventType)) return null;
  if (raw.attendees?.some((a) => a.self && a.responseStatus === 'declined')) return null;
  const start = raw.start?.dateTime ?? raw.start?.date;
  const end = raw.end?.dateTime ?? raw.end?.date;
  if (!start || !end) return null;
  const allDay = !raw.start?.dateTime;
  // A trip or a reading week is a stretch of days, not a thing on one of them.
  if (allDay && Date.parse(end) - Date.parse(start) > DAY) return null;
  return {
    id: `${calendar.id}|${raw.id}`,
    seriesId: raw.recurringEventId ? `${calendar.id}|${raw.recurringEventId}` : null,
    title: (raw.summary ?? '').trim().slice(0, 120) || 'Busy',
    start, end, allDay,
    location: raw.location?.trim().slice(0, 120) || null,
    calendar: calendar.name,
    color: calendar.color,
    updated: raw.updated ?? new Date(0).toISOString(),
  };
}

export function calendarRoutes(google: GoogleCalendarClient | null) {
  const routes = new Hono<Env>();

  const linkOf = async (db: Env['Variables']['db'], userId: string) => {
    const [row] = await db.select().from(calendarLinks).where(eq(calendarLinks.userId, userId)).limit(1);
    return row ?? null;
  };

  /** Connected or not, to which account, and which calendars are read. */
  routes.get('/', async (c) => {
    const row = await linkOf(c.get('db'), c.get('userId'));
    const status: CalendarStatusDTO = {
      available: !!google,
      connected: !!row,
      email: row?.googleEmail ?? null,
      status: row ? (row.status === 'expired' ? 'expired' : 'ok') : null,
      lastSyncedAt: row?.lastSyncedAt?.toISOString() ?? null,
      calendars: row?.calendars ?? [],
    };
    return c.json(status);
  });

  /** A Google sign-in link that comes back to the app. */
  routes.post('/connect', async (c) => {
    if (!google) return c.json({ error: 'not_configured' }, 503);
    const parsed = calendarConnectSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'bad_request' }, 400);
    if (!trustedReturn(parsed.data.returnTo)) return c.json({ error: 'bad_return' }, 400);
    const state = signState({ u: c.get('userId'), r: parsed.data.returnTo }, 10 * 60 * 1000);
    return c.json({ url: google.authUrl(state, redirectUri()) });
  });

  /**
   * Google, sending them back. No session here: the signed state is the proof
   * of who started it, so this works however the browser treats cookies.
   */
  routes.get('/callback', async (c) => {
    const state = readState<{ u: string; r: string }>(c.req.query('state') ?? '');
    if (!state || !google || !trustedReturn(state.r)) {
      return c.text('This link has expired. Go back to Ballast and connect again.', 400);
    }
    const back = (result: string) => {
      const url = new URL(state.r);
      url.searchParams.set('calendar', result);
      return c.redirect(url.toString(), 302);
    };
    const code = c.req.query('code');
    if (c.req.query('error') || !code) return back('cancelled');

    try {
      const { refreshToken, email } = await google.exchange(code, redirectUri());
      if (!refreshToken) return back('failed');
      const sealed = seal(refreshToken);
      await c.get('db').insert(calendarLinks)
        .values({ userId: state.u, googleEmail: email, refreshToken: sealed, status: 'ok', calendars: null })
        .onConflictDoUpdate({
          target: calendarLinks.userId,
          set: { googleEmail: email, refreshToken: sealed, status: 'ok' },
        });
      return back('connected');
    } catch (err) {
      console.error('[calendar] connect failed', err);
      return back('failed');
    }
  });

  /** What is coming up, from the calendars they chose. */
  routes.get('/events', async (c) => {
    const db = c.get('db');
    const userId = c.get('userId');
    const row = await linkOf(db, userId);
    if (!row) return c.json({ error: 'not_connected' }, 404);
    if (!google) return c.json({ error: 'not_configured' }, 503);
    const token = unseal(row.refreshToken);
    if (row.status === 'expired' || !token) return c.json({ error: 'reconnect' }, 409);

    try {
      const access = await google.access(token);
      const calendars = merge(await google.calendars(access), row.calendars ?? null);
      const now = Date.now();
      const from = new Date(now - WINDOW_BACK).toISOString();
      const to = new Date(now + WINDOW_AHEAD).toISOString();
      const reading = calendars.filter((cal) => cal.on).slice(0, MAX_CALENDARS);
      const lists = await Promise.all(reading.map(async (cal) =>
        (await google.events(access, cal.id, from, to)).map((raw) => toEvent(raw, cal))));
      const events = lists.flat()
        .filter((e): e is CalendarEventDTO => e !== null)
        .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
        .slice(0, MAX_EVENTS);

      const syncedAt = new Date();
      await db.update(calendarLinks).set({ calendars, lastSyncedAt: syncedAt }).where(eq(calendarLinks.userId, userId));
      const body: CalendarEventsResponse = { events, calendars, syncedAt: syncedAt.toISOString() };
      return c.json(body);
    } catch (err) {
      if (err instanceof GoogleGone) {
        await db.update(calendarLinks).set({ status: 'expired' }).where(eq(calendarLinks.userId, userId));
        return c.json({ error: 'reconnect' }, 409);
      }
      console.error('[calendar] read failed', err);
      return c.json({ error: 'google_unavailable' }, 502);
    }
  });

  /** Which calendars to read. */
  routes.post('/calendars', async (c) => {
    const parsed = calendarChooseSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'bad_request' }, 400);
    const db = c.get('db');
    const row = await linkOf(db, c.get('userId'));
    if (!row) return c.json({ error: 'not_connected' }, 404);
    const calendars = (row.calendars ?? []).map((cal) => ({ ...cal, on: parsed.data.on.includes(cal.id) }));
    await db.update(calendarLinks).set({ calendars }).where(eq(calendarLinks.userId, row.userId));
    return c.json({ calendars });
  });

  /** Disconnect: tell Google to forget the token, then forget it here. */
  routes.delete('/', async (c) => {
    const db = c.get('db');
    const row = await linkOf(db, c.get('userId'));
    if (!row) return c.json({ ok: true });
    const token = unseal(row.refreshToken);
    if (token && google) await google.revoke(token);
    await db.delete(calendarLinks).where(eq(calendarLinks.userId, row.userId));
    return c.json({ ok: true });
  });

  return routes;
}
