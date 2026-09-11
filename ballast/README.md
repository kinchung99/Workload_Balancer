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
├── README.md    ← the submission: problem, ideation, prototype, feasibility
├── docs/        ← problem tree, mindmap, user flow
└── ballast/
    └── README.md  ← you are here: how it is built
```

This is the engineering documentation. For the problem, the ideation process and
the prototype links, start at the [submission README](../README.md).

---

## Quick start

```bash
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
npm run figma:canvas   # build figma/canvas.html — all 27 frames, ready to import
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
- **Every screen has a way out.** Tab screens have the tab bar; the twenty-four that
  do not now carry a labelled back control — *Areas*, *Plan*, *Recovery*, *Home*
  — and it falls back to a real destination rather than `router.back()`, because
  a link opened from a share has no history to pop. `render:check` fails if any
  route loses its exit.

---

## Time, and logging that moves the number

Four things were missing, and the first one was structural.

**The app knew what, never when.** `Item` had a date and no clock time, and the
week grid rendered a *separate seeded block list* — so the timetable on screen
was not your week. Items now carry `startHour`, the grid is drawn from the same
`items` as everything else, and `src/lib/schedule.ts` derives the rest: a day in
clock order, the gaps between things, committed against free hours.

That one addition is what makes the other three possible.

- **A day reads as a day.** Home opens on a timeline — 1pm to 5pm coursework,
  5pm to 11pm shift, with `6h free` shown as real space in between rather than
  as absence. Anything without a slot sits under *Anytime today* instead of being
  jumbled in with the fixed blocks, because a floating task is not late, it is
  unscheduled, and treating those the same is what makes a full week read as
  noise. The forecast's collision list now says `Wed 19 Nov · 9am–3pm` rather
  than just naming a day.
- **Logging moves the battery, immediately.** Sleep and meals are logged where
  you already are — one tap on waking, one per meal — and each option shows what
  it *would* do before you touch it (`8h · +7`). Under it, `src/lib/logs.ts`
  turns today's logs into signed load: a five-hour night is strain you are
  already carrying, a good one gives some back. An unlogged day contributes
  exactly zero, which is why the seeded week still reads as the study says.
- **Recovery is bookable, not fixed.** It offered one hard-coded slot and told
  you nothing until after you committed. Now you pick the length, pick from the
  gaps that actually exist in your day, and see the resulting battery *and* where
  the block lands in your timeline before anything is written.
- **A social planner that does the coordinating.** Friends carry a battery and
  real free evenings. Choose who and what, and it intersects their time with the
  gaps in your own week and offers only windows that exist. Inviting puts the
  gathering in your week as social load — seeing people occupies an evening, and
  hiding that would be the same lie every other planner tells.

### Putting things into the day, and into the list

Two follow-ons, both about the app accepting input rather than only showing it.

- **Anything floating can be given a time.** An *Anytime today* task now carries
  a **Give it a time** control that offers only the gaps it would actually fit
  into — a four-hour task is never offered a two-hour hole. Scheduled blocks get
  **Move** and **Unschedule** in return. It is tap-to-place rather than
  drag-and-drop on purpose: dragging is fragile across touch and mouse in React
  Native Web and effectively unusable with a screen reader, and the tap version
  is the one that works everywhere.
- **Errands can be added, and they count.** A real field replaced the dead
  microphone. What you type is sorted into Groceries, Admin, Academic or Home by
  the same kind of keyword dictionary the capture parser uses — shown as a chip
  you can tap to change, never applied silently — and priced by a size you pick.
  **Your** errands then weigh something against the errands ceiling, and ticking
  one off gives the weight back. Seeded errands stay weightless so the study's
  figures still hold exactly.

  That last part is the app's own thesis applied to its smallest objects:
  burnout is rarely one big item, it is a pile of twenty-minute ones nobody was
  counting. A checklist that costs nothing to keep would have contradicted the
  entire premise.

### Making it time-specific end to end

The time layer existed but only the *seed* used it. Everything a student created
came out timeless: `/add`, the intro and the simulator all called `addItem`
without a `startHour`, so anything you made landed in an undifferentiated pile.
That is now closed on every path.

- **Capture asks when.** `/add` has a **day** chip and a **time** chip. The time
  picker lists only the gaps that would actually hold the thing, and *No time
  yet* is a first-class answer rather than an omission — some work genuinely has
  no slot, and pretending otherwise is what makes a calendar lie.
- **Gaps are where you add things.** Every free stretch in a day is a button:
  `6h free · + Add here` opens capture with that day and hour already filled in.
  So "what can I add, and to when" has a literal answer you tap.
- **Plan is a week planner, not a picture.** The fortnight strip is now a day
  picker showing dates, and below it sits that day in full — committed against
  free hours, the timeline hour by hour, gaps open for adding, and a flag when
  the day is part of the collision. The forecast still does the thing only a
  forecast can, but you can now walk into any of the fourteen days and see
  exactly what it holds.
