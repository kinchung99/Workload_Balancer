/**
 * The Vercel entry point.
 *
 * At the repo root and called `api/` because that is the one layout Vercel needs
 * no configuration to understand: any `.ts` file here becomes a serverless
 * function. `createApp` is shared with `server/src/index.ts` (a real Node
 * server) and with the test harness (PGlite, in-process) — one application,
 * three ways in.
 *
 * **This exports a Node-style `(req, res)` handler on purpose.** Vercel's Node
 * runtime supports both that and a Web `Request => Response` function, and it
 * decides which one you meant by inspecting the export. Guessing wrong is not a
 * clean error: the runtime hands you `(req, res)`, a Web-style handler ignores
 * them, nothing is ever written to the response, and the request hangs until the
 * platform kills it — `FUNCTION_INVOCATION_TIMEOUT`, with no stack trace and
 * nothing in the logs. `getRequestListener` removes the ambiguity by being
 * unmistakably a Node listener.
 *
 * **Every path reaches here**, via a single `/(.*)` rewrite in `vercel.json`.
 * Vercel checks the filesystem before applying rewrites, so `public/` still
 * serves, and rewrites are not recursive, so there is no loop to guard against.
 * An earlier `(?!api/)` guard against that imaginary loop excluded every route
 * under `/api` — the whole API — and Vercel answered those with its own 404
 * before this function ever ran. `check-api.ts` asserts the routing now, because
 * no other test could see it.
 *
 * That config file takes no comments: Vercel validates it against a schema and
 * rejects unknown keys, including a `"//"` note. Which is why this is here.
 */
import { getRequestListener } from '@hono/node-server';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Hono } from 'hono';
import { createApp } from '../server/src/app.js';
import { ConfigError, getDb } from '../server/src/db/client.js';

export const config = { runtime: 'nodejs' };

/*
 * Built on the first request, then reused.
 *
 * Lazily rather than at module load: a warm instance serves many requests, so
 * reconnecting per request is most of the latency people blame on cold starts —
 * but building at import time would also mean a briefly unreachable database
 * takes the whole function down at boot rather than failing one request.
 */
let building: Promise<Hono> | null = null;

const getApp = (): Promise<Hono> => {
  building ??= (async () => {
    /*
     * Refuse to run in production on the development signing key.
     *
     * Sessions are signed with it, so a known secret means anybody can forge
     * one. The one misconfiguration worth refusing to start over.
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

/** A readable answer for the two ways a first deployment usually fails. */
function explain(err: unknown): { status: number; body: Record<string, string> } {
  const config = err instanceof ConfigError;
  if (!config) console.error('[api] startup failed', err);

  return {
    status: config ? 503 : 500,
    body: {
      error: config ? 'not_configured' : 'server_error',
      detail: config ? (err as Error).message : 'The API failed to start.',
      fix: config
        ? 'Set DATABASE_URL, AUTH_SECRET and BASE_URL in your Vercel project settings, then redeploy.'
        : 'Check the function logs in the Vercel dashboard.',
    },
  };
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const app = await getApp();
    getRequestListener(app.fetch)(req, res);
  } catch (err) {
    // Let a corrected environment variable take effect without a redeploy.
    building = null;
    const { status, body } = explain(err);
    res.statusCode = status;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(body));
  }
}
