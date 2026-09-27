/**
 * Config for `drizzle-kit generate` and `drizzle-kit push`.
 *
 * Loads `.env` itself, because drizzle-kit runs as its own process and does not
 * inherit whatever the server loaded. Without this, `db:push` reads an empty
 * URL and hangs trying to resolve the example hostname.
 *
 * You only need this for a *hosted* database. The local file database sets
 * itself up on first boot - see src/db/client.ts.
 */
import { existsSync } from 'node:fs';
import type { Config } from 'drizzle-kit';

if (existsSync('.env')) {
  try { process.loadEnvFile('.env'); } catch { /* optional, and every value has a default */ }
}

const url = process.env.DATABASE_URL?.trim() ?? '';

/*
 * Only the commands that actually connect need a URL.
 *
 * `generate` writes SQL from the schema and touches no database - failing it for
 * a missing URL would mean you could not produce a migration without first
 * signing up for a host, which is backwards.
 */
const needsConnection = process.argv.some((a) => a === 'push' || a === 'studio' || a === 'migrate');
if (needsConnection && (!url || url.includes('ep-xxx') || url.includes('user:pass@'))) {
  console.error('\n  DATABASE_URL is missing or still the example.');
  console.error('  You only need it for a hosted database — `npm run dev` works without one.\n');
  process.exit(1);
}

export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url },
  verbose: true,
  strict: true,
} satisfies Config;
