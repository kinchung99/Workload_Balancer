# Ballast — frontend

A stress and workload manager for students who are already far too busy to manage
their stress. Frontend only: React Native, no backend, no auth, no database
server. Every number on every screen is computed from a seeded fictional
semester, and the whole thing is authored so it converts into Figma mechanically
rather than by redrawing.

Built from two briefs — the twelve-page `Ballast-interface-study.pdf` and the
`REBOOT` feature deck — merged into one app. What each side contributed, and why
the merge went the way it did, is in *The merge* below.

```
Load Balancer/
├── README.md    ← you are here
└── ballast/     ← the app
```

The source brief is `Ballast-interface-study.pdf`. Drop it in beside this file if
you want it version-controlled next to the implementation it describes.

---

## Quick start

```bash
cd ballast
npm install
npm start           # scan the QR code with Expo Go (iOS: Camera app; Android: in-app scanner)
npm run web         # or open it in a browser
```

Expo Go from the App Store runs this as-is, provided the phone is on iOS 16.4 or
newer. See *A note on Expo Go and SDK versions* if it isn't.

Verification, all of which runs without a device:

```bash
npm run preflight        # all five checks below, in order — what `deploy` runs first
npm run typecheck        # tsc --noEmit, strict
npm run tokens:check     # figma/tokens.json and src/design/tokens.ts have not drifted
npm run model:check      # the load model reproduces the study's stated figures
npm run behaviour:check  # every button actually changes the state it claims to
npm run render:check     # those figures actually reach the rendered screens
npm run figma:canvas   # build figma/canvas.html — all 18 frames, ready to import
```

---

## Sharing it with teammates

`npm start` serves Metro from your own machine, so the QR code points at your
laptop's LAN address. That is why only you can open it: teammates need to be on
the same Wi-Fi, with your laptop awake, and on iOS 16.4+ for Expo Go 57.

**The app is deployed as a website instead:**

> **https://load-balancer-ballast.expo.app**

Any browser, any device, no install and no Expo Go version to worry about. Every
screen is there and the routes are real, so
`/actions`, `/areas/mental` and `/foundations` can be linked directly.

To push changes:

```bash
cd ballast
npm run deploy        # expo export --platform web && eas-cli deploy --prod
```

That rebuilds and promotes to the same URL. The EAS project is
`@kc699/load-balancer-ballast`; its dashboard is on expo.dev under the kc699
account, and it can be transferred to `kc699s-team` if teammates need to deploy
it themselves.

The hosting subdomain is fixed on a project's **first** deployment and
`eas deploy --dev-domain` refuses to change it afterwards, so renaming the URL
meant creating a new EAS project and claiming the domain on its first deploy.
The earlier `kc699-ballast.expo.app` is still serving a stale build; delete that
project from the dashboard when you no longer want it reachable.

**What the web build cannot tell you.** It is React Native Web, so the simulator
sliders respond to a mouse rather than a finger, and 44pt touch targets, dynamic
type at 200% and VoiceOver all behave differently on a real handset. For those,
run it in Expo Go on a phone.

---

## The first run, and the one idea

The app's only original claim is that **an hour of laundry and an hour of a group
presentation are not the same hour**. `load = hours × dread`. Everything else —
the forecast, the trades, the battery — is downstream of that one multiplication,
and no calendar, habit tracker or mood journal does it.

That idea used to be invisible. A new user landed on a home screen reading
*"13% · Running on empty"* over five batteries and had no way to know what 13%
was a percentage of, let alone why mental and physical differed. The interface
assumed you had read the twelve-page study.

`/welcome` fixes that by teaching the idea instead of explaining it. Three steps,
skippable, and it runs once:

1. **Two tasks, two dials.** A 3-hour group presentation and 6 hours of reading
   you enjoy, each with a dread control you drag. The bars move as you drag and
   the headline recomputes — *"Half the hours. Twice the load."* Nobody reads a
   paragraph about weighted hours; everybody understands a bar that overtakes
   another one while they are holding it.
2. **Why one number is not enough.** Amira's battery, then her five areas. Her
   head is empty and her body still has 69% left, and that pairing has a specific
   fix a timetable cannot see.
3. **Your turn.** One thing you are dreading, with hours and a dread dial, and a
   live load readout. It goes into your week, so the app is yours before you
   reach the home screen.

