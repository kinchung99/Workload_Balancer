# Ballast — full stack build

**Team abc** · CodeNection finalist · [live prototype](https://load-balancer-ballast.expo.app) · [pitch video](https://youtu.be/RLS0NMu7WtY)

What was a front end with a seeded semester is now a working product: accounts, sync
across devices, and the friends graph — the one feature that genuinely cannot run on a
single phone.

**Total running cost: $0/month.** Every service below has a permanent free tier, not a
trial. The section at the end says exactly where the ceilings are and what happens when
you hit them.

---

## 1. What I built

```
Load Balancer/
├── ballast/        Expo app — unchanged in how it works, now able to sign in and sync
├── server/         Hono API — accounts, sync, circle, sharing, invites
├── shared/         The wire contract. One file, imported by both, so they cannot drift
└── .github/        CI: both halves checked on every push
```

### The architectural decision that shapes everything

**The server never reads a student's week.**

Items, errands, moods, meals, modules, the lot — all stored as opaque `jsonb`
documents. The load model, the forecast, the swap, the planner and the ranking all run
on the phone and always will. That is not a stage on the way to a "real" backend; it is
the design, and it is why a student on a bus with no signal still gets every number in
the app.

Two things follow, and both are worth more than they cost:

- **Adding a field needs no migration.** `Item.want` was added late in the prototype
  phase. On this architecture that is a client-side change and nothing else.
- **A breach leaks less.** There is no column anywhere that holds what somebody is
  dreading, because the server was never told.

What *is* between people gets real columns, real indexes and real rules — because you
cannot compute your friend's battery on your own phone, and that half is where a bug
leaks somebody else's life.

| Half | Storage | Why |
|---|---|---|
| Your own week | one `documents` table, `jsonb` | The server never queries inside it |
| Presence, windows, friendships, invites | typed columns, indexed, constrained | The server must enforce who may read what |

### The account UI

Built in the shape people already know from Instagram, TikTok and RedNote, so
nobody has to learn it.

| Screen | Holds |
|---|---|
| **You** (tab) | Avatar, name, email, status, a stats row (battery · friends · sharing), Edit profile |
| **Edit profile** | Name, initials, **status line**, phone — with a live preview of your row *as friends see it* |
| **Settings** | Account · Privacy · Your week · Data, then sign out — grouped in the order every phone uses |
| **Account** | Sign in / create account, as a segmented control |
| **Friend profile** | Their avatar, name, status, stats, and their published week |

One component does the identity everywhere: a circle of initials with a **ring in
the person's band colour**. Your own profile, your friends' rows and their profile
pages all draw the same circle, so learning to read one teaches the whole app. The
ring greys out when a reading is stale, because a battery nobody has confirmed in
three days is not news.

The **status line** was the gap that mattered — friends' statuses were visible but
you could not write your own. It is now the one piece of free text anybody sees,
with suggestions, because a blank box stays blank.

### Two modes, and why both exist

Signing in does not decorate the demo — it **replaces** it.

| | Signed out | Signed in |
|---|---|---|
| Whose week | Amira's seeded semester | **yours, and it starts empty** |
| Today | `2025-11-10`, fixed | the real date |
| Friends | four seeded people | **whoever accepts your request** |
| Ceilings | Amira's, after ten weeks of calibration | generic defaults, which move as you report hard days |

Keeping Amira's week under a real person's name would be worse than useless: they would
add a task to somebody else's semester and the battery would read her load, not theirs.

Both modes are kept because the public link has to keep working. `npm run preflight`
asserts the seeded study down to the percentage, and that is what the judges opened.

### How changes are noticed

The obvious way to sync a store is to make every action report its own writes. There are
about thirty actions here and there will be more, and the failure mode is silent:
somebody adds an action in six months, forgets the reporting line, and that data quietly
never leaves the phone.

So the store is **photographed before and after**, and the difference is the change set.
One integration point, no per-action discipline, and an action written later is covered
the day it is written — asserted by *"an action that knows nothing about sync is still
caught"*.

### The API

| Route | Does |
|---|---|
| `POST /api/auth/*` | Sign up, sign in, sessions, OAuth — owned by Better Auth |
| `GET · POST /api/me` | Profile, initials, phone (for `wa.me` links), sharing level |
| `POST /api/sync` | Push changes and pull changes in one request |
| `GET /api/sync/export` | Everything this account holds, in one file — GDPR, and decency |
| `GET /api/circle` | Friends: band, charge, how old the reading is, published windows |
| `GET · POST /api/circle/request · /respond` | Ask, accept, decline, remove |
| `POST /api/sharing/presence` | Your battery, as your circle sees it |
| `POST /api/sharing/publish` | Republish free windows at your chosen visibility |
| `GET · POST · DELETE /api/invites` | Gatherings, and who said yes |

### Sync, in three rules

1. **Last write wins, per row.** Two phones editing two different tasks never collide.
   The same task resolves to whichever was touched later — what a person expects, and
   no interface has to explain it.
2. **Deletes are tombstones.** A row that merely stopped being sent would be
   resurrected by the next device that still had a copy.
3. **The cursor is server time.** A phone with a wrong clock would otherwise either
   miss changes forever or re-download everything.

The client queue is **keyed, not appended** — editing one task eleven times offline
leaves one row, not eleven. A queue that grows with every keystroke is a queue that
never drains on a bad connection.

---

## 2. The stack, and why each piece

| Layer | Choice | Why this one |
|---|---|---|
| **API framework** | **Hono 4** | Same shape as Express, a tenth of the size, and it runs unchanged on Node, Bun, Cloudflare Workers and Vercel. For a project with a $0 hosting budget, being able to move between free tiers without a rewrite is worth more than any single free tier. |
| **Database** | **Neon** (serverless Postgres) | Free tier is permanent, not a trial. Autosuspends when idle and resumes in about half a second — unlike Supabase's free tier, which *pauses* after a week of inactivity and needs a manual restore. For a project that gets demoed in bursts, that difference decides it. |
| **ORM** | **Drizzle** | SQL you can read, types you do not maintain by hand, and migrations that are plain `.sql` files reviewed like any other change. Lighter than Prisma and far better suited to serverless — no engine binary, no cold-start penalty. |
| **Auth** | **Better Auth** | Sessions live in *our* Postgres, so there is no per-user meter. Clerk is free to 10k monthly actives, Firebase to 50k — generous ceilings that still exist. This one has none, and the rows sit in a database already costing nothing. Email + password now; Google and Apple switch on with two env vars. |
| **Validation** | **Zod 4** | One schema, both sides of the wire. The server parses requests with it; the client builds requests from the same inferred types. |
| **Hosting (API)** | **Vercel** | Free hobby tier, zero-config for this shape, and the adapter is nine lines. |
| **App** | **Expo SDK 57 · React Native 0.86 · React 19** | Unchanged. One codebase for iOS, Android and web. |
| **CI** | **GitHub Actions** | Free on public repos. Both halves checked on every push. |
| **Errors** | **Sentry** | Free tier, 5k events/month. Wire it when you ship to real users; nothing depends on it. |

### Deliberately not used

| Not used | Why |
|---|---|
| **Prisma** | Query engine binary bloats serverless cold starts. Drizzle is closer to the SQL and generates migrations you can actually read. |
| **Supabase** | It is genuinely good and would have been one product instead of three. The free tier *pausing* after a week of inactivity is the problem — a judge opening the link a fortnight later would find it down. |
| **Firebase / Clerk** | Both have monthly-active-user ceilings. Better Auth has none because the rows are ours. |
| **Redis** | Nothing here needs a cache yet. A service you do not need is a service that can go down. |
| **Express** | Fine, but pinned to Node. Hono runs everywhere, which is the whole hosting strategy. |
| **tRPC** | Lovely for a monorepo, but it couples the client build to the server's types at the transport layer. A plain REST contract with shared Zod types gets most of the benefit and keeps the app buildable if the API is not. |

---

## 3. Proving it works

The app already refused to deploy unless four suites passed. The API now has its own,
in the same spirit.

| Check | What it proves | Count |
|---|---|---|
| `model:check` | The load maths matches the interface study | 20 figures |
| `behaviour:check` | Every button moves the state it claims to — now including sync and the real-account path | **485** |
| `render:check` | Every figure on every screen comes from the model | 339 strings · 29 pages · 27 exits |
| `tokens:check` | Design tokens consistent across the app | 90 tokens |
| **`api:check`** | **The API does what it says — against real Postgres** | **58** |

**`api:check` runs real SQL.** It uses **PGlite** — Postgres compiled to WebAssembly,
running in-process — and applies the actual generated migrations before the first test.
No Docker, no service, no mocks. Real constraints, real `jsonb`, real foreign keys, real
`ON CONFLICT`. Mocking a database is how you ship a schema that has never once been
executed.

A sample of what it asserts, because the interesting ones are the refusals:

```
ok    a stale write loses to a newer one
ok    a delete comes back as a tombstone, not an absence
ok    another account sees none of it
ok    you cannot accept your own request
ok    a friend row carries nothing but a reading and windows
ok    evenings-only drops the daytime window
ok    off publishes nothing at all
ok    and leaves no row behind to leak later
ok    you cannot invite someone outside your circle
ok    a guest cannot call off the host's gathering
ok    his new reading does not reach her either
```

That last one is the point of the whole friends model: removing someone stops their
battery reaching you **immediately**, not at the end of a cached session. It is also why
sessions are database-backed cookies rather than JWTs — a JWT stays valid until it
expires no matter what happens to the relationship behind it.

---

## 4. Costs — how this stays at $0

Every line is a permanent free tier. Nothing below is a trial or a credit.

| Service | Free tier | What we use | Headroom |
|---|---|---|---|
| **Neon** Postgres | 0.5 GB storage · 190 compute-hours/mo · autosuspend | A week of tasks is a few KB per student | **~10,000 students** before storage bites |
| **Vercel** | 100 GB bandwidth · 1M function calls/mo | Sync is small JSON, a few calls per student per day | **~3,000 daily actives** |
| **Better Auth** | Self-hosted — no meter exists | All accounts | **Unlimited** |
| **GitHub Actions** | 2,000 min/mo (unlimited on public repos) | ~3 min per push | Effectively unlimited |
| **Expo EAS** | 30 builds/mo, free tier | Release builds | Fine for a student team |
| **Expo Push** | Free, unlimited | Notifications, when we add them | Free at any scale |
| **Sentry** | 5k errors/mo | Crash reports | Fine until real traction |
| **Cloudflare** (DNS) | Free | A domain, if you buy one | ~$10/yr for the domain only |

**Total: $0/month.** The only money anyone might spend is a domain name.

### When it stops being free

Honest thresholds, so nobody is surprised:

| At roughly | What gives first | Cost to fix |
|---|---|---|
| **3,000 daily actives** | Vercel function calls | Move the API to Cloudflare Workers — free to 100k requests/day, and Hono runs there unchanged. **Still $0.** |
| **10,000 students** | Neon storage (0.5 GB) | Neon Launch tier — **$19/mo** for 10 GB |
| **Real users' data** | Sentry's 5k events | Stay on free; sample errors rather than pay |
| **Commercial use** | Vercel's hobby terms forbid it | Cloudflare Workers' free tier allows it. **Still $0.** |

The reason two of those rows say "still $0" is the Hono choice. The app is not tied to
Vercel — the same `createApp` runs on Node, Workers, Fly or a Raspberry Pi, and the
adapter is under ten lines each time.

---

## 5. Running it

**No cloud account, no database, no connection string.**

```bash
npm run setup          # once
npm run dev:api        # terminal 1 — starts on a local Postgres file
npm run dev:app        # terminal 2 — scan the QR with Expo Go
```

The API defaults to **PGlite writing to `.data/ballast`** — real Postgres, no
service. The app finds it automatically: `EXPO_PUBLIC_API_URL` if set, otherwise
the machine Metro is serving from on port 8787. Sign up on your phone, sign up as
someone else in a browser, add each other by email.

`.env` is only needed to point at a hosted database.

### Deploying — one link, no terminal, no app store

Two free accounts, once. After that the link works forever with nothing running
locally. **Push to GitHub first** — Vercel deploys from the repo.

**Step 1 — Database (Neon).** neon.tech → *Sign up with GitHub* → *Create
project*, name it `ballast` → on the dashboard copy the **Pooled connection**
string (it has `-pooler` in the hostname).

```bash
cd server
printf 'DATABASE_URL=%s\n' '<paste the pooled string>' > .env
printf 'AUTH_SECRET=%s\n' "$(openssl rand -base64 32)" >> .env
npx drizzle-kit push          # creates the tables — say yes to any prompt
```

**Step 2 — API (Vercel).** vercel.com → *Sign up with GitHub* → *Add New
Project* → import this repo → **leave every setting alone** → before deploying,
add three Environment Variables:

| Name | Value |
|---|---|
| `DATABASE_URL` | the same pooled string |
| `AUTH_SECRET` | the same generated secret |
| `BASE_URL` | `https://<the-url-vercel-shows-you>` |

`BASE_URL` is the one that matters: it flips session cookies into cross-site mode
and locks trusted origins down. If it is wrong, sign-in appears to work and then
silently does nothing. You will not know the URL until after the first deploy —
so deploy, copy the URL, set `BASE_URL`, and **redeploy once**.

Check it by opening the URL: it should answer with JSON, not a 404.

**Step 3 — App.** Already your account, already your URL.

```bash
cd ballast
npm run icons                                        # once
EXPO_PUBLIC_API_URL=https://<your-api>.vercel.app npm run deploy
```

**Step 4 — QR code.** Point any QR generator at
`https://load-balancer-ballast.expo.app`. Scan it, tap **Continue as guest**, and
every social feature works on that phone.

### Why not the app store

| Route | Friction | Cost |
|---|---|---|
| **Link + Add to Home Screen** | Scan a QR | **$0** |
| Expo Go QR | Install Expo Go first | $0 |
| Google Play | Download, security warning | $25 once |
| TestFlight | Apple account, email invites, review | $99/yr |

The manifest and icons are in `public/`, so **Add to Home Screen** gives a real
icon and a full-screen app with no address bar. Same build, no store, no review.

## 6. What I did not build, and why

Being straight about the edges, since scope realism is a marked criterion:

- **Push notifications.** Expo Push is free and the hook is obvious, but the app has no
  notification worth sending yet. One message eight days before a collision is the plan;
  shipping it before the scheduling is right would train people to ignore it.
- **Contact matching against the server.** The app matches on the phone, which is the
  honest version. Server-side matching against hashed numbers is a week's work and needs
  a privacy review, not an afternoon.
- **ICS timetable feed.** Paste already works and never breaks. The feed is a
  convenience on top, and every university publishes a slightly different one.
- **Realtime.** Friends' batteries refresh on open. A websocket for a number that
  changes a few times a day is a service to run for no benefit.

Each of those needs the data layer that now exists, which is the point of having built
this half first.

---

## 7. Changed in the existing app

- **Figma removed.** `figma/canvas.html`, `scripts/figma-canvas.mjs` and
  `src/design/figma.ts` are gone, along with the `figma:canvas` script. The token file
  moved to `src/design/tokens.json` — it is a W3C DTCG file that `tailwind.config.js`
  parses at build time and `tokens:check` verifies, so it is the build's source of truth
  rather than a design-tool artefact. All 90 tokens still verify.
- **`src/lib/api.ts`** — the only place the app talks to a server. Every call may fail;
  nothing is on the critical path of a screen.
- **`src/state/sync.ts`** — the local-first queue, with 15 new assertions.
- **`app/account.tsx`** — sign in, sign out, and an honest account screen.
- **`shared/contract.ts`** imported type-only, so **zod never enters the app bundle**.
