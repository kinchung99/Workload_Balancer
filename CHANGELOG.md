# Changelog

All notable changes to Ballast. Dates are when the change went live.

## v1.0.0 · 2026-10-12 · Final submission

**Reliability and operations**
- Live monitoring: a GitHub Action every 30 minutes signs in like a judge and checks the API, database, app, demo, sync, friends and plans. A failure opens an issue, and the first green run closes it.
- Automatic deploys after checks pass (API → Vercel, app → Expo hosting), followed by the same live checks. Active once the `EXPO_TOKEN` and `VERCEL_TOKEN` repository secrets are set.
- Crash screen with "Try again", plus error reports from the app to the API's logs (`/api/report`, no personal data).
- `/health/db` checks that the database answers, separately from the cheap `/health`.
- The app renders fresh behind its loading screen instead of hydrating, so the console stays clean (no React #418), and nobody sees the sample week flash before their own.
- Lighthouse best practices 100: sign-in from the app uses only its bearer token (no third-party cookies), and a first visit no longer asks for a session it cannot have (no 401).

**Accessibility**
- Lighthouse accessibility 100 on all 24 screens tested: page titles, AA contrast on muted text and green chips, 24-point tap targets, pinch zoom allowed (with iOS inputs at 16px so Safari doesn't jump), real tab lists, and spoken strength dots on the priority page.

**Documentation**
- README: status badges, "Built to be relied on", the architecture diagram, an updated developer guide and troubleshooting.
- `ballast/README.md` brought up to date: the live links and how they deploy, tech stack, architecture and data flow, screens, design system, accessibility, what is real, and verification.
- `README-idea.md` marked as the first-round submission.

**Plans with friends**
- Accepting an invite is reliable: an answer still on its way survives background refreshes, and a failed one rolls back with a message.
- Your week follows the plan: accepted plans appear on every device, move when the host moves them, and leave (with a notice) when called off.
- The host hears about answers, sees "Everyone's in" in the bell, and can **go ahead** once everyone has answered.
- Sync no longer echoes the server's rows back every few seconds.

**Product**
- "Can it move?" has four answers: 📌 Fixed (a set time that stays put), 🔒 Hard deadline, ↔️ Soft, 🙋 Self-imposed. Plans with friends are fixed; Google Calendar setup asks both questions.
- "Want to be there?" became **How important is it?**, four picture tiles from 🍃 Optional to 🔥 Must, asked of everything and changeable on the item.
- **What to do first** lists only owing work and tasks without a set time, sorted by the day each has to be **started** (walking back from the deadline through your real free time), so heavy work due later rises; importance decides within a day. Booked work shows its next sitting.
- **Could move** lists only movable blocks at a set time, least important first, each with reasons and a lighter nearby slot; *Move it* opens the picker preset to that slot.
- One way to pick a time everywhere (adding, moving, planning, booking rest, the marking sheet): this week and next with each day's load, or a calendar for any later date, plus the drag-along day slider.
- Moving something is visual: *Change the time* / *Give it a time* show each day of this week and next with its battery load, and a ribbon of the chosen day to drag the block along.
- **Swap this time** (`/swap/[id]`): *Move it* on a movable block opens three steps: pick what the time should go to from the sorted list (owing work gets its share, booked work brings its next sitting in), plan it, then re-home the block or drop it.
- The time slider shows three colours: fixed (grey), **could give up (amber)**, and free. Sliding onto amber takes its place, then asks where the displaced block goes; the same happens when booking sittings.
- **What to do first**, decluttered: keyword tags instead of sentences (why first, start day, hours, move reasons), ranks coloured by how soon they start, one needs-vs-free bar for the week, a one-line rest banner, and dashed amber cards for blocks that could move.
- **Cancel** on every task, the marking sheet and swaps, behind a second confirmation. Cancelled Google events stay out of the week; a cancelled plan is called off for friends, an accepted one is answered "Can't go".
- "What to do first" ranks work and promises above your own routines.
- Judge accounts rebuilt around the current week, with shared free evenings so plan-together finds green blocks.
- 12-page judges' guide (PDF) and a project thumbnail.

## Build phases V1–V13 · 2026-09-27 → 2026-10-12
- V1–V4: from prototype to real accounts: Hono API on Vercel, Neon Postgres, Better Auth, local-first sync, friends, groups, plans.
- V5–V8: Google Calendar (read-only), Gemini for messages and advice, timetable with attendance and flags, owing work with booked sittings.
- V9–V13: iPhone sign-in (bearer tokens), password change, profile photos, installable web app, judge accounts, demo and preview links, planned days, plan-invite fixes.

## Prototype · 2026-09-03 → 2026-09-13
- The interactive prototype, pitch video and first README, submitted for the first round.