The redirect is a client-side effect rather than a `<Redirect>`, because every
route is prerendered in Node where `onboarded` is still false — rendering the
redirect would bake it into the static HTML for everyone.

Three specific things a fresh reader tripped on, now fixed: the battery says
**"of your week left"** rather than a bare `13%`; a strained area reads
**"over its limit by 4%"** instead of the genuinely misleading `−104%`; and a
20-minute task no longer renders as `20m, 20m`.

---

## Feeling finished without a backend

- **It remembers.** Zustand persists to AsyncStorage — device-local, no server.
  A week you rebalanced stays rebalanced and the intro does not run twice. The
  storage adapter degrades to an in-memory stub during prerender, because
  `expo export` renders every route in Node where there is no localStorage.
- **It responds.** Every control that changes something buzzes: dread dots,
  sliders (once per notch crossed, not per pixel), checkboxes, toggles, the mood
  grid. All routed through `lib/haptics.ts`, which no-ops on web and in Node.
- **It confirms.** Applying a rebalance used to navigate away silently. It now
  reports what it did — changes applied, load returned, the new battery, and that
  two messages are drafted and nothing was sent.
- **It animates, once.** The battery fills on mount and tweens on change. That is
  still the only animation in the app, and reduced motion cuts it to the value.
- **It resets.** No settings screen — cut on purpose — so *Replay the intro*,
  *Design foundations* and *Reset to the seeded week* live at the bottom of
  Areas. A demo you cannot reset is a demo you get one take at.
- **Every screen has a way out.** Tab screens have the tab bar; the fourteen that
  do not now carry a labelled back control — *Areas*, *Plan*, *Recovery*, *Home*
  — and it falls back to a real destination rather than `router.back()`, because
  a link opened from a share has no history to pop. `render:check` fails if any
  route loses its exit.

---

## Nothing is a dead button

An audit found nine controls that looked functional and were not, including two
of the app's headline promises. All of them now do the thing they say, and
`npm run behaviour:check` drives the real store through each one so they cannot
quietly rot back.

| Was | Is |
|---|---|
| Recover → *What would actually help* → *Put it in Thursday, 5pm* → back to Recover, forever, with nothing booked | Booking writes a **protected block into the week** and credits the ledger. The balance moves, the prescription stops being offered, and Home swaps its suggestion card for *Recovery booked* |
| *Tap anything to fix it* — five chips that did nothing | Each chip opens a correction panel: area, hours, date, commitment. One tap to fix, and it closes. Retyping the sentence clears the corrections |
| *Copy it* / *Open in WhatsApp* / *Actually, I'm going* — all `router.back()` | Real clipboard write, a real `wa.me` link with a clipboard fallback, and *going* actually re-plans — the chapter 9 reading moves to Sunday |
| *Send "Hey, thinking of you"* opened the recovery screen | Copies the message and resets the contact gap to zero |
| *Suggest it to them* — a literal no-op | Marks the window suggested and reports who has it |
| *Put this plan in my week* opened the recovery screen | Books every charge-positive slider as protected time and credits the ledger |
| `minimumViableWeek` — set by Calm mode, read by nothing | Hides all but the things that matter, with a banner saying how many and one tap to bring them back |
| `dayReports` — recorded, read by nothing | Feeds `recalibrate`. Report *hard* twice below your line and the line comes down; the widget says so and Home shows where it sits |

The three fake surfaces that remain are labelled as such: the microphone buttons
on the physical and errands screens are affordances with no speech API behind
them, and the sleep, step and cohort figures are seeded. Those are documented in
*What is real, what is seeded, what is cut* rather than dressed up.

---

## Building and deploying it later

```bash
npm run preflight     # typecheck → tokens → model → rendered output
npm run deploy        # preflight, then export, then promote to production
```

`deploy` will not publish if any check fails, so a broken build cannot reach the
URL. `eas-cli` is a pinned devDependency rather than an `npx eas-cli@latest`
call, so the deploy uses the same version every time.

The things most likely to break later, and where they are handled:

| Risk | Handling |
|---|---|
| Tokens drift from Figma | `tokens:check` compares both files, 73 scalars |
| A component hard-codes a number | `render:check` asserts 166 strings against real output |
| A button silently stops working | `behaviour:check` drives the store through all 26 actions |
| A screen becomes a dead end | `render:check` asserts all 14 non-tab routes carry an exit |
| Persistence crashes the static build | Storage adapter falls back to memory when `window` is undefined |
| Typed routes go stale after adding a screen | `expo start` regenerates `.expo/types`; typecheck fails loudly until it does |
| SDK upgrade breaks the build | See *A note on Expo Go and SDK versions* |

---

## The merge

Two briefs, one app. They disagreed about almost nothing important, because they
were solving the same problem from opposite ends: Ballast had a model and no
warmth, REBOOT had a metaphor and no engine.

**Kept from Ballast — the engine.** Load as hours × dread, five buckets with
their own ceilings, the fourteen-day forecast with clustering detection, the
rebalance trade sheet, the decline drafter, and the accessibility system. REBOOT
has nothing that can see a collision eight days out, and nothing that knows an
hour of laundry is not an hour of group presentation.

**Taken from REBOOT — the surface.** Everything a tired person actually looks at:

| From REBOOT | What it replaced or added |
|---|---|
| **Battery metaphor** | "13% left" instead of "87% of capacity used". Same number, friendlier end of it, and it lands in half a second. |
| **What-If Simulator** | New, and now the Actions tab. Drag sleep, a walk, a text, a study session or late-night screen time and watch the projection move. |
| **What's pulling you down** | Ranked drains on Home, worst first, instead of a paragraph explaining the shape. |
| **Areas hub** | A tab of five batteries, emptiest first, replacing a generic bucket-detail route. |
| **2×2 mood grid** | Replaced a three-button "how was today". Wired and miserable and flat and content are different weeks. |
| **Week calendar grid** | New. Committed hours in amber, protected recovery in green, written into the same grid. |
| **Body log** | New. Meals logged qualitatively — Ate · Filling, Light snack, Skipped — plus steps and active minutes. |
| **Contact gaps** | New, merged with Ballast's circle. "Last spoke 9 days ago", sorted longest-gap first, with one-tap reconnection. |
| **Categorised errands** | New. Grouped into Groceries, Admin and Academic with per-group counts. |

**Deliberately not taken.** REBOOT's stack is cloud-shaped — FastAPI, WebSockets,
Google Calendar, Gemini, Cloud Speech-to-Text. None of it is here. The app runs
entirely on the phone, so it works in a basement lecture theatre and there is
nothing on a server to breach. The voice buttons on the capture screens are real
affordances wired to on-device dictation, not calls to a speech API, and the
parser is regex plus a keyword dictionary rather than an LLM. Its "Exponentially
Weighted State-Space Decay" battery formula was also dropped in favour of the
load model, which is forecastable — you cannot warn someone eight days out with a
decay curve fitted to yesterday.

**The wordiness pass.** The interface study is an essay, and the first build read
like one — every screen carried a paragraph explaining itself. Those paragraphs
now live in code comments and in this file, where they belong. Screens carry
numbers, controls and one short line.

---

## Tech stack

| Layer | Choice | Why this one |
|---|---|---|
| Runtime | **Expo SDK 57** / React Native 0.86 / React 19.2 | Runs on a judge's own phone from a QR code rather than in a simulator. New Architecture on. |
| Language | **TypeScript 6**, `strict` | Every domain concept — bucket, dread, commitment — is a union type, so an invalid week does not compile. |
| Routing | **Expo Router 57** (file-based) | The route tree *is* the screen inventory, which is what lets `figma/` name frames off the filesystem. Typed routes on. |
| Styling | **NativeWind 4** + Tailwind 3.4 | Tailwind's config is generated from the design tokens, so a class name in a screen and a variable in Figma are the same decision. |
| State | **Zustand 5** | The model is small, local and synchronous. No provider tree, no async, no cache layer to explain. |
| Charts | **Hand-built + react-native-svg** | Deliberately *not* a chart library — see below. |
| Icons | **Inline SVG** (4 glyphs) | Four vectors that paste into Figma, instead of a font the bundle needs four characters from. |
| Animation | React Native `Animated` | There is exactly one animation. It did not justify a dependency. |
| Persistence | none — in-memory + seed | Cut on purpose. See *What is real, what is seeded, what is cut*. |