- **Actions says what it will do.** A **What this puts in your week** list names
  each block and the time it would take before you commit — and the blocks now
  get real slots, chosen so they do not collide with each other or with your day.
  Sleep is committed as a log rather than a block, because it is the night, not
  an appointment. The confirmation shows the updated day rather than a count.

### Repeating yourself does not pile things up

Three related bugs, all found by driving the store the way a person does rather
than the way a test does.

**Things accumulated.** Applying the same simulator plan three times left three
walks stacked at 7am, 8am and 9am, and the ledger credited all three. Plan blocks
now carry an id that is stable per activity per day, so re-applying **replaces**
rather than appends. Booking the same recovery twice books it once; proposing the
same gathering to the same people on the same evening is one gathering.

**Things happened at the wrong hour.** Placement used "first free gap", which for
Amira's Monday is 7am — so a walk, and anything else, went to dawn. Every
activity now carries the window it belongs in: a walk 12–7, a nap 1–4, a swim
7–10, an evening off 6–10. When that window is genuinely full, the fallback is
the *nearest* hour to it rather than the earliest of the day, which is the actual
line that produced the 7am river walk.

**Sleep was being treated as an appointment.** It is the night, not a block, and
placing it on a timeline is how it ended up scheduled for the morning. `SimAction`
now carries `logOnly`, sleep is the only thing that has it, and committing a plan
moves the sleep *log* while never creating an item. Applying a plan of nothing but
sleep adds no block at all — which is asserted.

A day built entirely by pressing every button now reads:

```
10am  Nap, 25 minutes
11am  Walk the river loop
12pm  Take a walk
1pm   Operating systems, part 2
5pm   Café shift
7pm   Dinner with Amin
```

One of each, in a plausible order, however many times you tapped.

### Why a fix can look like it did not work

Two things survived the de-duplication work, and one of them is the reason a
phone can still show the old bug after the code is right.

**Saved state outlived the fix.** State persists to the device, so a browser that
had already stacked three walks at 7am — or written a *Sleep tonight* block from
before sleep became log-only — kept them forever. Correct code cannot clean data
the old code wrote. The store now carries a `SCHEMA_VERSION`; raising it drops
saves written by older builds and starts from the seeded semester again, keeping
only whether the intro has been seen. Anyone on a stale save is repaired on their
next load, with no cache-clearing and no reinstall.

Raise `SCHEMA_VERSION` in `src/state/storage.ts` whenever a fix changes what a
saved week may legitimately contain. It is the difference between fixing a bug
and shipping a fix.

**Applying twice moved things.** De-duplication stopped blocks *accumulating*,
but placement still read the previous block as occupied territory, so a walk hopped
12pm → 10am → 12pm on repeated presses. Placement now excludes the blocks this
same plan would replace, which makes it idempotent: press apply five times and the
walk stays at 12pm.

### The week you could not see, and a button that did nothing

**Apply on the rebalance sheet changed nothing at all.** The screen kept its
selection in local React state and passed it down on the trades; the store read a
different field — `state.trades` — that nothing ever wrote to. The set of taken
trades was therefore always empty. You could toggle four things, watch the meter
fall to 84%, press Apply, and the week was exactly as before. The selection now
travels on the trades themselves, and applying routes through the same
`applySelection` the preview uses, so the batched errand trip is created rather
than the errands simply vanishing.

**The rest of the week was invisible from Home.** A week strip now sits above
today: seven bars scaled against the heaviest day, dates, committed hours, today
inverted, collision days tinted red, and each one tappable straight into that day
on Plan. Under it, a one-line collision banner. `M 10 · 10.3h`, `T 11 · 6.8h`,
`W 12 · 9.5h` — the shape of your week in one glance.

**The collision was a list of four rows**, which reads as four ordinary tasks —
and they *are* ordinary, which is the point. It is now three columns, one per day
of the seventy-two hours, with each item placed on its day, load bars per column,
and hard versus movable colour-coded with a legend. The pile-up is a shape now
rather than a description of one.

**The ledger stacked debts and credits into one pile.** Split into *What you're
down* and *What you've banked*, each row with a bar scaled against the largest, a
single owed-versus-banked bar under the balance, and the "last full day off"
line pulled out as its own card.

**Rebalance now says what a trade costs and buys.** Every row carries the day and
hour of the thing it touches. A week strip previews next week as it would be if
you applied, with chips for each day that gets lighter (`Wed 19 −7h`). And the
confirmation answers the question the screen exists for: whether the wall it was
opened to fix is gone.

That last one exposed a real subtlety. Clearing week 11 makes a *smaller* Monday
to Wednesday cluster surface in week 10 — it was always there and simply was not
the worst. Reporting "the wall is still there" would have been wrong, so the
check is scoped to the flagged window and a separate line names whatever surfaced
underneath.

### Charts that were not drawn, and a task that added itself

**The forecast chart was missing entirely.** Its bars are SVG, SVG needs a
numeric width, and the width came from `onLayout` — which reports nothing during
prerender. So the served HTML contained day letters and no chart at all, and the
graph only appeared once JavaScript had run, if it ran. Charts now start at the
artboard width and let the real measurement refine them. The Plan page went from
8 SVG elements to 22. The same gate was on `Bar` and on the battery fill.

