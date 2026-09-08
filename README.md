<h1 align="center">Ballast</h1>
<p align="center"><b>A stress and workload manager for students who are already too busy to manage their stress.</b></p>
<p align="center">
  <a href="https://load-balancer-ballast.expo.app"><b>▶ Open the live prototype</b></a> ·
  Lifestyle Track: Beating the Burnout
</p>

---

## 1. Project Overview

### The Problem

Burnout is rarely one big thing. It is a pile of small ones nobody was counting, and by the time a
student can feel it, the week that caused it is already over.

**Why it happens — four causes we kept coming back to:**

| Cause | What it looks like |
|---|---|
| **Hours are not the cost** | An hour of laundry and an hour of a group presentation are not the same hour. Every planner measures hours, so none of them can see the difference. |
| **Half the week is uncounted** | Shifts, commuting, chores, caring duties. For a student working twelve hours a week this is most of their load, and no planner ever asks. |
| **Clustering, not volume** | Three deadlines across ten days is an ordinary fortnight. The same three inside seventy-two hours is what actually breaks people. |
| **Saying no is expensive** | The hard part is not identifying what to cut. It is sitting down to compose the message — which is why it gets put off for four days. |

**Stakeholders:** the student · flatmates and friends who absorb the cancellations · tutors and shift
managers who receive the late request · university wellbeing services, downstream of all of it.

**What exists, and why it falls short:**

| App | What it does | Why it doesn't solve this |
|---|---|---|
| **Forest** | Pomodoro timer; a tree dies if you leave the app | Treats distraction as the problem. A student drowning in coursework is not distracted — they are overcommitted. |
| **Study Bunny** | Timer, coins, a customisable rabbit | Rewards time *spent studying*. It cannot tell you that studying more tonight is the wrong move. |
| **Notion / Todoist / Google Calendar** | Lists and blocks of time | Every task weighs the same, and a full calendar looks identical to a survivable one. |
| **Mood journals** | Records how you felt | Describes the week. Changes nothing about it. |

> None of them can say *"next Wednesday is going to hurt, and here are three things you could put down."*

### Our Solution

Ballast measures load as **time × dread**, because an hour you are dreading costs more than an hour you
are not. It splits that load across five areas with their own limits, so it can see *which part* of you
is overflowing rather than just how full you are. It then looks fourteen days ahead, finds the pile-up
before it arrives, and offers specific things you could put down — including writing the awkward message
for you. It runs entirely on the phone, and the whole daily ask is one tap.

**Feature set**

- 🔋 **The battery** — one honest number, with a face. Five areas, each with its own ceiling.
- ✍️ **One-box capture** — plain language in, dread in one tap, every guess correctable.
- 📅 **Fourteen-day forecast** — flags *clustering*, eight days out. The only screen that can prevent anything.
- ⚖️ **Rebalance** — priced trades with a live meter. Hard deadlines locked, recovery protected.
- 💬 **The decline drafter** — writes the message in three tones. Never sends it.
- 🌙 **Tonight** — try an evening before you live it, then book it at a time you choose.
- 🧩 **Five area screens** — mood grid, week grid, meals and sleep, contact gaps, batched errands.
- 📈 **Deadline work** — anything needing preparation sits on every day until done, with sittings you can plan.
- 🎉 **Good moments** — the one input that puts charge *back*. No streaks, ever.

---

## 2. Ideation & Process

### 2.1 Ideas We Considered

