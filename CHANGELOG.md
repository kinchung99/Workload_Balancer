# Changelog

All notable changes to Ballast. Dates are when the change went live.

## v1.0.0 · 2026-10-12 · Final submission

**Reliability and operations**
- Live monitoring: a GitHub Action every 30 minutes signs in like a judge and checks the API, database, app, demo, sync, friends and plans. A failure opens an issue, and the first green run closes it.
- Automatic deploys after checks pass (API → Vercel, app → Expo hosting), followed by the same live checks. Active once the `EXPO_TOKEN` and `VERCEL_TOKEN` repository secrets are set.
- Crash screen with "Try again", plus error reports from the app to the API's logs (`/api/report`, no personal data).
- `/health/db` checks that the database answers, separately from the cheap `/health`.
- The app renders fresh behind its loading screen instead of hydrating, so the console stays clean (no React #418), and nobody sees the sample week flash before their own.

**Accessibility**
- Lighthouse accessibility 100 on all 24 screens tested: page titles, AA contrast on muted text and green chips, 24-point tap targets, pinch zoom allowed (with iOS inputs at 16px so Safari doesn't jump).

**Plans with friends**
- Accepting an invite is reliable: an answer still on its way survives background refreshes, and a failed one rolls back with a message.
- Your week follows the plan: accepted plans appear on every device, move when the host moves them, and leave (with a notice) when called off.
- The host hears about answers, sees "Everyone's in" in the bell, and can **go ahead** once everyone has answered.
- Sync no longer echoes the server's rows back every few seconds.

**Product**
- "What to do first" ranks work and promises above your own routines.
- Judge accounts rebuilt around the current week, with shared free evenings so plan-together finds green blocks.
- 12-page judges' guide (PDF) and a project thumbnail.

## Build phases V1–V13 · 2026-09-27 → 2026-10-12
- V1–V4: from prototype to real accounts: Hono API on Vercel, Neon Postgres, Better Auth, local-first sync, friends, groups, plans.
- V5–V8: Google Calendar (read-only), Gemini for messages and advice, timetable with attendance and flags, owing work with booked sittings.
- V9–V13: iPhone sign-in (bearer tokens), password change, profile photos, installable web app, judge accounts, demo and preview links, planned days, plan-invite fixes.

## Prototype · 2026-09-03 → 2026-09-13
- The interactive prototype, pitch video and first README, submitted for the first round.