**Pressing "Add it" on an empty field added "OS assignment".** The placeholder is
a worked example, but the submit read `text || PLACEHOLDER`, so an empty field
committed the example — once per press. That is where the repeating phantom tasks
came from. The button now refuses an empty field and says so, and `addItem`
rejects an exact repeat of the same title on the same day at the same hour while
still allowing the same title at a *different* time, which is a real second thing.

**The headline battery did not look like a summary of anything.** It is a blend
of five areas and was drawn as one solid fill. It is now five cells, one per
area, each filled to its own level — mental flat, physical nearly full — with the
five numbers underneath and a line saying what the blend is. The picture is the
composition.

**Everything that adds now asks when.** Recovery could only ever be booked into
today; it takes any of the next five days, with the gaps recomputed per day and
the preview and timeline following the day you pick. Errands take a day and an
hour too — given one they become a real block on that day rather than an
anonymous lump of load, and they are then counted there instead of twice.

### A deadline is not a task

The list showed things on the day they were due, which is the reason a to-do list
can look empty right up until the night it ruins. An assignment due Thursday is
not a Thursday task; it is nine hours spread across the days before Thursday.

Anything with preparation now carries a deadline, an estimate, a difficulty and
an importance, and it sits on **every** day's list from now until it is due —
showing how much is left rather than a tick box that is false until the end. It
disappears the moment the work is done.

```
ANYTIME · 1 loose + what is owing
Emails I have been avoiding   Mental · 4h left of 4h · 2 days left   100% undone
  [Schedule it]  [Plan 3 sessions for me]  [Push to tomorrow]
Algorithms problem set        Mental · 3h left of 4h · 3 days left    75% undone
```

Four things you can do to a row: put a sitting on this day at a time that is
actually free, have the sittings planned across the days before the deadline,
push it to another day, or log the hours you already did — which is what makes
the percentage fall.

**"Plan it for me" is a scheduler, not a model call.** It runs offline, it is
explainable, and every session can be justified: at most two hours a sitting,
never more than one sitting per day per pass so the work is spread rather than
crammed, and it leaves the day it is due clear if it possibly can, because
handing in is not the same as finishing. It also says what it *cannot* fit —
`2h will not fit before the deadline` — rather than quietly dropping it. The
same honesty as the parser: rule-based, and labelled as such.

One thing it can tell you that no list does: whether there is genuinely enough
free time left before the deadline. If not, the row turns red and says so.

## The timetable, made real

The interface study calls the timetable "imported, zero effort", and the build
took that literally: fourteen hours a week as a **single item marked `spread`**.
It counted towards the load and appeared nowhere in the week — the fullest part
of a student's day, invisible on the one screen meant to show their day.

It is now eight real classes with a time, a length, a room and a module. Same
fourteen hours at the same dread, so the study's figures are untouched — but
Monday now opens with *Operating Systems lecture, 9am–11am, Kilburn LT1* instead
of a number you could not look at.

### Dread belongs to the module

You do not dread Tuesday. You dread networks. Dread and importance live on the
**module**, and setting either re-prices every class in it at once — which is the
only way to keep the number honest without asking for a rating on all fourteen
contact hours.

### Why an hour can be worth more than its length

A lecture is an hour of load like any other **until it is the one where the exam
hints get given**. Three flags say so:

| Flag | What it changes |
|---|---|
| **Gives exam tips** | Never proposed for moving, and it cannot be dragged off its slot |
| **Sets coursework** | Adds *"Anything set in this one?"* — capture at the moment work is announced |
| **Attendance counted** | Feeds the register, and warns before you cross the line |

The first is the point of the whole feature. The lecture where the hints get
given is the first thing a stressed student drops and the last thing they can
afford to, so the rebalance sheet lists it **locked**, like a hard deadline —
refusing visibly rather than silently.

### Attendance, only where somebody is counting

Each module carries what the department expects, or `null` when nobody is. The
screen warns at *"one more absence takes you under 80%"* rather than after, and
claims nothing about modules with no policy.

### Import is a paste, not a scan

Every portal copies as text and every student already has that text. A parser
reads the day, the time, the module code, the kind and the room from whatever
shape it arrives in — `Mon 09:00-11:00 CS2040 … Kilburn LT1`, `Thu 8-10am`,
`in Lab A`. **A line it cannot read is handed back on screen rather than dropped**,
so nothing disappears quietly.

Scanning was the obvious alternative and was rejected for the same reason as the
LLM parser: OCR needs a camera, a permission dialogue and usually a network, and
this app works in a basement lecture theatre.

## One thing, five areas

The model's oldest simplification was **one bucket per task**. A group
presentation was filed under "mental" and that was that.

It is the assumption that lets a week read 60% while the person is finished. A
group presentation is not mental. It is heavy mental, real time, and a social
cost most people would never have thought to name — and filing it under one
heading throws away exactly the thing the five areas exist to show.