### A note on Expo Go and SDK versions

The project targets SDK 57 and Expo Go runs it. That was briefly not true: on
2 September 2026 the App Store client was still 54.0.2 across every storefront,
so an SDK 57 dev server produced *"download the latest version of Expo Go"* — a
prompt that could not be satisfied, because the installed version already was the
latest published. The project was pinned back to 54 for a day; Expo Go 57.0.9
shipped on 2 September and the pin was lifted.

**The live constraint is now iOS, not the SDK.** Expo Go 57 requires **iOS 16.4
or newer**, up from 15.1 on the 54 client. On an older device the App Store
serves the older Expo Go, which cannot open this project. If that is you, the
options are a development build (`npx expo run:ios`, needs Xcode) or `npm run web`.

Two things bite when moving between SDK majors, both learned the hard way here:

- `npx expo install --fix` can add `expo-status-bar` to `plugins` in `app.json`.
  It ships no config plugin and the export fails until you take it back out.
  (It behaved on the way up to 57; it misbehaved on the way down to 54.)
- `babel-preset-expo` is hoisted on 57 and not on 54. It is kept as an explicit
  devDependency here so the question never comes up again.

Also check `react` and `react-dom` match exactly after any change. A 19.2.8 /
19.2.3 split produces a minified React error #527 at static-render time and
nothing more useful.

### Why no chart library

The study specifies Victory Native. It was rejected for two reasons that both
matter more than the convenience:

1. **Figma.** A charting library renders to a canvas or an opaque SVG tree. A bar
   built from `<View>` and a `<Pattern>` arrives in Figma as a rectangle with a
   real fill, inside an auto-layout frame, with the label as editable text.
2. **Accessibility.** Every chart here carries a spoken sentence and a fill
   pattern, neither of which a chart library gives you without fighting it.

The five chart components total 343 lines and depend on nothing but `react-native-svg`.

---

## Architecture

```
ballast/
├── app/                        Expo Router. One file per screen, nothing else.
│   ├── _layout.tsx             Root stack + SafeAreaProvider
│   ├── (tabs)/                 Home · Areas · Plan · Actions
│   │   ├── index.tsx           Battery, areas, drains, today
│   │   ├── areas.tsx           Five batteries, emptiest first
│   │   ├── plan.tsx            14-day forecast + clustering flag
│   │   └── actions.tsx         The What-If simulator
│   ├── areas/[key].tsx         Dispatches to the five area screens
│   ├── add.tsx                 Capture sheet
│   ├── rebalance.tsx           Trade sheet
│   ├── prescription.tsx        Matched recovery
│   ├── recover.tsx             The ledger
│   ├── decline/[id].tsx        The drafter
│   ├── calm.tsx                Calm mode, as a reviewable frame
│   ├── widget.tsx              Lock screen + the daily ask
│   └── foundations.tsx         The quality floor, rendered from tokens
│
├── src/
│   ├── design/
│   │   ├── tokens.ts           Typed mirror of figma/tokens.json
│   │   └── figma.ts            The Figma bridge: rules, frame map, component map
│   ├── components/
│   │   ├── primitives/         Stack Text Card Button Chip Toggle Divider
│   │   │                       DreadDots ItemRow Slider Checkbox MoodGrid AreaTile
│   │   ├── charts/             BandPattern Bar Battery ForecastStrip WeekGrid
│   │   └── layout/             Screen TabIcon
│   ├── features/
│   │   ├── home/CalmMode.tsx
│   │   └── areas/              Mental Time Physical Social Errands
│   ├── lib/                    The model. No React in this directory.
│   │   ├── load.ts             load = hours × dread, buckets, bands, diagnosis
│   │   ├── battery.ts          charge = 100 − load%, drains, labels
│   │   ├── simulate.ts         What-If actions and the projection
│   │   ├── forecast.ts         14-day strip, clustering detection
│   │   ├── rebalance.ts        Trade generation and pricing
│   │   ├── parser.ts           Plain-language capture, regex + keywords
│   │   ├── drafter.ts          Three-tone decline messages
│   │   ├── dates.ts            ISO/UTC helpers, deterministic
│   │   └── types.ts            Domain types
│   ├── data/seed.ts            The fictional semester. Built first, not last.
│   ├── state/store.ts          Zustand store + plain selectors
│   └── hooks/                  useReducedMotion
│
├── figma/
│   ├── tokens.json             W3C DTCG. The source of truth for every value.
│   └── canvas.html             Generated: 18 frames, one page, import-ready
│
└── scripts/                    Four verification/build scripts, no build step
```