| Idea | Kept or dropped, and why |
|---|---|
| **A · Ballast — load = time × dread** ✅ | **Chosen.** The only idea that explains why two full weeks feel completely different. Everything else in the app is downstream of this one multiplication. |
| **B · REBOOT — the battery metaphor** ✅ | **Chosen, merged into A.** "13% left" lands in half a second; "87% of capacity used" does not. Same number, friendlier end of it. Brought the What-If simulator and the five area screens with it. |
| **C · What-If simulator** ✅ | **Kept.** Being *told* to sleep more changes nothing. Dragging a slider and watching the projection move is the same advice you can argue with. |
| **D · Pomodoro / focus timer** ❌ | Dropped. Focus was never the problem. A student juggling a job, coursework and errands is overcommitted, not distracted — timing their sessions better would have solved the wrong thing. |
| **E · Mood journal** ❌ | Dropped as a *product*, kept as a *feature*. Logging a mood describes the week; it does not change it. It survives only because it feeds the battery. |
| **F · Streaks, badges, leaderboards** ❌ | Dropped on principle. Streak mechanics punish exactly the weeks this app exists for, and a leaderboard makes suffering competitive. The only reward left is a short burst when you log something good. |
| **G · LLM-parsed capture and scheduling** ❌ | Dropped for a rule-based version. The demo cannot depend on venue wifi, and an offline app cannot call a model. Regex plus a keyword dictionary does the same job and can be explained. |
| **H · Daily digest notifications** ❌ | Dropped. One message, eight days out, only for a genuine collision. A notification the night before is not a warning, it is a commiseration. |

### 2.2 Ideation Boards

**Problem tree** — the causes under the thing everyone can see.

![Problem tree](docs/problem-tree.svg)

**Mindmap** — six branches, and the directions we killed. Dashed boxes are dropped ideas with the reason.

![Ideation mindmap](docs/mindmap.svg)

**User flow** — the loop that prevents a bad week. Every box is a screen that exists in the prototype.

![User flow](docs/user-flow.svg)

### 2.3 Mentor Consultation

| Date | Mentor | Feedback received | What was changed |
|---|---|---|---|
| | | | |
| | | | |

> *To be completed by the team from your own mentor sessions.*

---

## 3. Design & Prototype

### ▶ [load-balancer-ballast.expo.app](https://load-balancer-ballast.expo.app)

Live, clickable, and it opens in an incognito window. No install, no sign-in. Eighteen screens; every
number on every one is computed from a seeded fictional semester rather than hard-coded.