Capture now asks all five. `Item.mix` is a weight per area, `loadByBucket`
splits the load in those proportions, and every bar, battery, ceiling and warning
in the app is downstream of that one function.

**The total does not change.** `load = hours × dread` still holds, and dread is
read off the mix rather than asked for separately: it is the **worst** area, not
the sum. Three areas at "a fair bit" is still dread 4, landing in three places —
not dread 12.

That distinction is the whole point, and it is arithmetic you can check:

| Same 4 hours, same dread 3 | Where it lands | Overall |
|---|---|---|
| All mental | 12 mental | higher |
| Mental + time + social | 4, 4, 4 | lower |

Overall is `(mean + worst) / 2`, so spreading a load lowers the worst without
touching the mean. A thing that hits one area hard genuinely is more dangerous
than one spread thin — which is "shape beats total", finally available at the
moment the thing is written down rather than only in the weekly reading.

The honest other half, also asserted: spreading into a **smaller** ceiling reads
*higher*. Four load of social is a quarter of Amira's social ceiling and a
twenty-fifth of her mental one. Per-area ceilings are what make that true, and if
the model did not say so they would not be worth having.

### Where it shows up

- **The battery and the five areas** — automatically, through `loadByBucket`
- **The day's list** — rows read *"Mental & social · 12"* rather than a single heading
- **Recovery** — the prescription screen orders suggestions by the area that still
  has room. Drain physical with the dials and physical stops being the area with
  room, so a different kind of rest leads. That loop is what makes the dials mean
  something beyond a prettier form.

Fixing the ordering exposed that the seeded prescription list had never been
ordered at all — it was offering the river walk first because it was written
first, and matching the screen's own sentence by coincidence.

## Capture, as four pages

Capture is the screen with the highest drop-off in any planner ever built, and
the reason is always the same: **it looks like a form**.

Everything used to be on one scroll. That sounds efficient and reads as homework
— you cannot answer the first question without seeing the other six waiting.

| Page | Asks | Why there |
|---|---|---|
| **1 · What** | One box, or a drawing to start from | Nothing else until there is a thing |
| **2 · How big** | Turn up, or work first? Then hours | Everything after this depends on which |
| **3 · What it takes** | Five dials, five faces | The load, where it actually lands |
| **4 · When** | Day, time, can it move | And the battery, before you commit |

The shape question moved to page two deliberately. An interview is an hour you
turn up to; an assignment is hours spread across the days before it. Which one it
is changes what every later page should ask, so asking it late made the rest of
the form guess.

Each page is also a **real route** — `/add/takes` opens on the dials — which is
worth having twice over: a link can point at one question, and the static export
renders each page separately, so all four are covered by `render:check` instead
of only the first. The flow itself is local state in one component, so moving
between pages never risks what you have typed.

`/add` stays a flat `add.tsx` rather than `add/index.tsx`. Static hosting serves
a directory index at `/add/` only, so the folder version made the canonical link
every other screen uses answer **404 on a cold load** — fine while clicking
around, broken the moment somebody refreshes or shares it.

### A dial with a face on it

Nobody has to learn what "dread 4" means to answer *"how much does this take out
of you?"*. The knob carries a small character — serene at nought, dizzy at five,
with a bead of sweat from four up.

Strained, never scolded. This is the face of the **task**, not of the person
holding the phone, which is the same line the mascot holds: there is no frown at
any battery level, but a thing that flattens you is allowed to look like it.

### Colour that cannot lie

The app has one hard rule — **colour on a reading means which band it is in** —
and "make it colourful" is exactly the request that quietly breaks it.

So decoration got its own namespace. `color.decor` is seven candy hues used for
stickers, confetti and the wash behind a heading, documented on `/foundations`
as *"a decor hue on a bar, a number or a meter is a bug, not a style choice"*.
The rule is now more checkable than it was before, not less.

Area hues on the dials are the existing identity palette doing its existing job:
which area, never how much. The load those dials produce is still shown in band
colour.

### Drawings, not GIFs

Twelve stickers, drawn as SVG. A GIF would need a network, an asset pipeline and
a licence; each of these is a few dozen bytes that renders identically offline,
in a static export and on a Figma frame. The motion is real motion — a slow lean
either side — and it stops dead under Reduce Motion.

## Looking like something you would open

The app read as an audit. It was accurate and slightly grim, and an app that only
ever reports that your week is heavy is one you stop opening — which is a design
failure whatever the numbers say.

### A character, because the brief already argued for one

The literature review in the brief is two apps built on a character: Forest's
tree and Study Bunny's rabbit. Both work for the same reason — you read how you
are doing **before you read anything at all**, and a drawing carries a tone a
percentage cannot.

So the battery has a face. Four states, and the important part is that it is
**sympathetic at every one of them**: bright-eyed and rosy at 78%, heavy-lidded
at 22%, a small open "oh" at 8%. There is no frown at any charge. A heavy week is
information, not a failure, and the character is a companion who is also tired —
never a judge. Getting that wrong would have made the app worse than plain.

