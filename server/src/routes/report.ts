/**
 * Errors from the app, reported by the app.
 *
 * A crash on a judge's phone is invisible from here unless the phone says so.
 * The app posts what broke - the message, where, and which build - and this
 * writes it to the function log, where Vercel keeps and searches it. Nothing is
 * stored in the database and nothing about the person is sent: an error report
 * should never be a second channel for anyone's week.
 *
 * Open to signed-out callers on purpose, because the sign-in screen can crash
 * too. That makes it the one route a stranger can reach, so it is small, capped
 * and throttled per address.
 */
import { Hono } from 'hono';
import { clientErrorSchema } from '../../../shared/contract.js';
import type { Env } from '../types.js';

const WINDOW_MS = 10 * 60_000;
const PER_WINDOW = 20;
const recent = new Map<string, number[]>();

/** A speed bump per address, in memory: enough for a crash loop, not a wall. */
export function allowReport(key: string, now = Date.now()): boolean {
  const kept = (recent.get(key) ?? []).filter((at) => now - at < WINDOW_MS);
  if (kept.length >= PER_WINDOW) {
    recent.set(key, kept);
    return false;
  }
  kept.push(now);
  recent.set(key, kept);
  return true;
}

export const report = new Hono<Env>();

report.post('/', async (c) => {
  const parsed = clientErrorSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'bad_request' }, 400);
  const who = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  if (!allowReport(who)) return c.json({ error: 'slow_down' }, 429);
  const { kind, message, stack, path, build } = parsed.data;
  if (process.env.NODE_ENV !== 'test') {
    console.error('[client]', JSON.stringify({ kind, message, path, build, stack, ua: c.req.header('user-agent')?.slice(0, 160) }));
  }
  return c.body(null, 204);
});