| Screen | Link | What to try |
|---|---|---|
| **Intro** | [`/welcome`](https://load-balancer-ballast.expo.app/welcome) | Drag the dread dots on two tasks. 3h of dreaded work overtakes 6h of enjoyable reading — the whole idea, in ten seconds. |
| **Home** | [`/`](https://load-balancer-ballast.expo.app/) | The character reads 13% before you read anything. Five areas below it; mental is flat while physical still has 69%. |
| **Plan** | [`/plan`](https://load-balancer-ballast.expo.app/plan) | Tap any of fourteen days to open it hour by hour. The collision is drawn as three columns, not a list. |
| **Rebalance** | [`/rebalance`](https://load-balancer-ballast.expo.app/rebalance) | Toggle trades and watch the battery move live. The group presentation cannot be toggled — hard deadlines are locked, not discouraged. |
| **Tonight** | [`/actions`](https://load-balancer-ballast.expo.app/actions) | Pick "a recovery night" and see it land at 32%. The sleep slider tells you the bedtime it implies, and whether tonight allows it. |
| **Saying no** | [`/decline/w11-birthday`](https://load-balancer-ballast.expo.app/decline/w11-birthday) | Three tones. "Actually, I'm going" is a real button that re-plans the week instead of guilt-tripping you. |
| **An area** | [`/areas/mental`](https://load-balancer-ballast.expo.app/areas/mental) | Log something good and watch the battery go *up* — the one input that adds charge. |
| **Foundations** | [`/foundations`](https://load-balancer-ballast.expo.app/foundations) | The design system: four bands as colour *and* word *and* fill pattern, the character at every level, the type scale. |

All eighteen frames can be exported to Figma in one import — `npm run figma:canvas` builds a single page
of 390×844 artboards, and `figma/tokens.json` imports as Figma variables.

---

## 4. What Makes It Different

| # | Feature | Why it is original |
|---|---|---|
| 1 | **load = hours × dread** | No planner weights a task by how much you mind it. It takes one tap at capture and it is why the app can tell two identical-looking weeks apart. Three hours of group presentation (12) outweighs six hours of reading you enjoy (6). |
| 2 | **Clustering detection, not totals** | Every other tool warns on volume. Ballast slides a 72-hour window across the fortnight, ignores repeating background load, and flags density — eight days out, which is long enough to email a tutor or swap a shift. |
| 3 | **The decline drafter** | The twist: the app does not just tell you what to cut, it writes the message. Three tones, and *"Actually, I'm going"* is a first-class button that re-plans around your choice. |
| 4 | **Recovery counted in the same units as work** | Rest is a credit you are owed, in hours, carried forward — not an absence. Booking it writes a protected block at a time you pick from gaps that actually exist. |
| 5 | **Shape beats total** | Five areas with separate ceilings. Someone at 60% overall with 100% mental is closer to the edge than someone evenly at 75%, and the maths says so: `overall = (mean + worst) ÷ 2`. |
| 6 | **The interface gets simpler as the week gets worse** | Above 90% the app collapses to one number, one sentence, one button. Most apps add urgency when things get bad; that is precisely backwards. |
| 7 | **A battery with a face — and no streaks** | Game feel without game pressure. The character is sympathetic at every level, including 8%. There is no frown, no streak and no score, because those punish the exact weeks this app exists for. |

---

## 5. Technical Architecture & Feasibility

### Tech stack

| Layer | Choice | Why, and the constraint we accept |
|---|---|---|
| **Frontend** | Expo SDK 57 · React Native 0.86 · React 19.2 | One codebase for iOS, Android and web, and it opens on a judge's own phone from a QR code. **Constraint:** Expo Go in the App Store lags the SDK — it was stuck on 54 for a day and we had to pin backwards until it caught up. |
| **Language** | TypeScript 6, `strict` | Bucket, dread and commitment are union types, so an invalid week does not compile. |
| **Routing** | Expo Router 57 | File-based, so the route tree *is* the screen inventory. Typed routes catch a broken link at compile time. |
| **Styling** | NativeWind 4 + Tailwind 3.4 | Tailwind's theme is generated from `figma/tokens.json`, so a class name and a Figma variable are the same decision. `theme`, not `theme.extend` — arbitrary values cannot be written. |
| **State** | Zustand 5 | The model is small, local and synchronous. No provider tree, no cache layer. |
| **Charts** | Hand-built + `react-native-svg` | **Deliberately not a chart library.** A library renders to an opaque canvas; our bars are real rectangles that carry a fill *pattern* for colour-blind users and a spoken sentence for screen readers. Twelve components, one dependency, and they paste into Figma as vectors. |
| **Database** | AsyncStorage, on device | **No backend and no database server.** Nothing to breach, and it works in a basement lecture theatre. **Constraint:** no cross-device sync — a deliberate trade for the offline guarantee. |
| **APIs** | None at runtime | The parser is regex plus a keyword dictionary; the scheduler is a real algorithm. Both run offline and can be explained. **Constraint:** less flexible than an LLM, which is the price of never failing on venue wifi. |
| **Hosting** | EAS Hosting | `npm run deploy` gates on the full check suite, then promotes. Free tier is ample for a prototype. |

### Build plan & scope

**Built and working now** — the load model, capture with the plain-language parser, the fourteen-day
forecast with clustering detection, rebalance with live trade pricing, the decline drafter, recovery
booking, the Tonight simulator, all five area screens, deadline work with a session planner, and the
accessibility system. Add a task and the forecast changes.

**Seeded, and we say so** — sleep and step signals, the friend circle's bands, the cohort average.
Each needs other people or a health permission dialogue and demos identically either way.

**Cut on purpose** — accounts, cloud sync, university timetable integration, push notifications, and any
settings screen. Local storage and one hard-coded student mean no auth flow to debug at 3am.

**Next, in order:** HealthKit / Health Connect behind a feature flag → real calendar import →
accounts and sync, only once there is a reason to leave the device.

### How we know it works

No manual clicking. Four checks run before anything deploys:

| Check | What it proves |
|---|---|
| `model:check` | **13** figures from the design study are reproduced by the seed and the maths |
| `behaviour:check` | **203** state changes — every button moves the state it claims to |
| `render:check` | **257** strings across 18 screens, plus every route having a way out |
| `tokens:check` | **83** design tokens identical between the code and the Figma source |

`npm run deploy` refuses to publish if any of them fail.

---

<p align="center">
  <b><a href="ballast/README.md">Technical documentation →</a></b> · architecture, the load model, accessibility, and the Figma conversion path
</p>
