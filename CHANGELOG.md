# Changelog

All notable changes to Ballast. Dates are when the change went live.

## v1.1.0 · 2026-10-31 · Final deployment

**Fixes**
- Nothing is lost to a reload or a closed tab: edits not yet sent are kept on the device for each account and go first on the next open, and closing a page sends them at once.
- Home, Plan and the widget show the student's own teaching week, worked out from their modules (or the date when there are none), instead of always "Week 10".
- The wall is named by the calendar ("Wednesday to Friday **next** week" on a Saturday), and **Lighten** works on the week the wall is actually in, offering only what is still ahead.
- **Move it** offers only work due *after* the slot, so coursework is never moved past its deadline.
- Recovery: the preview shows what booking gives back (it said "No change"), and the suggested time is never one that has already passed.
- Typed capture keeps the title clean: "Return library books tomorrow 1h" becomes *Return library books*, tomorrow, 1h.
- Lighten never offers a push too small to feel (under 6 load).
- Accessibility back to 100 on every page tested: each checkbox, radio and switch now announces whether it's on (it was silent when off), and nothing fades text below AA contrast (plan-together faces, Lighten's *before* gauge, the swap card).

**Product**
- **Plan together** opens on next week when nothing suits everyone this week.
- A day's untimed things are shown open when there are only a few.
- Lighten's cards show how important each thing is, replacing the old "want to be there" chip.

**Judge accounts and operations**
- Rebuilt around the current week, with six weeks of classes, and everything before yesterday already answered - no pile of thirty guesses to confirm.
- `judges` workflow: rebuilds the five accounts every Monday at 03:00 Malaysia time, and on demand (needs a `DATABASE_URL` repository secret).
- Every screen crawled as all five accounts, and the cross-account journeys driven end to end: 0 script errors, 0 failed requests.

**Documentation**
- README organised around the problem statement and the judging criteria: the problem and how each feature answers it, accounts, a tour, the guide, reliability, architecture.
- `ballast/README.md` is now a concise developer guide (architecture, the model in one page, verification); the design journal moved to `docs/engineering-notes.md`.

## v1.0.0 · 2026-10-13 · Final submission

**Reliability and operations**
- Live monitoring: a GitHub Action every 30 minutes signs in like a judge and checks the API, database, app, demo, sync, friends and plans. A failure opens an issue, and the first green run closes it.
- Automatic deploys after checks pass (API → Vercel, app → Expo hosting), followed by the same live checks. Active once the `EXPO_TOKEN` and `VERCEL_TOKEN` repository secrets are set.
- Crash screen with "Try again", plus error reports from the app to the API's logs (`/api/report`, no personal data).
- Signed in, a reload or an opened link waits behind the splash until your week and friends arrive, instead of showing an empty week or "not in your week" for a moment; `/account` no longer bounces to Home on a reload.
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
- **What to do first** lists only owing work and tasks without a set time, most urgent first: by the day each has to be **started** (walking back from the deadline through your real free time), so heavy work due later rises; importance decides within a day.
- It reads in keywords, not sentences: **why first** gives the real reasons (⏰ Due Wed · 3h free till then, 🤝 Hard deadline, ✅ next sitting) with strength dots; rows show due and hours, the rank coloured by how soon; one needs-vs-free bar for the week; a one-line rest banner.
- **Could move** means *flexible*: your own and soft plans the list may take over, least important first, each saying the time it frees and which task could use it (🎯), spread down the list. Booked work can bring a later sitting forward.
- **Swap this time** (`/swap/[id]`): *Move it* opens three steps: pick what takes the time (the 🎯 one first; owing work gets its share, booked work brings a sitting forward), plan it, then re-home the block or drop it.
- One way to pick a time everywhere (adding, moving, planning, booking rest, the marking sheet): this week and next with each day's load, or a calendar for any later date, plus the drag-along day slider. It shows three colours: fixed (grey), **could give up (amber)**, and free; sliding onto amber takes its place, then asks where the displaced block goes.
- **Cancel** on every task, the marking sheet and swaps, behind a second confirmation. Cancelled Google events stay out of the week; a cancelled plan is called off for friends, an accepted one is answered "Can't go".
- Judge accounts rebuilt around the current week with Klang Valley student life: roti canai and nasi lemak, food court lunches, futsal, the pasar malam, teh tarik at the mamak, a family steamboat. Shifts, tutoring and meetings are 📌 Fixed, and Tuesday and Thursday evenings stay free so plan-together finds green blocks.
- 12-page judges' guide (PDF) and a project thumbnail.

## Build phases V1–V13 · 2026-09-27 → 2026-10-12
- V1–V4: from prototype to real accounts: Hono API on Vercel, Neon Postgres, Better Auth, local-first sync, friends, groups, plans.
- V5–V8: Google Calendar (read-only), Gemini for messages and advice, timetable with attendance and flags, owing work with booked sittings.
- V9–V13: iPhone sign-in (bearer tokens), password change, profile photos, installable web app, judge accounts, demo and preview links, planned days, plan-invite fixes.

## Prototype · 2026-09-03 → 2026-09-13
- The interactive prototype, pitch video and first README, submitted for the first round.
