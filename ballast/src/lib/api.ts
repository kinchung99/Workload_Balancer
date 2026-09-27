/**
 * The one place this app talks to a server.
 *
 * Everything else in `lib/` is pure: the load model, the forecast, the swap, the
 * planner and the ranking all run on the phone and always will. That is not a
 * stage we are passing through on the way to a "real" backend — it is the design.
 * A student on a bus with no signal still gets every number in this app.
 *
 * So this module is deliberately small, and every call through it is allowed to
 * fail. `ok` is false and the app carries on; the sync queue keeps the write and
 * drains it later. Nothing here is ever on the critical path of a screen.
 */
import Constants from 'expo-constants';
import type {
  CircleMemberDTO, InviteDTO, InviteRequest, MeDTO, PendingRequestDTO,
  Presence, PublishRequest, SyncDoc, SyncResponse, Visibility,
} from '@shared/contract';

/**
 * Where the API lives.
 *
 * Three answers, in order.
 *
 * 1. **`EXPO_PUBLIC_API_URL`**, when set. This is what a real build uses, and it
 *    is how the deployed app points at the deployed API.
 * 2. **The machine running Metro, port 8787**, in development. `localhost` is
 *    wrong on a phone — it means the phone — so the LAN address is taken from the
 *    dev server Expo Go already connected to. Start the API, scan the QR, and the
 *    two find each other with nothing configured.
 * 3. **Nothing.** The app then runs exactly as it did before any of this existed,
 *    which is what keeps the public prototype link working forever.
 */
/** Where `npm run dev` puts the API. Matches the server's default. */
const DEV_PORT = 8787;

/*
 * Resolved per call, not once at import.
 *
 * On web the first render happens on the server, where there is no dev host yet
 * — freezing the answer then would leave the browser permanently convinced there
 * is no API, which is exactly the "still says on this device" trap.
 */
export function apiUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (configured) return configured;
  if (!__DEV__) return '';

  // `hostUri` is "192.168.1.5:8081" — the machine a phone in Expo Go is already
  // talking to. It is the right answer on a device and absent on web.
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  if (host) return `http://${host}:${DEV_PORT}`;

  // On web the browser already knows which machine served the page.
  if (typeof window !== 'undefined' && window.location?.hostname) {
    return `${window.location.protocol}//${window.location.hostname}:${DEV_PORT}`;
  }
  return '';
}

export const hasServer = (): boolean => apiUrl().length > 0;

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number };

const failure = (error: string, status = 0): Result<never> => ({ ok: false, error, status });

/**
 * One fetch, with the two things every call needs: the session cookie and a
 * timeout.
 *
 * The timeout matters more than it looks. Without one, a phone on a captive
 * portal hangs the sync queue forever rather than failing and retrying, and the
 * app looks broken while being perfectly fine offline.
 */
async function request<T>(path: string, init: RequestInit = {}, timeoutMs = 12_000): Promise<Result<T>> {
  const base = apiUrl();
  if (!base) return failure('no_server');

  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}${path}`, {
      ...init,
      signal: abort.signal,
      // Sessions are cookies, so every request has to carry them.
      credentials: 'include',
      headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string };
      return failure(body.error ?? `http_${res.status}`, res.status);
    }
    return { ok: true, data: (await res.json()) as T };
  } catch (err) {
    // An abort and a dead network are the same thing to a caller: try later.
    return failure(err instanceof Error && err.name === 'AbortError' ? 'timeout' : 'offline');
  } finally {
    clearTimeout(timer);
  }
}

const post = <T>(path: string, body: unknown) =>
  request<T>(path, { method: 'POST', body: JSON.stringify(body) });

/* -------------------------------------------------------------------- auth */

export const api = {
  health: () => request<{ ok: boolean }>('/health'),

  signUp: (name: string, email: string, password: string) =>
    post<{ user: { id: string } }>('/api/auth/sign-up/email', { name, email, password }),

  signIn: (email: string, password: string) =>
    post<{ user: { id: string } }>('/api/auth/sign-in/email', { email, password }),

  /**
   * One tap, a real account, no form.
   *
   * The friends half of this app is the half worth showing and the half that
   * dies at a sign-up form. A guest gets a real user id, a real circle and real
   * sync — it simply has no email yet.
   */
  signInGuest: () => post<{ user: { id: string } }>('/api/auth/sign-in/anonymous', {}),

  /** Give a guest account an email and password, keeping everything in it. */
  keepAccount: (email: string, password: string, name: string) =>
    post<{ status: boolean }>('/api/auth/sign-up/email', { email, password, name }),

  signOut: () => post<{ success: boolean }>('/api/auth/sign-out', {}),

  me: () => request<MeDTO>('/api/me'),

  updateMe: (patch: { name?: string; initials?: string; phone?: string | null }) =>
    post<{ ok: true }>('/api/me', patch),

  /* ------------------------------------------------------------------ sync */

  sync: (since: string | null, changes: SyncDoc[]) =>
    post<SyncResponse>('/api/sync', { since, changes }),

  exportAll: () => request<{ exportedAt: string; documents: SyncDoc[] }>('/api/sync/export'),

  /* ---------------------------------------------------------------- circle */

  circle: () => request<{ circle: CircleMemberDTO[] }>('/api/circle'),
  requests: () => request<{ requests: PendingRequestDTO[] }>('/api/circle/requests'),
  addFriend: (handle: { email?: string; code?: string }) => post<{ sent: true }>('/api/circle/request', handle),
  respondToFriend: (userId: string, action: 'accept' | 'decline' | 'remove') =>
    post<{ ok: true }>('/api/circle/respond', { userId, action }),

  /* --------------------------------------------------------------- sharing */

  publishPresence: (presence: Presence) => post<{ ok: true }>('/api/sharing/presence', presence),
  publishWindows: (body: PublishRequest) => post<{ ok: true; published: number }>('/api/sharing/publish', body),

  /* --------------------------------------------------------------- invites */

  invites: () => request<{ invites: InviteDTO[] }>('/api/invites'),
  invite: (body: InviteRequest) => post<{ ok: true; id: string }>('/api/invites', body),
  replyToInvite: (inviteId: string, response: 'yes' | 'no') =>
    post<{ ok: true }>('/api/invites/respond', { inviteId, response }),
  cancelInvite: (id: string) => request<{ ok: true }>(`/api/invites/${id}`, { method: 'DELETE' }),
};

export type { CircleMemberDTO, InviteDTO, MeDTO, PendingRequestDTO, Visibility };
