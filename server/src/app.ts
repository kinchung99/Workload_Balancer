/**
 * The API, assembled.
 *
 * Built as a factory rather than a module-level singleton so the test harness can
 * hand it a PGlite database and exercise the real routes — same middleware, same
 * auth, same SQL — without a server, a port, or Docker.
 *
 * Hono rather than Express: it is the same shape to write, a tenth of the size,
 * and it runs unchanged on Node, Bun, Cloudflare Workers and Vercel. That last
 * part is the one that matters for a project whose hosting budget is zero —
 * being able to move between free tiers without a rewrite is worth more than any
 * single free tier.
 */
import { Hono, type MiddlewareHandler } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { eq } from 'drizzle-orm';
import { initialsFrom, profileSchema, type MeDTO, type Visibility } from '../../shared/contract.js';
import { makeAuth, type Auth } from './lib/auth.js';
import { makeCode } from './lib/code.js';
import { profiles, user } from './db/schema.js';
import type { Database } from './db/client.js';
import type { Env } from './types.js';
import { circle } from './routes/circle.js';
import { groups } from './routes/groups.js';
import { invites } from './routes/invites.js';
import { sharing } from './routes/sharing.js';
import { sync } from './routes/sync.js';
import { composeRoutes, defaultWriter, suggestRoutes, type Writer } from './routes/compose.js';
import { calendarRoutes } from './routes/calendar.js';
import { googleFromEnv, type GoogleCalendarClient } from './lib/google.js';

export function createApp(
  db: Database,
  auth: Auth = makeAuth(db),
  /** Who writes messages. Null when no key is configured; the app then drafts on the phone. */
  writer: Writer | null = defaultWriter(),
  /** Google Calendar. Null when no Google keys are set; connecting is then not offered. */
  google: GoogleCalendarClient | null = googleFromEnv(),
) {
  const app = new Hono<Env>();

  if (process.env.NODE_ENV !== 'test') app.use('*', logger());

  /*
   * Credentials must be allowed and the origin echoed rather than starred: the
   * session is a cookie, and browsers refuse to send one to `*`.
   */
  app.use('*', cors({
    origin: (origin) => origin ?? '*',
    credentials: true,
    allowHeaders: ['Content-Type', 'Authorization'],
    // The session token comes back in this header; a browser only lets the app read it if it is listed.
    exposeHeaders: ['set-auth-token'],
    allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  }));

  app.use('*', async (c, next) => {
    c.set('db', db);
    c.set('auth', auth);
    await next();
  });

  /** Liveness. Cheap on purpose - a health check that queries is a health check that pages you at 3am. */
  app.get('/health', (c) => c.json({ ok: true, at: new Date().toISOString() }));

  /*
   * Somebody opened the API in a browser.
   *
   * Almost always the person who just deployed it, checking it worked. A bare
   * 404 there reads as a broken deploy; this says what the thing is and where
   * the app actually lives.
   */
  app.get('/', (c) => c.json({
    service: 'ballast-api',
    ok: true,
    app: 'https://load-balancer-ballast.expo.app',
    health: '/health',
  }));

  // Better Auth owns everything under /api/auth: sign-up, sign-in, sessions, OAuth.
  app.on(['GET', 'POST'], '/api/auth/*', (c) => auth.handler(c.req.raw));

  /**
   * The gate.
   *
   * One place decides who you are, and it re-reads the session rather than
   * trusting anything the client sent. Handlers past this point can rely on
   * `userId` being real, which is why none of them null-check it.
   */
  const requireUser: MiddlewareHandler<Env> = async (c, next) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session?.user?.id) return c.json({ error: 'unauthorised' }, 401);
    c.set('userId', session.user.id);
    await next();
  };

  app.use('/api/me', requireUser);
  app.use('/api/sync/*', requireUser);
  app.use('/api/circle/*', requireUser);
  app.use('/api/groups', requireUser);
  app.use('/api/groups/*', requireUser);
  app.use('/api/sharing/*', requireUser);
  app.use('/api/invites/*', requireUser);
  app.use('/api/compose/*', requireUser);
  app.use('/api/suggest/*', requireUser);
  app.use('/api/calendar', requireUser);
  // Google's way back in carries signed state instead of a session.
  app.use('/api/calendar/*', (c, next) => (c.req.path === '/api/calendar/callback' ? next() : requireUser(c, next)));

  /**
   * Who am I, and what am I sharing.
   *
   * Also the moment a profile row first appears. Creating it lazily here rather
   * than in a sign-up hook means an account made through any provider - email,
   * Google, Apple, or a future one - gets a profile without that code path
   * having to remember to make one.
   */
  app.get('/api/me', async (c) => {
    const id = c.get('userId');
    const [row] = await c.get('db')
      .select({
        id: user.id, email: user.email, name: user.name, isAnonymous: user.isAnonymous,
        initials: profiles.initials, phone: profiles.phone,
        visibility: profiles.visibility, code: profiles.code,
      })
      .from(user).leftJoin(profiles, eq(profiles.userId, user.id))
      .where(eq(user.id, id)).limit(1);

    if (!row) return c.json({ error: 'not_found' }, 404);

    /*
     * The profile, and the friend code, are made here on first sight.
     *
     * Lazily rather than in a sign-up hook, so an account created through any
     * provider - email, Google, Apple, or a guest tap - gets one without that
     * code path having to remember.
     */
    let code = row.code;
    if (code === null) {
      code = makeCode();
      await c.get('db').insert(profiles)
        .values({ userId: id, initials: initialsFrom(row.name), code })
        .onConflictDoNothing();
      // Another request may have won the race and written a different code.
      const [fresh] = await c.get('db')
        .select({ code: profiles.code }).from(profiles).where(eq(profiles.userId, id)).limit(1);
      code = fresh?.code ?? code;
    }

    const me: MeDTO = {
      id: row.id, email: row.email, name: row.name,
      initials: row.initials ?? initialsFrom(row.name),
      phone: row.phone ?? null,
      visibility: (row.visibility ?? 'evenings') as Visibility,
      code,
      isGuest: row.isAnonymous ?? false,
    };
    return c.json(me);
  });

  app.post('/api/me', async (c) => {
    const id = c.get('userId');
    const parsed = profileSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'bad_request' }, 400);
    const { name, initials, phone } = parsed.data;

    if (name) await c.get('db').update(user).set({ name }).where(eq(user.id, id));

    const patch = {
      ...(initials !== undefined ? { initials } : name ? { initials: initialsFrom(name) } : {}),
      ...(phone !== undefined ? { phone } : {}),
    };
    if (Object.keys(patch).length) {
      await c.get('db').insert(profiles)
        .values({ userId: id, initials: patch.initials ?? '?', phone: patch.phone ?? null, code: makeCode() })
        .onConflictDoUpdate({ target: profiles.userId, set: patch });
    }

    return c.json({ ok: true });
  });

  app.route('/api/sync', sync);
  app.route('/api/circle', circle);
  app.route('/api/groups', groups);
  app.route('/api/sharing', sharing);
  app.route('/api/invites', invites);
  app.route('/api/compose', composeRoutes(writer));
  app.route('/api/suggest', suggestRoutes(writer));
  app.route('/api/calendar', calendarRoutes(google));

  app.notFound((c) => c.json({ error: 'not_found' }, 404));
  app.onError((err, c) => {
    console.error('[api]', err);
    return c.json({ error: 'server_error' }, 500);
  });

  return app;
}