### Colour, without breaking what colour means

Each area now owns a hue and a glyph: mental violet, time cyan, physical olive,
social magenta, errands graphite. They appear **only** on icons and tile washes.

That constraint is not decoration. Colour in this app already means which band a
reading is in, and letting five more hues onto bars and numbers would quietly
break the accessibility system everything else rests on. Hues were picked for
separation from the four band colours and checked for it — every one clears 4.5:1
on its own wash, and the only tight pair, cyan against recovery blue, differs
sharply in lightness and never appears as a competing signal.

### One reward, and no streaks

Logging something good now sets off a short confetti burst. It is the **only**
reward mechanic in the app and it fires only for something you actually did.

No streaks, no score out of ten, no badges — those punish exactly the weeks this
app exists for, and the study rules them out explicitly. Game *feel* was the goal;
game *pressure* was not.

### The rest

Pill buttons, softer cards, bigger numbers, and the five spot drawings. Home is
now a face, a number and a word, above five colourful tiles — still 208 words.

## Saying less

Most of the words on these screens were justifying a design decision to someone
reading it for the first time. That is worth saying once and then never again, so
it moved: into code comments, into this file, and into a `Reveal` — a labelled
disclosure that keeps the reasoning one tap away instead of on screen forever.

Measured on the rendered output:

| Screen | Before | After |
|---|---|---|
| Home | 335 words | **209** |
| Tonight | 285 words | **173** |
| Plan | 326 words | **263** |

Home now opens on the thing itself — a segmented battery, `13%`, *Running on
empty* — with *What this number is* underneath for anyone who wants it. The five
areas became a row of icons and percentages; "what's pulling you down" became two
chips; the recovery suggestion became a card with a drawing and three words.

### Drawings, not pictures

The brief asked for images or GIFs. Everything here is drawn as SVG instead, and
that is a deliberate refusal rather than a shortcut: a photograph or an animation
would need the network, would break the offline promise the rest of the app
makes, and would be the one element on screen that cannot follow the theme or
survive a greyscale print.

So there are five spot drawings — a clear sky, a moon, a tick, an empty frame,
three stacked bars for a collision — on the same palette as everything else, and
five area glyphs. The glyphs are **shape, not colour**, because colour in this app
already means which band a reading is in, and giving the areas their own palette
would quietly break the one rule the accessibility work rests on.

### A limit worth knowing

Content inside a `Reveal` is not in the served HTML until it is opened, so
`render:check` asserts the *labels* and leaves the copy to the behaviour suite.
Anything hidden behind a tap is verified by what it does, not by what it says.

### Sleep says when, not only how long

The slider read *6 hrs* and nothing else, which is the half of the answer that
does not decide anything. Six hours is fine or impossible depending entirely on
what time tonight finishes.

Waking is now pinned to tomorrow's first commitment — an hour before it — and
bedtime follows, shown on the slider itself rather than after you move it:

```
Sleep tonight   6 hrs
BED BY 1am  →  TO BE UP AT 7am     FIRST THING 8am
That is past midnight — fine once, expensive as a habit.
```

Three states, and the middle one is the reason it exists: it fits, it is past
midnight, or **it cannot happen** — *"Tonight runs to 11pm, so 12h is not
available. Shorten the night, or move what runs late."* A number that quietly
asks the impossible is worse than no number.

### Choosing the hour, not accepting it

Blocks on the Tonight screen were placed for you and stayed there. Each row now
carries **Change time**, offering every free hour after your off-hour, with the
app's own choice marked — and *Back to the suggestion* if you change your mind. A
hand-picked hour always wins over the automatic one.

### One list for everything you just do

There were two parallel lists for the same kind of thing. Capture's *just turn
up* made an item; the errands screen made an errand; neither knew about the
other. So a task you typed in one place was invisible in the other, and an errand
without a time was an anonymous lump of load rather than something you could see
on the day it was for.

They are one list now. Whatever you add — from capture or from the errands screen
— lands on a day, appears in **that day's list** and under **Tasks & errands**,
and is ticked off in either place.

Two details that had to come with it:

- **A task carries its own area.** Not everything you turn up to is an errand: an
  interview costs mental, a birthday costs social. The list holds one-off tasks of
  every kind and the bucket keeps the load honest.
- **Each one shows on its own day.** They used to be summed into a single
  *Errands you added* row unless they had a time, so a thing you had written down
  could not be found on the day it was meant for.

### Protected recovery is movable

A booked recovery block had a fixed hour and no way to change it, which read as
the app deciding your afternoon. *Protected* was only ever meant to mean work is
planned around it — not that the hour is beyond question.

Every block now offers **Move this block** and **Give it back**, and the picker
marks where the app *would* put it — `2pm ·` with *"2pm is where it would go on
its own. Any of these work."* — so it guides without deciding.

### Sharpening the deadline rows

