/**
 * The Vercel entry point.
 *
 * Vercel wants a module that default-exports a request handler rather than a
 * process that listens on a port, so this is the whole adapter: build the app
 * once per warm instance and hand Vercel its `fetch`.
 *
 * `createApp` is shared with `src/index.ts` (a real Node server) and with
 * `scripts/check-api.ts` (PGlite, in-process). One application, three ways in —
 * which is what makes moving off a free tier a config change rather than a
 * rewrite. If Vercel's hobby terms ever stop suiting the project, the same code
 * runs on Cloudflare Workers or a $0 Fly machine.
 */
import { handle } from 'hono/vercel';
import { createApp } from '../src/app.ts';
import { getDb } from '../src/db/client.ts';

export const config = { runtime: 'nodejs' };

/*
 * Built at module scope on purpose.
 *
 * A warm instance serves many requests, and rebuilding the router and
 * reconnecting the database per request is most of the latency people blame on
 * cold starts.
 */
const app = createApp(await getDb());

export default handle(app);
