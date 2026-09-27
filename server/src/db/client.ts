/**
 * One database handle, three ways to get one — and the default needs nothing.
 *
 * **No `DATABASE_URL` at all → a local Postgres file.** PGlite is real Postgres
 * compiled to WebAssembly, running inside this process and writing to
 * `.data/ballast`. No Docker, no service, no cloud account, no connection string.
 * `npm run dev` works on a laptop that has never heard of Neon, and real sign-ups
 * and real friendships work immediately. This is the default on purpose: needing
 * a cloud account before you can see your own app work is a terrible first hour.
 *
 * **A `neon.tech` URL → Neon over HTTP.** Which matters more than it sounds: a
 * serverless function that opens a TCP pool per invocation exhausts Postgres
 * connections long before anything else, and Neon's driver speaks HTTP so there
 * is no pool to exhaust.
 *
 * **Any other URL → plain `postgres` over TCP.** A local server, a Docker
 * container, a Neon branch, whatever you point it at.
 *
 * The schema is identical in all three. The tests use the fourth entry point —
 * an in-memory PGlite — so what CI runs is the same SQL that runs in production.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import * as schema from './schema';

export type Database = ReturnType<typeof drizzlePostgres<typeof schema>>;

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

let cached: Database | null = null;

/** Somewhere with no writable disk: Vercel, Lambda, Cloudflare and friends. */
const isServerless = (): boolean =>
  Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY);

/**
 * A misconfiguration rather than a bug.
 *
 * Carried as its own type so the handler can answer with something a person can
 * act on instead of a stack trace - the difference between "check your
 * environment variables" and forty minutes of guessing.
 */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

/**
 * Read `.env` if there is one, using Node's own loader.
 *
 * No `dotenv` dependency: Node has done this natively since 20.12, and one fewer
 * package in a server that handles sessions is worth having. Silent when the file
 * is absent, because the whole point is that it is optional.
 */
function loadEnv(): void {
  const file = join(root, '.env');
  if (!existsSync(file)) return;
  try {
    process.loadEnvFile(file);
  } catch {
    // Older Node, or a malformed file. Neither is worth crashing over: every
    // value has a working default.
  }
}

/**
 * Create the tables if they are not there yet.
 *
 * Only ever runs against the local file database. A hosted database gets its
 * schema from `drizzle-kit push` or a migration step in CI, where a human can see
 * what is about to change — a server that silently alters production on boot is
 * a server that will one day silently alter production on boot.
 */
async function migrateLocal(client: { exec: (sql: string) => Promise<unknown> }): Promise<void> {
  const dir = join(root, 'drizzle');
  if (!existsSync(dir)) throw new Error('No migrations found. Run `npm run db:generate`.');

  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    for (const statement of readFileSync(join(dir, file), 'utf8').split('--> statement-breakpoint')) {
      const trimmed = statement.trim();
      if (!trimmed) continue;
      try {
        await client.exec(trimmed);
      } catch (err) {
        // Re-running migrations on an existing file is normal and expected;
        // anything else is worth seeing.
        const message = err instanceof Error ? err.message : String(err);
        if (!/already exists/i.test(message)) throw err;
      }
    }
  }
}

/** The handle for the running server. Cached: a warm instance serves many requests. */
export async function getDb(): Promise<Database> {
  if (cached) return cached;
  loadEnv();

  const url = process.env.DATABASE_URL?.trim();

  // A URL left as the example placeholder is the same as no URL, and saying so
  // beats hanging for two minutes trying to resolve `ep-xxx`.
  const placeholder = !url || url.includes('ep-xxx') || url.includes('user:pass@');

  if (placeholder) {
    /*
     * A serverless function has no writable disk and no business inventing a
     * database. Without this the local-file fallback tries to `mkdir` on a
     * read-only filesystem and the platform reports `FUNCTION_INVOCATION_FAILED`
     * - which says nothing at all about the actual problem, and is the single
     * most confusing way a first deploy can fail.
     */
    if (isServerless()) {
      throw new ConfigError(
        url
          ? 'DATABASE_URL is still the example value from .env.example.'
          : 'DATABASE_URL is not set on this deployment.',
      );
    }

    const dir = join(root, '.data');
    mkdirSync(dir, { recursive: true });
    const { PGlite } = await import('@electric-sql/pglite');
    const { drizzle } = await import('drizzle-orm/pglite');
    const client = new PGlite(join(dir, 'ballast'));
    await migrateLocal(client);
    console.log('  database: local file (.data/ballast) — no cloud account needed');
    cached = drizzle(client, { schema }) as unknown as Database;
    return cached;
  }

  if (url.includes('neon.tech')) {
    const { neon } = await import('@neondatabase/serverless');
    console.log('  database: neon');
    cached = drizzleNeon(neon(url), { schema }) as unknown as Database;
    return cached;
  }

  const { default: postgres } = await import('postgres');
  console.log('  database: postgres');
  // One connection: a single Node process does not need more, and a small
  // ceiling is what keeps a free-tier database alive.
  cached = drizzlePostgres(postgres(url, { max: 1 }), { schema });
  return cached;
}

/** Only for tests, which build their own handle and hand it in. */
export function setDb(db: Database): void {
  cached = db;
}

export { schema };