- **Progress is its own control.** It was buried at the bottom of the planning
  sheet, which is a different job entirely. The row now carries
  `Plan it` and `Progress · 25%` side by side, each opening only what it needs.
- **Booking one by hand is folded away** behind *Or book one yourself*, so the
  planning sheet is short by default.
- **Sittings go on the lightest days.** The planner worked in date order, which
  piled work onto whatever came next — including days that were already the
  heaviest of the week. It now sorts the candidate days by what they already
  carry, and the preview says so: `Wed 12 Nov · 2pm–4pm · 2h (4h already booked
  that day)`.
- **"Push to tomorrow" moves the work, not the deadline.** It used to move the
  due date, which is the one thing a student cannot do. It now moves that day's
  sittings onto tomorrow's list and leaves the deadline where the world put it.

### Picking a date, not a chip

*Due by* offered ten fixed days. Deadlines are months out as often as they are
days, so it is a month grid you can page through, with a typed entry beside it —
`14/3`, `14/3/26` or `2026-03-14` all work — and nothing before tomorrow is
selectable.

### Errands weigh what you say they weigh

Twenty minutes at the bank is not twenty minutes of walking, so effort is yours
to set — *Easy*, *Normal*, *Dreading it* — and the load is shown as you choose it.

And **finishing one always moves the number**. Clearing your own errand stops it
costing you, which already worked; a seeded one never cost anything, so ticking
it off did nothing at all. Both now pay out the weight of the thing, because a
list where completing something changes no number is a list nobody keeps.

### Tonight, on your own schedule

- **Nothing is booked before your day is yours.** *My day is my own from* takes
  3pm to 8pm and every block on the screen respects it — a run at 11am is not a
  plan for someone who finishes at five.
- **Your evening, in the model.** The shipped five were a starting point, not a
  claim about anyone's life. *Add your own* turns badminton, a night run or band
  practice into a slider like the rest, booked after your off-hour, removable
  again. Presets set the five they know about and leave yours alone.

### A battery you can actually move

Amira starts at 13% because that is the week the interface study describes, but
a number that only ever sits near empty stops meaning anything — it just reads as
a verdict. The seeded baseline is unchanged; what changed is how far the good
things move it.

- **Good moments are worth roughly twice what they were**, and there are eight of
  them now — *helped someone* and *actually rested* joined the list.
- **The hard cap is gone.** It made the number feel rigged: past twelve, nothing
  you did counted. In its place, each *repeat of the same kind* is worth less
  than the last — the fifth laugh is not the first. A genuinely varied day counts
  fully, and tapping one button twenty times tails off to nothing. Both are
  asserted.
- **You say why.** Picking a moment opens a field in your own words, with
  prompts under it — *"Something my flatmate said"*, *"Asked for help"*,
  *"An evening with nothing in it"* — and the reasons are listed back under
  *Today's good bits*, which is the part worth reading in a bad week.

A recovery night now reads **32% `+19`** against a balanced night's **23% `+9.5`**,
so the choice between them is visible rather than nominal.

### One evening, and only one

*Tonight* silently spanned whatever day you were on and accumulated. Booking a
walk-and-message plan and then a walk-only plan left the message behind, because
applying cleared only the blocks in the current press. Repeat that a few times
and the day fills with protected recovery.

A day now owns exactly one plan: applying **replaces** it, the screen names the
evening it is working on (*Tonight*, *Tomorrow*, or a date), lists what is already
booked there, and offers *Clear this evening*. The button says which it is doing —
`Book tonight — 2 things` or `Replace tonight — 2 things`.

### Buttons that go where they say

`Screen`'s back control popped history whenever there was any, so a button
reading **Home** took you to whatever you last looked at instead. It now goes to
the destination it names. Fourteen routes were affected.

### Nothing outlives a reload

Every launch starts from the seeded semester. Only whether the intro has run is
saved. A week you can accidentally wreck and cannot get back is worse than one
that forgets — the demo is repeatable, nothing half-finished carries over, and a
bug fixed in code can no longer be kept alive by data written before it.

### Planned is not the same as done

The bar tracked only what was finished, so booking three sittings changed nothing
about how alarming a piece of work looked. But a plan genuinely *is* different
from an intention, and the screen should say so.

It now tracks three states at once — done, booked into a day, and neither — as
one bar with the numbers under it. Booking takes work out of the unplanned part
even though none of it is finished; giving the sitting back puts it straight in
again.

```
Algorithms problem set   Mental · due Thu 13 Nov · 3 days left   75% unplanned
1h done   0h booked   3h with no plan
```

**Progress is a percentage now**, not `+30m done` — because "about half way" is
how people actually hold it in their heads, and hours are a translation step
nobody wants to do. The hours are still shown underneath.

**Every sitting takes a note.** *Finish section 2* is the difference between a
block of time and a plan, and it is the thing that makes a booked hour usable
when you get to it.

**Preparation hours are no longer capped at twelve.** Presets up to thirty with a
stepper past that, and above twelve it says what that means in sittings: *"20h is
10 sittings at two hours each. Worth checking the deadline gives you that many
days."*

