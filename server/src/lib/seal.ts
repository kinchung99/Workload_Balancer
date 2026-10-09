/**
 * Two small pieces of cryptography, both keyed from AUTH_SECRET.
 *
 * **Sealing** keeps a Google refresh token unreadable at rest: AES-256-GCM with
 * a fresh nonce each time, so the database (or a backup of it) never holds a
 * token that works on its own.
 *
 * **Signed state** carries who started a Google connection across the round
 * trip to Google and back. The callback cannot rely on a session cookie - the
 * app and the API are on different sites, and browsers increasingly drop
 * cross-site cookies - so the state itself says who, where to return, and until
 * when, with an HMAC nobody else can forge.
 */
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const secret = (): string => process.env.AUTH_SECRET ?? 'dev-only-secret-change-me-in-production';
const keyFor = (purpose: string): Buffer => createHash('sha256').update(`${secret()}:${purpose}`).digest();
const b64u = (buf: Buffer): string => buf.toString('base64url');

export function seal(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyFor('calendar-token'), iv);
  const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return `v1.${b64u(iv)}.${b64u(cipher.getAuthTag())}.${b64u(body)}`;
}

/** The plain text, or null when it was not sealed with this secret. */
export function unseal(sealed: string): string | null {
  const [version, iv, tag, body] = sealed.split('.');
  if (version !== 'v1' || !iv || !tag || !body) return null;
  try {
    const decipher = createDecipheriv('aes-256-gcm', keyFor('calendar-token'), Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(body, 'base64url')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

/** A tamper-proof, expiring note: `payload.signature`. */
export function signState(data: Record<string, unknown>, ttlMs: number, now = Date.now()): string {
  const payload = b64u(Buffer.from(JSON.stringify({ ...data, exp: now + ttlMs, n: b64u(randomBytes(8)) })));
  const signature = b64u(createHmac('sha256', keyFor('calendar-state')).update(payload).digest());
  return `${payload}.${signature}`;
}

/** What the note said, or null if it was altered, forged or has expired. */
export function readState<T extends Record<string, unknown>>(state: string, now = Date.now()): T | null {
  const [payload, signature] = state.split('.');
  if (!payload || !signature) return null;
  const expected = createHmac('sha256', keyFor('calendar-state')).update(payload).digest();
  const given = Buffer.from(signature, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as T & { exp?: number };
    if (typeof data.exp !== 'number' || data.exp < now) return null;
    return data;
  } catch {
    return null;
  }
}
