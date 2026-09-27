/**
 * Sync — push what changed, pull what changed, in one request.
 *
 * The client is the source of truth and always wins ties by being later. The
 * rules are deliberately the smallest set that behaves correctly offline:
 *
 *   1. **Last write wins, per row.** Two devices editing two different tasks
 *      never collide. The same task resolves to whichever was touched later,
 *      which is what a person expects and needs no interface to explain.
 *   2. **Deletes are tombstones.** A row that merely stopped being sent would be
 *      resurrected by the next device that still had it.
 *   3. **The cursor is server time, not client time.** A phone with a wrong clock
 *      would otherwise either miss changes forever or re-download everything.
 *
 * What is *not* here is as important. There is no endpoint that reads inside a
 * document, because the server has no business knowing what a student is
 * dreading. `data` goes in as `jsonb` and comes back unchanged.
 */
import { Hono } from 'hono';
import { and, eq, gt, sql } from 'drizzle-orm';
import { syncRequestSchema, type SyncDoc, type SyncResponse } from '../../../shared/contract';
import { documents } from '../db/schema';
import type { Env } from '../types';

/** One page. Big enough that a fortnight offline is one round trip. */
const PAGE = 500;

export const sync = new Hono<Env>();

sync.post('/', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');

  const parsed = syncRequestSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: 'bad_request', detail: parsed.error.issues[0]?.message }, 400);
  }
  const { since, changes } = parsed.data;

  /*
   * Push first, then pull, inside one statement each.
   *
   * Order matters: pushing first means the pull that follows already contains
   * this device's own writes, so a client that crashes between the two requests
   * it would otherwise need cannot end up with a cursor ahead of its own data.
   */
  if (changes.length) {
    const rows = changes.map((doc) => ({
      userId,
      collection: doc.collection,
      docId: doc.id,
      data: (doc.data ?? {}) as Record<string, unknown>,
      updatedAt: new Date(doc.updatedAt),
      deleted: doc.deleted,
    }));

    await db.insert(documents).values(rows).onConflictDoUpdate({
      target: [documents.userId, documents.collection, documents.docId],
      set: {
        data: sql`excluded.data`,
        updatedAt: sql`excluded.updated_at`,
        deleted: sql`excluded.deleted`,
      },
      // The conflict rule, in one line of SQL: an older write loses. Without it a
      // phone draining a stale queue would overwrite newer edits from elsewhere.
      setWhere: sql`${documents.updatedAt} < excluded.updated_at`,
    });
  }

  const cursor = since ? new Date(since) : new Date(0);
  const rows = await db
    .select()
    .from(documents)
    .where(and(eq(documents.userId, userId), gt(documents.updatedAt, cursor)))
    .orderBy(documents.updatedAt)
    .limit(PAGE + 1);

  const more = rows.length > PAGE;
  const page = more ? rows.slice(0, PAGE) : rows;

  const out: SyncDoc[] = page.map((row) => ({
    collection: row.collection as SyncDoc['collection'],
    id: row.docId,
    data: row.data,
    updatedAt: row.updatedAt.toISOString(),
    deleted: row.deleted,
  }));

  /*
   * When the page was capped, the cursor is the last row we actually sent - not
   * "now". Returning now would silently skip everything after the cap.
   */
  const now = more && page.length
    ? page[page.length - 1].updatedAt.toISOString()
    : new Date().toISOString();

  const body: SyncResponse = { now, changes: out, more };
  return c.json(body);
});

/**
 * Everything this account holds, in one file.
 *
 * Here because GDPR asks for it and because a tool that will not let you leave
 * is a tool you should not have joined. It is the same shape sync returns, so it
 * can be re-imported rather than merely read.
 */
sync.get('/export', async (c) => {
  const db = c.get('db');
  const rows = await db.select().from(documents).where(eq(documents.userId, c.get('userId')));
  return c.json({
    exportedAt: new Date().toISOString(),
    documents: rows.map((r) => ({
      collection: r.collection, id: r.docId, data: r.data,
      updatedAt: r.updatedAt.toISOString(), deleted: r.deleted,
    })),
  });
});
