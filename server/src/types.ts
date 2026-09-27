/** What every handler can reach for, put there by the middleware in app.ts. */
import type { Database } from './db/client.ts';
import type { Auth } from './lib/auth.ts';

export interface Env {
  Variables: {
    db: Database;
    auth: Auth;
    /** Set only on routes behind `requireUser`, so handlers never null-check it. */
    userId: string;
  };
}