**The two kinds of "not at a time" are now separate blocks.** *Owing before a
deadline* — which sits there every day until it is done — is nothing like
*Today's list*, which is loose things for that day only. Stacking them together
is exactly how a deadline hides among the errands.

### The battery can go up

Everything else here measures what a week takes out of you, and a battery that
only ever falls is both bleak and inaccurate. Days do go well.

The mental area now has one-tap good moments — *properly laughed*, *finished
something*, *proud of myself*, *got outside* — each worth a small credit in the
area it belongs to, showing on the battery immediately. Reconnecting with someone
on the social screen logs one too, because reaching a person you had dropped is
social recovery whatever else it is.

They are deliberately small, and capped at +12 a day. Without a cap, tapping
"laughed" twenty times would read as a well-rested week, which is exactly the
self-deception this app exists to prevent.

### Adding to a day that is not today

Capture could already reach any day, but only by tapping a date chip to reveal a
picker — so it read as a today-only screen with an option hidden inside it.
Adding to Thursday is the normal case, not an advanced one. **Which day?** is now
a permanent section with seven days in view and the free times for whichever is
selected, and *Anytime that day* stays a real answer.

When a day has no gap long enough it now says which of the two problems that is,
rather than showing a bare `0 FREE`: *"No gap on Thursday is 8 hours long. Leave
it anytime, shorten it, or mark it as needing preparation and have the sittings
planned across several days."*

### What the Tonight tab is for

It was called **Actions** and opened on *"What if I…"* over five sliders, which
says nothing about why you would use it. The tab is now **Tonight** and the
screen states its own purpose in a line:

> Every other screen tells you what already happened. This one is the rest of
> today: choose how you spend it, see what it costs or gives back, and book it
> only if you want to. Nothing is saved until you press the button.

Sliders are precise and abstract, and most people are not dialling in a night —
they are choosing a *kind* of night. So three presets sit above them, each
showing where it would leave you before you pick it:

| | |
|---|---|
| **A recovery night** — early night, a walk, one message sent | **26%** `+13` |
| **A balanced night** — some work, some rest, phone down by eleven | **17%** `+4` |
| **Push through** — four hours of work and a short night | **1%** `−15` |

Picking one sets every slider; the sliders are still there to adjust from. And
the screen now shows *where the blocks would land* on today's timeline, so
"book it" is a visible change to a real evening rather than an abstraction.

### One model correction this exposed

The study's fourth band is *"Recovery — load you get back"*, but recovery items
were **adding** load: booking a swim made the battery worse. `loadOf` now returns
a negative figure for anything marked `isRecovery`, so booking rest raises the
battery, which is the only behaviour that makes the feature mean anything. Week
11's physical bucket moved by four points as a result and the seed was retuned to
keep the study's figures exact — `model:check` still passes all thirteen.

---

## One style, everywhere

Capture got the four-page treatment first and it worked, so the rest of the app
now opens the same way: **a drawing on a coloured disc, a short title, one line
under it.** That is `PageHeader`, and it exists as a component precisely so the
app cannot drift back into fifteen slightly different headings.

`src/design/screens.ts` holds the map — which sticker and which colour each
screen gets — for the same reason. A screen's colour identifies the screen, the
way its drawing does.

### Two illustration systems became one

There were two: `Spot`, five muted abstract drawings on the band palette, and
`Sticker`, the cute ones with faces. Two visual voices on one app reads as an
accident, so `Spot` is gone and its five moments moved across — a clear day is
now a sun, a pile-up is a stack of blocks with a slightly worried face.

Twenty-two stickers, all SVG, all offline, the whole sheet on `/foundations`.

### The colour rule survived being asked to be colourful

Ballast has one hard rule — **colour on a reading means which band it is in** —
and "make it colourful" is the request that quietly breaks it.

Decoration has its own namespace, `color.decor`, and the header washes come from
it. Nothing is ever read off one. The five areas keep their own identity hues on
their own screens, which is the job those hues already had. Anything carrying a
value is still band-coloured, and `/foundations` states the rule with the
palette next to it.

## Screens that were doing too much

Three screens were a single scroll doing three jobs. Each is now short pages,
with every feature intact.

| Screen | Was | Now |
|---|---|---|
| **Tonight** | 604 lines: day, off-hour, presets, sliders, what-it-books, timeline, custom activities | **Which night** → **What you do** → **Book it** |
| **Recovery** | activity, duration, day, time, preview, timeline, all at once | **What would help** → **When does it go** |
| **Timetable** | week, modules and a hidden import toggle | **Week** · **Modules** · **Import** |

The Tonight split is the one that matters. Choosing an evening, deciding what is
in it, and committing to it are three different decisions, and the old screen
made you scroll past the third while making the first.

### Steps and tabs are not the same control

The timetable's three are **tabs**, not steps: week, modules and import are three
views of one screen and any of them can be first. The others are **sequences** —
you cannot pick a time before saying what the thing is.

