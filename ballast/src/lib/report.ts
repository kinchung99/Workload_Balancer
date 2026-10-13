/**
 * Telling the server something broke.
 *
 * Fire and forget: a report that fails is dropped, never retried, and never
 * shown - the person already has a problem, and this must not add one. Only the
 * message, the page and the build go; never anything from their week. A few
 * per page load at most, and each distinct message once.
 */
import type { ClientError } from '@shared/contract';
import { apiUrl } from './api';

const MAX_PER_LOAD = 5;
const sent = new Set<string>();

/** Which deploy this is, so a report says where it came from. */
const BUILD = process.env.EXPO_PUBLIC_DEMO === '1' ? 'demo' : process.env.EXPO_PUBLIC_GUEST === '1' ? 'preview' : 'prod';

/** Noise browsers raise that is not a bug in the app. */
const IGNORED = [/ResizeObserver loop/, /^Script error\.?$/, /Load failed/, /Failed to fetch/, /NetworkError/, /AbortError/];

export function reportError(kind: ClientError['kind'], error: unknown): void {
  const base = apiUrl();
  if (!base || typeof fetch !== 'function') return;
  const message = (error instanceof Error ? `${error.name}: ${error.message}` : String(error)).slice(0, 500);
  if (!message.trim() || IGNORED.some((pattern) => pattern.test(message))) return;
  if (sent.has(message) || sent.size >= MAX_PER_LOAD) return;
  sent.add(message);
  const body: ClientError = {
    kind,
    message,
    ...(error instanceof Error && error.stack ? { stack: error.stack.slice(0, 4000) } : {}),
    ...(typeof location !== 'undefined' ? { path: location.pathname.slice(0, 200) } : {}),
    build: BUILD,
  };
  void fetch(`${base}/api/report`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), keepalive: true })
    .catch(() => undefined);
}

/** On the web, anything that escapes every handler is reported too. Installed once. */
let listening = false;
export function reportUncaught(): void {
  if (listening || typeof window === 'undefined' || !window.addEventListener) return;
  listening = true;
  window.addEventListener('error', (event) => reportError('error', event.error ?? event.message));
  window.addEventListener('unhandledrejection', (event) => reportError('rejection', event.reason));
}