**The dependency rule is one-directional:** `app/` → `components/` → `lib/` →
`design/`. `lib/` imports no React and touches no component, which is why the
model can be checked by a plain Node script with no renderer
(`scripts/check-model.mjs`).

**Data flow.** `seed.ts` → Zustand store → plain selector functions
(`weekReading`, `itemsOnDay`, `movableIn`) → screens. Screens do arithmetic
nowhere; they call `lib/`. Swapping the in-memory array for SQLite means changing
`seedItems` and nothing else.

---

## The load model

The one idea the whole app runs on:

```
load = hours × dread          (dread is 1–5, asked once per task, never again)
```

An hour of laundry and an hour of a group presentation are not the same hour.
Three hours of group presentation at dread 4 is 12; six hours of reading you
enjoy at dread 1 is 6. Twice the hours, half the load — and a timetable would
have told you the opposite.

**Five buckets, five ceilings.** Mental, time, physical, social, errands, each
against a personal ceiling, because shape beats total.

**The overall number.** Not a plain average. The worst bucket counts for half:

```ts
overall = (mean(buckets) + max(buckets)) / 2
```

This is the study's claim on page 2 made arithmetic — *someone at 60% overall but
100% mental is closer to the edge than someone sitting evenly at 75%*. Under this
formula the first student reads 80% and the second reads 75%, which is the right
way round. It also reproduces Amira's headline 87% exactly from her five bucket
readings of 104 / 82 / 74 / 58 / 31.

**Clustering, not totals.** `findCollision` slides a 72-hour window across the
fortnight and picks the densest — most items first, then most load, ties to the
earliest, because an earlier warning is worth more. Two rules keep the flag
meaningful:

- **Repeating load is excluded.** The timetable, the commute and the regular
  shifts are the background a student already lives in, not the collision.
  Counting them would flag every week.
- **A floor of 9 load.** Below that it is not what breaks a week.

**On screen it is a battery.** `charge = 100 − load%`. Internally everything
stays load against a ceiling, because that is what can be forecast and traded;
the battery is the presentation, and `src/lib/battery.ts` is the only place the
two meet. Amira's 87% used is 13% left, and 13% left is the one a tired person
reads without thinking.

**The simulator projects on charge points, not through the model.** This is
deliberate and it is the one place the app trades exactness for legibility: if a
slider says +9 and the battery moves 6, the feature looks broken even when it is
right. Charge points are additive and add up in the user's head. The bucket model
stays the authority on the week that actually happened; the simulator is
explicitly a what-if.

**Trades are priced, and some are refused.** `buildTrades` never proposes moving
a hard deadline, protects recovery by default, and only suggests sending a
message when the saving is worth the social cost of sending it — offering to skip
a 2-load Sunday dinner would spend the student's trust for nothing. Batching
errands is exempt from that floor, because nothing is given up.

---

## Screens

| # | Route | Source | What it does |
|---|---|---|---|
| 00 | `/welcome` | **new** | The intro. Teaches `load = hours × dread` by letting you feel it |
| 01 | `/` | study p.3 | Battery, five areas, what's pulling you down, today |
| 02 | `/add` | study p.4 | One box, plain language, guesses as fixable chips |
| 03 | `/plan` | study p.5 | 14-day strip, clustering flag, 8 days of lead time |
| 04 | `/rebalance` | study p.6 | Live battery, locked deadlines, protected recovery |
| 05 | `/recover` | study p.7 | The ledger. Rest as a credit, in load units |
| 06 | `/prescription` | study p.7 | Matched to the area that still has room |
| 07 | `/decline/w11-birthday` | study p.8 | Three tones, and "Actually, I'm going" as a real button |
| 08 | `/areas/social` | both | Contact gaps + circle bands + cohort context |
| 09 | `/calm` | study p.10 | Above 90%, the interface gets simpler |
| 10 | `/widget` | study p.10 | Lock screen, and the one tap that is the whole daily ask |
| 11 | `/areas` | REBOOT | Five batteries, emptiest first |
| 12 | `/actions` | REBOOT | **What if I…** — the simulator |
| 13 | `/areas/mental` | REBOOT | Mood grid, contributing tags, recent check-ins |
| 14 | `/areas/time` | REBOOT | Week grid with protected recovery blocks |
| 15 | `/areas/physical` | REBOOT | Meals, steps, active minutes |
| 16 | `/areas/errands` | REBOOT | Batched into Groceries, Admin, Academic |
| 17 | `/foundations` | study p.11 | Bands, patterns, type scale — rendered from tokens |

