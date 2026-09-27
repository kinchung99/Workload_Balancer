/**
 * The Vercel entry point.
 *
 * At the repo root and called `api/` because that is the one layout Vercel needs
 * no configuration to understand: any `.ts` file in here becomes a serverless
 * function automatically. No root-directory setting, no build command, no
 * functions block — which matters when the person deploying it is doing this for
 * the first time and every extra setting is somewhere to make a typo.
 *
 * `createApp` is shared with `server/src/index.ts` (a real Node server) and with
 * the test harness (PGlite, in-process). One application, three ways in.
 */
import type { Hono } from 'hono';
import { createApp } from '../server/src/app.js';
import { ConfigError, getDb } from '../server/src/db/client.js';

export const config = { runtime: 'nodejs' };

/*
 * Built on the first request, then reused.
 *
 * Lazily rather than at module load for two reasons. A warm instance serves many
 * requests, so reconnecting per request is most of the latency people blame on
 * cold starts — but building at import time would also mean a database that is
 * briefly unreachable takes the whole function down at boot rather than failing
 * one request. The promise is cached, so concurrent first requests share it.
 */
let building: Promise<Hono> | null = null;

const getApp = (): Promise<Hono> => {
  building ??= (async () => {
    /*
     * Refuse to run in production on the development signing key.
     *
     * Sessions are signed with it, so a known secret means anybody can forge
     * one. This is the one misconfiguration worth refusing to start over rather
     * than warning about, and it is cheap to check.
     */
    const secret = process.env.AUTH_SECRET?.trim();
    if (!secret || secret.length < 16) {
      throw new ConfigError('AUTH_SECRET is missing or too short (needs 16+ characters).');
    }
    const db = await getDb();
    return createApp(db) as unknown as Hono;
  })();
  return building;
};

export default async function handler(request: Request): Promise<Response> {
  try {
    const app = await getApp();
    return app.fetch(request);
  } catch (err) {
    /*
     * Answer, rather than crash.
     *
     * A thrown error here becomes `FUNCTION_INVOCATION_FAILED` and an opaque id,
     * which tells the person who just deployed this precisely nothing. A
     * configuration problem is the overwhelmingly likely cause of a first
     * failure, so it is worth spending a response body on saying which one.
     */
    building = null;   // so a fixed variable takes effect without a redeploy
    const config = err instanceof ConfigError;
    if (!config) console.error('[api] startup failed', err);

    return Response.json({
      error: config ? 'not_configured' : 'server_error',
      detail: config ? (err as Error).message : 'The API failed to start.',
      fix: config
        ? 'Set DATABASE_URL, AUTH_SECRET and BASE_URL in your Vercel project settings, then redeploy.'
        : 'Check the function logs in the Vercel dashboard.',
      docs: 'https://github.com/kinchung99/Workload_Balancer#deploying',
    }, { status: config ? 503 : 500 });
  }
}
