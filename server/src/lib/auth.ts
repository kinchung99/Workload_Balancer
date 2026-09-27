/**
 * Accounts.
 *
 * Email and password, plus Google and Apple when the keys are present — Apple
 * because the App Store requires it beside any other social sign-in, Google
 * because it is the one every student already has.
 *
 * Sessions are database-backed cookies rather than JWTs. The reason is revocation:
 * a JWT is valid until it expires no matter what happens to the account, and this
 * app holds a graph of who may see whose battery. "Remove this person from my
 * circle" has to take effect on their next request, not in an hour.
 */
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { anonymous } from 'better-auth/plugins/anonymous';
import type { Database } from '../db/client';
import * as schema from '../db/schema';

/** HTTPS everywhere but a developer's laptop. */
const isProduction = (process.env.BASE_URL ?? '').startsWith('https://');

/**
 * Which origins may sign in.
 *
 * Strict in production: only the hosts named in `TRUSTED_ORIGINS`, because this
 * is what stops another site driving somebody's session.
 *
 * Permissive in development, and deliberately so. Metro picks whatever port is
 * free, Expo Go connects over a LAN address that changes with the network, and a
 * phone is never on `localhost`. Pinning one port there means sign-in fails with
 * `INVALID_ORIGIN` the first time the port moves — a 403 with no obvious cause,
 * from a config file nobody thinks to look at.
 */
const configured = (process.env.TRUSTED_ORIGINS ?? 'https://load-balancer-ballast.expo.app')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const origins = isProduction
  ? configured
  : [
    ...configured,
    // Any port on this machine, and any device on the local network.
    'http://localhost:*',
    'http://127.0.0.1:*',
    'http://10.*',
    'http://172.*',
    'http://192.168.*',
    // Expo Go on a device identifies itself with its own scheme.
    'exp://*',
  ];

export function makeAuth(db: Database) {
  const google = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? { google: { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET } }
    : {};
  const apple = process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET
    ? { apple: { clientId: process.env.APPLE_CLIENT_ID, clientSecret: process.env.APPLE_CLIENT_SECRET } }
    : {};

  return betterAuth({
    database: drizzleAdapter(db, { provider: 'pg', schema }),
    secret: process.env.AUTH_SECRET ?? 'dev-only-secret-change-me-in-production',
    baseURL: process.env.BASE_URL ?? 'http://localhost:8787',
    trustedOrigins: origins,
    emailAndPassword: {
      enabled: true,
      // Nobody verifies an email to try a planner. The address is a login, not a
      // channel - the app sends nothing, so an unverified one costs nothing.
      requireEmailVerification: false,
      minPasswordLength: 8,
    },
    socialProviders: { ...google, ...apple },

    /*
     * Guests.
     *
     * The friends half of this app is the half worth showing, and it is the half
     * that dies at a sign-up form: somebody with ninety seconds and a borrowed
     * phone will not invent a password to look at a demo. One tap makes a real
     * account with a real user id, a real circle and real sync - it simply has no
     * email yet, and can gain one later without losing anything.
     */
    plugins: [
      anonymous({
        emailDomainName: 'guest.ballast.app',
        /*
         * A name people can recognise in a circle.
         *
         * The default is a random id, which is unusable in the one place this
         * name appears - somebody else's friends list. Two words and a number is
         * memorable enough to tell two guests apart at a demo table.
         */
        generateName: () => {
          const first = ['Quiet', 'Sunny', 'Brave', 'Lucky', 'Calm', 'Swift', 'Kind', 'Bright'];
          const second = ['Otter', 'Finch', 'Maple', 'Comet', 'Heron', 'Willow', 'Pebble', 'Fox'];
          const pick = (list: string[]) => list[Math.floor(Math.random() * list.length)];
          return `${pick(first)} ${pick(second)}`;
        },
      }),
    ],
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
      // A student opens this daily; re-reading the session row every time is a
      // query per request for a value that changes once a day.
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    advanced: {
      /*
       * Cross-site in production, ordinary in development.
       *
       * The deployed app and API are on different hosts, so the session cookie
       * has to survive a cross-site request - which browsers only allow with
       * `SameSite=None; Secure`. But `Secure` means HTTPS, and a laptop running
       * `npm run dev` is on plain http: setting it there makes every browser
       * silently drop the cookie, and sign-in appears to succeed and then does
       * nothing. Which is exactly the failure that is hardest to diagnose.
       */
      defaultCookieAttributes: isProduction
        ? { sameSite: 'none', secure: true, httpOnly: true }
        : { sameSite: 'lax', secure: false, httpOnly: true },
    },
  });
}

export type Auth = ReturnType<typeof makeAuth>;
