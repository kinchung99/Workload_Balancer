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
import { createApp } from '../server/src/app.ts';
import { getDb } from '../server/src/db/client.ts';

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
  building ??= getDb().then((db) => createApp(db) as unknown as Hono);
  return building;
};

export default async function handler(request: Request): Promise<Response> {
  const app = await getApp();
  return app.fetch(request);
}