Home switches into calm mode on its own above 90%. The seeded week 10 sits at
87%, so `/calm` exists as a separate route to make the state reviewable without
having to make a student's week worse to see it.

---

## Design system

`figma/tokens.json` is the single source of truth — W3C DTCG format, importable
by Tokens Studio. Three things read it and nothing else defines a value:

- `tailwind.config.js` parses it at config time, so Tailwind's theme *is* the
  token set. `theme`, not `theme.extend`: a class that is not a token does not
  exist. No `text-[13px]`, no `bg-[#fff]`, no arbitrary values anywhere.
- `src/design/tokens.ts` is the typed mirror for app code.
- `npm run tokens:check` walks both and fails on drift — 73 scalar tokens.

**Contrast was computed, not eyeballed.** Every `ink` token clears 4.5:1 on both
white and the sunken surface; every band fill clears 3:1 against the page. The
one place that does not reach 3:1 is a busy or recovery bar against its own
track — carried instead by the fill pattern and the numeric label beside it,
which is the same "never colour alone" rule applied honestly rather than claimed.

---

## Converting to Figma

This was a design constraint on the code, not a step afterwards. Four rules,
enforced throughout and documented in `src/design/figma.ts`:

1. **Auto-layout only.** Every container is a `<Stack>` — a flex row or column
   with `gap`, `pad`, `align`, `justify`, and nothing else. That is exactly the
   property set of a Figma auto-layout frame. There is no absolute positioning,
   no margin, no transform and no fixed height on text in the entire codebase.
2. **No raw values.** Every colour, size, radius and type step is a token, so
   each property in Figma binds to a variable instead of being typed in.
3. **One name.** File name = export name = Figma component name.
   `FIGMA_COMPONENTS` is the index.
4. **One frame size.** Every screen renders inside 390×844, so nothing scales.

### The path

```bash
cd ballast
npm run figma:canvas          # writes figma/canvas.html — all 18 frames
npx serve figma               # serve it (html.to.design needs a URL)
```

1. In Figma, run **Tokens Studio** → Settings → *Use DTCG format* → Import
   `figma/tokens.json` → **Create variables**. You get the `Colour`, `Dimension`
   and `Type` collections before any layers exist.
2. Run **html.to.design** and point it at the served `canvas.html`. Each
   `.artboard` arrives as a 390×844 frame, named `01 Home — battery and areas`
   and so on. Every `Stack` lands as an auto-layout frame with its real padding and gap;
   text stays editable; the band patterns arrive as vector fills, not bitmaps.
3. Bind the imported hex values to the variables from step 1. They match exactly,
   because both came out of the same file.
4. `/foundations` is frame 17 of 18 and doubles as the design file's cover page — every
   band, pattern, type step and dread state rendered from the same tokens.

`figma/canvas.html` is generated and safe to delete; regenerate it any time the
app changes and the design file stays in step with the build.

---

## Accessibility

Tested against the study's own condition: a tired person, one-handed, on a bus,
at 11pm, with a cracked screen.

- **Never colour alone.** Four bands, each carrying a colour *and* a word *and* a
  fill pattern — flat, diagonal hatch, cross hatch, vertical rule, drawn as SVG
  patterns in `BandPattern.tsx`. Print in greyscale and all four remain
  distinguishable; `/foundations` renders that proof.
- **Charts that can be spoken.** Every visualisation carries a sentence, not a
  label. VoiceOver reads the home chart as *"Mental, heavy, 104% of ceiling.
  Time, busy, 82% of ceiling…"*, and `npm run render:check` asserts that sentence
  is present in the output.