`StepDots` now draws both, and the difference is behavioural rather than
decorative: a sequence only lets you go back to pages you have answered, tabs let
you go anywhere. Building the timetable as a sequence first made its middle page
**unreachable** — no forward jump and no next button — which is exactly the bug
that distinction prevents.

### Routes, again

Every split screen keeps the pattern capture established: a flat route for the
screen, plus `[step].tsx` beside it as a second way in. `/tonight/book`,
`/timetable/modules` and `/prescription/when` all open where they say.

Worth it twice over. A link can point at one question, and the static export
renders each page separately — so `render:check` covers **26 pages** rather than
the first page of each of nineteen screens. Splitting a screen without this would
have quietly halved the coverage.

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

The fake surfaces that remain are labelled as such: the microphone button on the
physical screen is an affordance with no speech API behind it (the errands one
was replaced by a real field), and the step and cohort figures are seeded. Those are documented in
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
| A component hard-codes a number | `render:check` asserts 325 strings against real output |
| A button silently stops working | `behaviour:check` drives the store through all 259 actions |
| A fix cannot reach devices holding old data | `SCHEMA_VERSION` drops incompatible saves on next load |
| A screen becomes a dead end | `render:check` asserts all 24 non-tab routes carry an exit |
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
│   ├── timetable.tsx           Classes, modules, flags
│   ├── add.tsx                 Capture, page one
│   ├── add/[step].tsx          …and a way into any of its four pages
│   ├── tonight/[step].tsx      Tonight, opened at a chosen page
│   ├── timetable/[step].tsx    Week · modules · import
│   ├── prescription/[step].tsx What would help · when it goes
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
│   │   ├── screens.ts          Which drawing and colour each screen opens with
│   │   └── figma.ts            The Figma bridge: rules, frame map, component map
│   ├── components/
│   │   ├── primitives/         Stack Text Card Button Chip Toggle Divider
│   │   │                       DreadDots ItemRow Slider Checkbox MoodGrid AreaTile
│   │   │                       AreaDial StepDots Sticker Reveal DatePicker
│   │   ├── charts/             BandPattern Bar Battery ForecastStrip WeekGrid
│   │   └── layout/             Screen PageHeader StepNav TabIcon
│   ├── features/
│   │   ├── home/CalmMode.tsx
│   │   ├── add/Capture.tsx     The four-page capture flow
│   │   ├── tonight/Tonight.tsx The three-page evening planner
│   │   ├── timetable/          Week, modules, import
│   │   ├── recover/Prescribe.tsx  What would help, and when
│   │   └── areas/              Mental Time Physical Social Errands
│   ├── lib/                    The model. No React in this directory.
│   │   ├── load.ts             load = hours × dread, the five-area mix, bands
│   │   ├── battery.ts          charge = 100 − load%, drains, labels
│   │   ├── simulate.ts         What-If actions and the projection
│   │   ├── forecast.ts         14-day strip, clustering detection
│   │   ├── rebalance.ts        Trade generation and pricing
│   │   ├── parser.ts           Plain-language capture, regex + keywords
│   │   ├── timetable.ts        Paste-import parser, attendance, class flags
│   │   ├── drafter.ts          Three-tone decline messages
│   │   ├── dates.ts            ISO/UTC helpers, deterministic
│   │   └── types.ts            Domain types
│   ├── data/seed.ts            The fictional semester. Built first, not last.
│   ├── state/store.ts          Zustand store + plain selectors
│   └── hooks/                  useReducedMotion
│
├── figma/
│   ├── tokens.json             W3C DTCG. The source of truth for every value.
│   └── canvas.html             Generated: 27 frames, one page, import-ready
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
npm run figma:canvas          # writes figma/canvas.html — all 27 frames
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
figures against the model, and `npm run render:check` asserts 325 strings against
the rendered HTML of all twenty-six pages, and `npm run behaviour:check` asserts
259 state changes behind the buttons.

---

## Verification

There are no unit tests, and that is a deliberate trade for a frontend study: the
two scripts below check the things that would actually be wrong.

- `scripts/check-model.mjs` — loads the real `seed.ts` and `load.ts` through
  Node's native TypeScript stripping and asserts the study's numbers. It catches
  a seed edit that silently moves Amira off 87%.
- `scripts/check-behaviour.mjs` — drives the real Zustand store through the
  actions the buttons call and asserts the state moved: 259 checks covering
  booking, plan-committing, reconnecting, re-planning, ceiling recalibration,
  capture with and without a time, the area logs, the time layer, scheduling,
  errands and inviting people. Several assert that a slot is never offered
  unless the gap genuinely fits — offering a time that does not exist is worse
  than offering none — and a block of them presses the same button three times
  to prove nothing accumulates.
- `scripts/check-render.mjs` — statically renders every route, strips the HTML
  (keeping `aria-label` values, since a spoken chart is rendered content too) and
  asserts the figures reach the screen. It catches a component that hard-codes a
  percentage the model never produced.

Both run in CI without a device or a simulator. `npm run typecheck` and
`npm run tokens:check` complete the set.
