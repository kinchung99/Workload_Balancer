/**
 * The Node entry point.
 *
 * Kept to almost nothing on purpose: everything that matters is in `createApp`,
 * so the same application runs here, in the test harness, and on a serverless
 * platform whose handler wants a `fetch` function rather than a listening port.
 */
import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { getDb } from './db/client.js';

const port = Number(process.env.PORT ?? 8787);
const app = createApp(await getDb());

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`  ballast api on http://localhost:${info.port}`);
});
