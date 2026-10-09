/**
 * Google Calendar, over plain HTTPS.
 *
 * Five calls and no SDK: the `googleapis` package is tens of megabytes to cold
 * start on a serverless function, for what is a sign-in redirect, two token
 * requests and two GETs. Everything goes through one `fetch` so the checks can
 * hand in a fake Google and exercise the real routes.
 *
 * Read-only on purpose. The app never writes to anybody's calendar - it reads
 * what is coming up and asks the student what each thing costs them.
 */

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const API = 'https://www.googleapis.com/calendar/v3';

/** Who they are (to show which account is connected) and their calendars, read-only. */
export const CALENDAR_SCOPES = ['openid', 'email', 'https://www.googleapis.com/auth/calendar.readonly'];

/** Google no longer honours this connection - revoked, or a test app's seven days are up. */
export class GoogleGone extends Error {
  constructor() { super('google_gone'); this.name = 'GoogleGone'; }
}

/** Google said no, or did not answer. */
export class GoogleError extends Error {
  constructor(public status: number, detail: string) { super(`google_${status}: ${detail}`); this.name = 'GoogleError'; }
}

/** One calendar in their list, as Google describes it. */
export interface GoogleCalendarEntry {
  id: string;
  name: string;
  color: string | null;
  primary: boolean;
  /** Shown in their Google Calendar right now. */
  selected: boolean;
}

/** The parts of a Google event this app reads. */
export interface GoogleEvent {
  id: string;
  status?: string;
  summary?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
  location?: string;
  recurringEventId?: string;
  updated?: string;
  eventType?: string;
  attendees?: Array<{ self?: boolean; responseStatus?: string }>;
}

export interface GoogleCalendarClient {
  authUrl(state: string, redirectUri: string): string;
  exchange(code: string, redirectUri: string): Promise<{ refreshToken: string | null; email: string | null }>;
  /** A fresh access token. Throws GoogleGone when the refresh token is dead. */
  access(refreshToken: string): Promise<string>;
  calendars(accessToken: string): Promise<GoogleCalendarEntry[]>;
  events(accessToken: string, calendarId: string, from: string, to: string): Promise<GoogleEvent[]>;
  revoke(token: string): Promise<void>;
}

/** The email inside an ID token. Read, not verified: it came straight from Google over TLS. */
function emailFrom(idToken: unknown): string | null {
  if (typeof idToken !== 'string') return null;
  try {
    const body = JSON.parse(Buffer.from(idToken.split('.')[1] ?? '', 'base64url').toString('utf8')) as { email?: unknown };
    return typeof body.email === 'string' ? body.email : null;
  } catch {
    return null;
  }
}

export function googleCalendar(clientId: string, clientSecret: string, fetcher: typeof fetch = fetch): GoogleCalendarClient {
  const form = (body: Record<string, string>) => ({
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
    signal: AbortSignal.timeout(10_000),
  });
  const get = async <T>(url: string, accessToken: string): Promise<T> => {
    const res = await fetcher(url, { headers: { authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(10_000) });
    if (res.status === 401) throw new GoogleGone();
    if (!res.ok) throw new GoogleError(res.status, (await res.text()).slice(0, 200));
    return res.json() as Promise<T>;
  };

  return {
    authUrl(state, redirectUri) {
      const query = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: CALENDAR_SCOPES.join(' '),
        // Offline and consent: the only way Google hands over a refresh token every time.
        access_type: 'offline',
        prompt: 'consent',
        include_granted_scopes: 'true',
        state,
      });
      return `${AUTH_URL}?${query.toString()}`;
    },

    async exchange(code, redirectUri) {
      const res = await fetcher(TOKEN_URL, form({
        code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code',
      }));
      if (!res.ok) throw new GoogleError(res.status, (await res.text()).slice(0, 200));
      const body = await res.json() as { refresh_token?: string; id_token?: string };
      return { refreshToken: body.refresh_token ?? null, email: emailFrom(body.id_token) };
    },

    async access(refreshToken) {
      const res = await fetcher(TOKEN_URL, form({
        refresh_token: refreshToken, client_id: clientId, client_secret: clientSecret, grant_type: 'refresh_token',
      }));
      if (res.status === 400 || res.status === 401) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        if (body.error === 'invalid_grant' || res.status === 401) throw new GoogleGone();
        throw new GoogleError(res.status, body.error ?? 'bad_request');
      }
      if (!res.ok) throw new GoogleError(res.status, (await res.text()).slice(0, 200));
      return ((await res.json()) as { access_token: string }).access_token;
    },

    async calendars(accessToken) {
      const body = await get<{ items?: Array<{ id: string; summary?: string; summaryOverride?: string; backgroundColor?: string; primary?: boolean; selected?: boolean; hidden?: boolean }> }>(
        `${API}/users/me/calendarList?minAccessRole=reader&maxResults=50`, accessToken,
      );
      return (body.items ?? [])
        .filter((entry) => !entry.hidden)
        .map((entry) => ({
          id: entry.id,
          name: entry.summaryOverride ?? entry.summary ?? 'Calendar',
          color: entry.backgroundColor ?? null,
          primary: !!entry.primary,
          selected: !!entry.selected,
        }));
    },

    async events(accessToken, calendarId, from, to) {
      const query = new URLSearchParams({
        singleEvents: 'true', orderBy: 'startTime', timeMin: from, timeMax: to, maxResults: '250',
        fields: 'items(id,status,summary,start,end,location,recurringEventId,updated,eventType,attendees(self,responseStatus))',
      });
      const body = await get<{ items?: GoogleEvent[] }>(`${API}/calendars/${encodeURIComponent(calendarId)}/events?${query.toString()}`, accessToken);
      return body.items ?? [];
    },

    async revoke(token) {
      await fetcher(`${REVOKE_URL}?token=${encodeURIComponent(token)}`, { method: 'POST', signal: AbortSignal.timeout(10_000) }).catch(() => undefined);
    },
  };
}

/** The real Google when the keys are set; nothing to connect to otherwise. */
export function googleFromEnv(): GoogleCalendarClient | null {
  const id = process.env.GOOGLE_CLIENT_ID?.trim();
  const secret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  return id && secret ? googleCalendar(id, secret) : null;
}