- **Targets.** 44pt minimum on everything tappable, dread dots included — the
  `Toggle` wraps a 30pt control in a 44pt target for that reason.
- **Type that can grow.** No `numberOfLines`, no fixed heights, no text inside a
  shape it can overflow. Rows reflow to two lines rather than truncating.
- **Motion that can stop.** `useReducedMotion` is wired and respected; nothing
  animates on its own.
- **Controls built, not installed.** The slider is draggable, tappable *and*
  `accessibilityRole="adjustable"` with increment/decrement actions — the third
  of those is what off-the-shelf sliders usually miss.
- **One thumb.** Every primary action is in `Screen`'s `footer`, in the lower
  half. Nothing that matters lives in a top corner.
- **Three-state toggles.** `on` / `off` / `locked` / `protected`, each announced
  differently, so a hard deadline and an unselected option are never confused.

---

## What is real, what is seeded, what is cut

**Real** — the load model with dread weighting, five buckets and their ceilings,
the battery, the What-If simulator, the plain-language parser, the 14-day
forecast with clustering detection, the rebalance sheet, recovery matching, the
decline drafter, and every area screen's logging. Add a task on `/add` and the
forecast changes; drag a slider on `/actions` and the projection moves.

**Seeded, and the code says so** — sleep and step signals, meals, the circle's
bands, the cohort average, the contact list and the week grid's blocks. Each
needs other people, a health permission dialogue or a calendar grant, and demos
identically either way. All of it lives in `src/data/seed.ts` with comments
marking it as seeded.

**Affordance, not integration** — the microphone buttons on the physical and
errands screens are real controls with real accessibility labels, but they are
wired to nothing. Dictation into the capture field is the supported path; voice
capture with LLM categorisation is REBOOT's design and would need a speech API
and a model call, both of which were cut for the offline guarantee.

**Cut on purpose** — accounts and login, cloud sync, timetable integrations,
notifications, settings, and persistence. State starts from the seed on every
launch. The app genuinely works offline, which is a feature rather than a
shortcut.

---

## Where this diverges from the interface study

The study is a design artifact and three of its figures do not survive contact
with a working model. The app computes rather than quotes, so where they conflict
the code is internally consistent and this section says why.

1. **Rebalance end state.** The study prints *96% → 71%, saving 46 load*, but its
   own six rows sum to 34, and no consistent model turns 34 load into 25
   percentage points. The app applies the four selected trades and shows the true
   result: **96% → 84%, saving 34**. A live meter that lies is worse than one
   that tells the truth.
2. **Today's total.** The study's home screen reads *3 things, 19 load* beside
   dread dots of 4, 2 and 1 on a 4h, 6h and 20m item — which multiply to 28.3,
   not 19. The app shows **3 things, 28.3 load**, matching the dots it draws.
3. **Which days the café shift falls on.** Page 3 shows a shift today, Monday;
   page 4 says *"Tue and Fri"*. Home is the more prominent screen, so the seed
   uses Monday and Friday and the capture chip reads *"Mon and Fri"*.

Everything else matches. `npm run model:check` asserts thirteen of the study's
figures against the model, and `npm run render:check` asserts 166 strings against
the rendered HTML of all seventeen screens, and `npm run behaviour:check` asserts
26 state changes behind the buttons.

---

## Verification

There are no unit tests, and that is a deliberate trade for a frontend study: the
two scripts below check the things that would actually be wrong.

- `scripts/check-model.mjs` — loads the real `seed.ts` and `load.ts` through
  Node's native TypeScript stripping and asserts the study's numbers. It catches
  a seed edit that silently moves Amira off 87%.
- `scripts/check-behaviour.mjs` — drives the real Zustand store through the
  actions the buttons call and asserts the state moved: 26 checks covering
  booking, plan-committing, reconnecting, re-planning, ceiling recalibration,
  capture and the area logs. This is the one that catches a button going dead.
- `scripts/check-render.mjs` — statically renders every route, strips the HTML
  (keeping `aria-label` values, since a spoken chart is rendered content too) and
  asserts the figures reach the screen. It catches a component that hard-codes a
  percentage the model never produced.

Both run in CI without a device or a simulator. `npm run typecheck` and
`npm run tokens:check` complete the set.
