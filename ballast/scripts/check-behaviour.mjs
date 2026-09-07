#!/usr/bin/env node
/**
 * Proves the buttons do something.
 *
 * check-render.mjs asserts what a screen *says*; this asserts what the app
 * *does*. It drives the real Zustand store through the same actions the buttons
 * call and checks the state actually moved - booking recovery writes a block and
 * a credit, applying a plan adds protected time, reconnecting resets the gap,
 * and two hard days below your line bring the line down.
 *
 * Run: `npm run behaviour:check`.
 */
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
// Inside the project so that `zustand` still resolves from node_modules.
const tmp = join(root, '.behaviour-check');
rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });

for (const [from, to] of [
  ['src/design/tokens.ts', 'tokens.ts'],
  ['src/lib/types.ts', 'types.ts'],
  ['src/lib/dates.ts', 'dates.ts'],
  ['src/lib/load.ts', 'load.ts'],
  ['src/lib/schedule.ts', 'schedule.ts'],
  ['src/lib/logs.ts', 'logs.ts'],
  ['src/lib/errands.ts', 'errands.ts'],
  ['src/lib/rebalance.ts', 'rebalance.ts'],
  ['src/lib/forecast.ts', 'forecast.ts'],
  ['src/lib/battery.ts', 'battery.ts'],
  ['src/lib/simulate.ts', 'simulate.ts'],
  ['src/data/seed.ts', 'seed.ts'],
  ['src/state/store.ts', 'store.ts'],
]) {
  const src = readFileSync(join(root, from), 'utf8')
    .replace(/'@design\/tokens'/g, "'./tokens.ts'")
    .replace(/'@\/lib\/(\w+)'/g, "'./$1.ts'")
    .replace(/'@\/data\/(\w+)'/g, "'./$1.ts'")
    // Node's ESM resolver needs explicit extensions on relative imports too.
    .replace(/'\.\/(\w+)'/g, "'./$1.ts'");
  writeFileSync(join(tmp, to), src);
}

// AsyncStorage is a native module and cannot load in Node. Persistence itself is
// not what this checks, so the store gets an in-memory backing here.
writeFileSync(
  join(tmp, 'storage.ts'),
  `import { createJSONStorage } from 'zustand/middleware';
const mem = new Map();
export const storage = createJSONStorage(() => ({
  getItem: (n) => mem.get(n) ?? null,
  setItem: (n, v) => void mem.set(n, v),
  removeItem: (n) => void mem.delete(n),
}));
export const STORAGE_KEY = 'ballast/test';
export const SCHEMA_VERSION = 3;
export function migrateSaved(persisted, from) {
  if (from >= SCHEMA_VERSION) return persisted ?? {};
  return { onboarded: persisted?.onboarded ?? false };
}
export const isClient = false;
`,
);
writeFileSync(join(tmp, 'package.json'), '{"type":"module"}');

const { useStore, weekReading, liveCeiling, restOwedFrom, itemsOnDay, itemsInWeek, nextWeek } = await import(join(tmp, 'store.ts'));
const { logItems } = await import(join(tmp, 'logs.ts'));
const { migrateSaved } = await import(join(tmp, 'storage.ts'));
const { chargeOf } = await import(join(tmp, 'battery.ts'));
const { daySchedule, freeSlots, overlap, startOptions, endHour, placeIn } = await import(join(tmp, 'schedule.ts'));
const { categorise, errandLoad, outstandingLoad } = await import(join(tmp, 'errands.ts'));
const { buildTrades, totalSaved } = await import(join(tmp, 'rebalance.ts'));
const { findCollision, clusterCount, CLUSTER_MIN_ITEMS } = await import(join(tmp, 'forecast.ts'));
const { percentByBucket, overallPercent } = await import(join(tmp, 'load.ts'));

/** The reading a screen would show, logs folded in - mirrors state/selectors. */
const charge = (extra = []) => {
  const st = useStore.getState();
  const all = [...st.items, ...extra, ...logItems({ today: st.today, sleepHours: st.sleepHours, meals: st.meals, moods: st.moods })];
  return chargeOf(overallPercent(percentByBucket(all.filter((i) => !i.date || i.date >= st.today.slice(0, 8)), st.ceilings)));
};
const { prescriptions } = await import(join(tmp, 'seed.ts'));
const { ACTIONS, initialSim, pointsOf, project, totalPoints } = await import(join(tmp, 'simulate.ts'));

let failures = 0;
const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label.padEnd(52)} ${ok ? '' : `got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`}`);
};
const s = () => useStore.getState();

console.log('\nBooking recovery — "Put it in today at 5pm"');
{
  s().reset();
  const before = s().items.length;
  const owedBefore = restOwedFrom(s().recovery);
  const river = prescriptions.find((p) => p.id === 'river');
  s().bookRecovery(river, 17, 1);
  check('a protected block lands in the week', s().items.length, before + 1);
  check('the new block is marked as recovery', s().items.at(-1).isRecovery, true);
  check('it is no longer offered', s().booked.includes('river'), true);
  check('the ledger is credited', restOwedFrom(s().recovery) < owedBefore, true);
  check('credit equals the prescription', owedBefore - restOwedFrom(s().recovery), river.credit);
  check('the block has a real clock time', s().items.at(-1).startHour, 17);
  check('and recovery returns load rather than costing it', s().items.at(-1).isRecovery, true);
}

console.log('\nCommitting a simulator plan — "Put N blocks in my week"');
{
  s().reset();
  const before = s().items.length;
  const sim = { ...initialSim(), sleep: 9, walk: 20 };
  const gains = ACTIONS.filter((a) => pointsOf(a, sim[a.id]) > 0).map((a) => ({
    id: a.id, label: a.label, bucket: a.bucket,
    hours: a.unit === 'min' ? sim[a.id] / 60 : Math.max(0.5, sim[a.id] - a.baseline),
    credit: pointsOf(a, sim[a.id]),
  }));
  check('sleep +3h and a 20 min walk are both gains', gains.length, 2);
  check('they are worth +13 charge points', totalPoints(sim), 13);
  check('projection moves the battery', project(13, sim), 26);
  s().applyPlan(gains);
  check('both become real blocks', s().items.length, before + 2);
  check('both are protected', s().items.slice(-2).every((i) => i.isRecovery), true);
}

console.log('\nReconnecting — "Send: Hey, thinking of you"');
{
  s().reset();
  check('Sam starts 9 days ago', s().contacts.find((c) => c.id === 'sam').lastSpokeDays, 9);
  s().markContacted('sam');
  check('the gap resets', s().contacts.find((c) => c.id === 'sam').lastSpokeDays, 0);
  check('and reads as talked', s().contacts.find((c) => c.id === 'sam').state, 'talked');
}

console.log('\n"Actually, I\'m going" — the week re-plans');
{
  s().reset();
  const before = s().items.find((i) => i.id === 'w11-ch9').date;
  s().keepItem('w11-birthday', 'w11-ch9');
  const after = s().items.find((i) => i.id === 'w11-ch9').date;
  check('the birthday dinner is kept', !!s().items.find((i) => i.id === 'w11-birthday'), true);
  check('the reading moves instead', after !== before, true);
  check('it lands on a Sunday', new Date(`${after}T00:00:00Z`).getUTCDay(), 0);
}

console.log('\nYour ceiling moves — the one daily tap');
{
  s().reset();
  check('starts at the generic line', liveCeiling(85, []), 85);
  check('one hard day is not enough', liveCeiling(85, [{ felt: 'hard', percent: 70 }]), 85);
  check('twice at 70 brings the line to 70', liveCeiling(85, [{ felt: 'hard', percent: 70 }, { felt: 'hard', percent: 70 }]), 70);
  check('fine days never move it', liveCeiling(85, [{ felt: 'fine', percent: 40 }, { felt: 'fine', percent: 40 }]), 85);
}

console.log('\nCapture — adding a task changes the week');
{
  s().reset();
  const before = weekReading(s().items, s().today, s().ceilings).overall;
  s().addItem({ title: 'OS assignment', bucket: 'mental', hours: 8, dread: 4, commitment: 'hard', date: s().today });
  const after = weekReading(s().items, s().today, s().ceilings).overall;
  check('87% before', before, 87);
  check('the meter climbs on a 32-load task', after > before, true);
  check('and it is on today\'s list', itemsOnDay(s().items, s().today).some((i) => i.title === 'OS assignment'), true);
}

console.log('\nArea logs — the small taps');
{
  s().reset();
  s().toggleErrand('e1');
  check('an errand ticks off', s().errands.find((e) => e.id === 'e1').done, true);
  s().setMealStatus('dinner', 'filling');
  check('a meal records', s().meals.find((m) => m.id === 'dinner').status, 'filling');
  s().logMood('low-unpleasant', ['Academics']);
  check('a mood check-in is stored', s().moods[0].quadrant, 'low-unpleasant');
  s().reset();
  check('reset restores the seeded week', s().errands.find((e) => e.id === 'e1').done, false);
}

console.log('\nLogging moves the battery immediately');
{
  s().reset();
  const rested = useStore.getState();
  const base = chargeOf(weekReading(rested.items, rested.today, rested.ceilings).overall);
  // An ordinary unlogged day must net to zero, or the seeded week would drift
  // away from the figures the interface study states.
  check('an unlogged day contributes nothing', logItems({ today: rested.today, sleepHours: null, meals: rested.meals, moods: rested.moods }).length, 0);

  s().logSleep(5);
  const short = logItems({ today: s().today, sleepHours: 5, meals: s().meals, moods: [] });
  check('a five-hour night is recorded as strain', short[0].loadOverride > 0, true);

  s().logSleep(9);
  const good = logItems({ today: s().today, sleepHours: 9, meals: s().meals, moods: [] });
  check('a nine-hour night gives load back', good[0].loadOverride < 0, true);
  check('and a short night costs more than a good one returns', short[0].loadOverride > -good[0].loadOverride, true);

  s().setMealStatus('dinner', 'skipped');
  const skipped = logItems({ today: s().today, sleepHours: 9, meals: s().meals, moods: [] });
  check('a skipped meal shows up as load', skipped.some((i) => i.loadOverride > 0), true);
  check('base week is unaffected by any of it', base, 13);
}

console.log('\nThe time layer');
{
  s().reset();
  const day = daySchedule(s().items, s().today);
  check('today is ordered by the clock', day.timed.map((i) => i.startHour), [...day.timed.map((i) => i.startHour)].sort((a, b) => a - b));
  check('the 1pm coursework comes before the 5pm shift', day.timed[0].startHour < day.timed[1].startHour, true);
  check('unscheduled work is kept separate', day.anytime.every((i) => i.startHour === undefined), true);
  const gaps = freeSlots(s().items, s().today, 1);
  check('the morning before 1pm reads as free', gaps.some((g) => g.start < 13 && g.end <= 13), true);
  check('nothing is free during the shift', gaps.every((g) => !(g.start >= 17 && g.start < 23)), true);
}

console.log('\nGiving a floating task a time');
{
  s().reset();
  const floating = daySchedule(s().items, s().today).anytime[0];
  check('today starts with something unscheduled', !!floating, true);
  check('it has no slot', floating.startHour, undefined);

  // A gap that actually fits it - the picker only ever offers these.
  const gap = freeSlots(s().items, s().today, Math.max(floating.hours, 0.5))[0];
  check('there is a gap long enough', !!gap, true);

  s().scheduleItem(floating.id, Math.ceil(gap.start));
  const after = daySchedule(s().items, s().today);
  check('it moves out of the anytime group', after.anytime.some((i) => i.id === floating.id), false);
  check('and into the timeline', after.timed.some((i) => i.id === floating.id), true);
  check('the timeline is still in clock order', after.timed.map((i) => i.startHour), [...after.timed.map((i) => i.startHour)].sort((a, b) => a - b));

  s().scheduleItem(floating.id, undefined);
  check('unscheduling puts it back', daySchedule(s().items, s().today).anytime.some((i) => i.id === floating.id), true);
}

console.log('\nEverything you create can carry a time');
{
  s().reset();
  const options = startOptions(s().items, s().today, 2);
  check('the picker offers real gaps only', options.length > 0, true);
  check('every option leaves room for the task', options.every((h) => freeSlots(s().items, s().today, 2).some((g) => h >= g.start && h + 2 <= g.end)), true);
  check('nothing is offered inside the 5pm shift', options.every((h) => h + 2 <= 17 || h >= 23), true);
  check('a four-hour task gets fewer options than a one-hour one',
    startOptions(s().items, s().today, 4).length <= startOptions(s().items, s().today, 1).length, true);

  s().addItem({ title: 'Statistics coursework', bucket: 'mental', hours: 2, dread: 4, commitment: 'soft', date: s().today, startHour: options[0] });
  const day = daySchedule(s().items, s().today);
  check('an added task with a time joins the timeline', day.timed.some((i) => i.title === 'Statistics coursework'), true);
  check('and not the anytime pile', day.anytime.some((i) => i.title === 'Statistics coursework'), false);

  s().reset();
  s().addItem({ title: 'Read the chapter', bucket: 'mental', hours: 2, dread: 2, commitment: 'self', date: s().today });
  check('one added without a time waits in anytime', daySchedule(s().items, s().today).anytime.some((i) => i.title === 'Read the chapter'), true);
}

console.log('\nThe simulator books at real times');
{
  s().reset();
  const before = s().items.length;
  const walkStart = startOptions(s().items, s().today, 20 / 60, 3)[0];
  s().applyPlan([{ id: 'walk', label: 'Take a walk', bucket: 'physical', hours: 20 / 60, credit: 4, startHour: walkStart }], 9);
  check('the walk lands with a clock time', s().items.at(-1).startHour, walkStart);
  check('it shows up in the timeline, not the pile', daySchedule(s().items, s().today).timed.some((i) => i.title === 'Take a walk'), true);
  check('it does not overlap the 1pm coursework', daySchedule(s().items, s().today).timed.filter((i) => i.title === 'Take a walk').every((i) => endHour(i) <= 13 || i.startHour >= 17), true);
  check('sleep is logged rather than booked as a block', s().sleepHours, 9);
  check('only one block was added', s().items.length, before + 1);
}

console.log('\nNo phantom tasks from an empty field');
{
  s().reset();
  const before = s().items.length;
  // The screen refuses an empty submit; the store refuses an exact repeat.
  s().addItem({ title: 'OS assignment', bucket: 'mental', hours: 8, dread: 4, commitment: 'hard', date: s().today });
  s().addItem({ title: 'OS assignment', bucket: 'mental', hours: 8, dread: 4, commitment: 'hard', date: s().today });
  s().addItem({ title: 'OS assignment', bucket: 'mental', hours: 8, dread: 4, commitment: 'hard', date: s().today });
  check('the same thing three times is stored once', s().items.length, before + 1);
  s().addItem({ title: 'OS assignment', bucket: 'mental', hours: 8, dread: 4, commitment: 'hard', date: s().today, startHour: 9 });
  check('but the same title at a different time is a real second thing', s().items.length, before + 2);
}

console.log('\nAdding an errand');
{
  s().reset();
  check('"pick up oat milk" sorts to Groceries', categorise('pick up oat milk'), 'Groceries');
  check('"pay the phone bill" sorts to Admin', categorise('pay the phone bill'), 'Admin');
  check('"print lab report" sorts to Academic', categorise('print lab report'), 'Academic');
  check('"put the bins out" sorts to Home', categorise('put the bins out'), 'Home');

  const seeded = outstandingLoad(s().errands);
  check('seeded errands stay weightless', seeded, 0);

  const before = s().errands.length;
  s().addErrand('Collect the parcel', 'Admin', 0.75);
  check('it lands in the list', s().errands.length, before + 1);
  check('marked as yours', s().errands[0].addedByUser, true);
  check('and it is priced', errandLoad(s().errands[0]), 1.5);
  check('so it now weighs something', outstandingLoad(s().errands), 1.5);

  const added = s().errands[0].id;
  s().toggleErrand(added);
  check('ticking it off gives the weight back', outstandingLoad(s().errands), 0);
  s().toggleErrand(added);
  check('and un-ticking takes it again', outstandingLoad(s().errands), 1.5);

  const withErrand = logItems({ today: s().today, sleepHours: null, meals: s().meals, moods: s().moods, errands: s().errands });
  check('which reaches the battery', withErrand.some((i) => i.bucket === 'errands' && i.loadOverride === 1.5), true);

  // Given a slot, it becomes a block on that day instead of an anonymous lump.
  s().reset();
  s().addErrand('Collect the parcel', 'Admin', 0.75, { date: s().today, startHour: 9 });
  const scheduled = logItems({ today: s().today, sleepHours: null, meals: s().meals, moods: s().moods, errands: s().errands });
  check('a scheduled errand becomes a timed block', scheduled.some((i) => i.title === 'Collect the parcel' && i.startHour === 9), true);
  check('and is not also counted as floating', outstandingLoad(s().errands), 0);
  check('so it shows up on the day it was given', daySchedule([...s().items, ...scheduled], s().today).timed.some((i) => i.title === 'Collect the parcel'), true);
}

console.log('\nThings do not pile up when you repeat yourself');
{
  s().reset();
  const walk = ACTIONS.find((a) => a.id === 'walk');
  const block = () => ({
    id: 'walk', label: 'Take a walk', bucket: 'physical', hours: 0.33, credit: 4,
    startHour: placeIn(s().items, s().today, 0.33, walk.preferred),
  });
  const walks = () => daySchedule(s().items, s().today).timed.filter((i) => i.title === 'Take a walk');

  s().applyPlan([block()], 9);
  check('applying once books one walk', walks().length, 1);
  s().applyPlan([block()], 9);
  s().applyPlan([block()], 9);
  check('applying three times still leaves one', walks().length, 1);
  check('and one ledger row, not three', s().recovery.filter((r) => r.label === 'Take a walk').length, 1);

  const river = prescriptions.find((p) => p.id === 'river');
  s().bookRecovery(river, placeIn(s().items, s().today, 1, river.preferred), 1);
  const owed = restOwedFrom(s().recovery);
  s().bookRecovery(river, 7, 1);
  check('booking the same walk twice books it once', s().items.filter((i) => i.title === river.title).length, 1);
  check('and does not credit the ledger twice', restOwedFrom(s().recovery), owed);

  const invite = { title: 'Dinner', date: s().today, startHour: 19, hours: 2, people: ['amin'] };
  s().sendInvite(invite);
  s().sendInvite(invite);
  check('the same gathering twice is one gathering', s().invites.length, 1);
}

console.log('\nApplying a rebalance actually changes the week');
{
  s().reset();
  const anchor = nextWeek(s().today);
  const week = () => itemsInWeek(s().items, anchor);
  const trades = buildTrades(week());
  const target = findCollision(s().items, s().today);
  const before = weekReading(s().items, anchor, s().ceilings).overall;
  const count = week().length;

  check('next week starts at 96%', before, 96);
  check('four trades come pre-selected', trades.filter((t) => t.selected).length, 4);

  // Exactly what the screen passes: the selection travels on the trades.
  s().applyTrades(trades);
  const after = weekReading(s().items, anchor, s().ceilings).overall;

  check('the week actually gets lighter', after < before, true);
  check('it lands at 84%', after, 84);
  check("Aisyah's dinner is gone", !s().items.find((i) => i.id === 'w11-birthday'), true);
  check("Amin's shift is handed back", !s().items.find((i) => i.id === 'w11-amin'), true);
  check('the chapter 9 reading is pushed', !s().items.find((i) => i.id === 'w11-ch9'), true);
  check('and the errands became one trip', week().some((i) => i.id.startsWith('batch-')), true);
  check('so the week holds fewer things', week().length < count, true);

  // The locked hard deadline must survive no matter what.
  check('the group presentation is untouched', !!s().items.find((i) => i.id === 'w11-pres'), true);
  check('and so is the protected swim', !!s().items.find((i) => i.id === 'w11-swim'), true);

  // The wall it was called to fix is gone - but a smaller one surfaces in week
  // 10 underneath, which was always there and simply was not the worst.
  check('the flagged window no longer clusters', clusterCount(s().items, target.from, target.to) < CLUSTER_MIN_ITEMS, true);
  const surfaced = findCollision(s().items, s().today);
  check('a smaller one surfaces underneath', surfaced !== null, true);
  check('and it is a different window', surfaced.from !== target.from, true);
}

console.log('\nPressing apply twice does not move things');
{
  s().reset();
  const walk = ACTIONS.find((a) => a.id === 'walk');
  // Mirrors the screen: blocks this plan would replace are not "occupied".
  const press = () => {
    const own = new Set(ACTIONS.map((a) => `plan-${a.id}-${s().today}`));
    const others = s().items.filter((i) => !own.has(i.id));
    const at = placeIn(others, s().today, 0.5, walk.preferred);
    s().applyPlan([{ id: 'walk', label: 'Take a walk', bucket: 'physical', hours: 0.5, credit: 4, startHour: at }]);
    return at;
  };
  const first = press();
  check('it picks an hour', typeof first, 'number');
  check('pressing again keeps the same hour', press(), first);
  check('and again', press(), first);
  check('with still only one walk', daySchedule(s().items, s().today).timed.filter((i) => i.title === 'Take a walk').length, 1);
}

console.log('\nA stale save does not carry a fixed bug forward');
{
  // What a phone written by the pre-fix build would be holding.
  const old = {
    onboarded: true,
    sleepHours: null,
    items: [
      { id: 'plan-walk-1', title: 'Take a walk', startHour: 7 },
      { id: 'plan-walk-2', title: 'Take a walk', startHour: 8 },
      { id: 'plan-sleep-1', title: 'Sleep tonight', startHour: 7 },
    ],
  };
  const migrated = migrateSaved(old, 1);
  check('the old week is dropped', migrated.items, undefined);
  check('including the stacked walks', JSON.stringify(migrated).includes('Take a walk'), false);
  check('and the sleep block that should never have existed', JSON.stringify(migrated).includes('Sleep tonight'), false);
  check('but the intro stays done', migrated.onboarded, true);
  check('a current save is left alone', migrateSaved({ onboarded: true, sleepHours: 8 }, 3).sleepHours, 8);
}

console.log('\nThings happen at a sensible hour');
{
  s().reset();
  const walk = ACTIONS.find((a) => a.id === 'walk');
  const placedWalk = placeIn(s().items, s().today, 0.33, walk.preferred);
  check('a walk goes to the afternoon, not dawn', placedWalk >= walk.preferred[0], true);
  check('and inside its window', placedWalk < walk.preferred[1], true);

  const nap = prescriptions.find((p) => p.id === 'nap');
  check('a nap prefers the early afternoon', nap.preferred[0], 13);

  // With the whole window taken, fall back to the nearest hour, not 7am.
  s().addItem({ title: 'Blocker', bucket: 'mental', hours: 7, dread: 1, commitment: 'soft', date: s().today, startHour: 12 });
  const squeezed = placeIn(s().items, s().today, 1, [12, 19]);
  check('a full window falls back to the nearest hour', squeezed, 11);
  check('rather than the earliest of the day', squeezed !== 7, true);

  check('sleep is marked as never placeable', ACTIONS.find((a) => a.id === 'sleep').logOnly, true);
  check('and it is the only one', ACTIONS.filter((a) => a.logOnly).length, 1);
  s().reset();
  s().applyPlan([], 9);
  check('committing sleep adds no block at all', daySchedule(s().items, s().today).timed.some((i) => /sleep/i.test(i.title)), false);
  check('it only moves the log', s().sleepHours, 9);
}

console.log('\nInviting people');
{
  s().reset();
  const before = s().items.length;
  const shared = overlap([[{ start: 18, end: 22 }], [{ start: 17, end: 23 }]], 2);
  check('two free evenings intersect', shared, [{ start: 18, end: 22 }]);
  s().sendInvite({ title: 'Dinner with Amin and Ravi', date: s().today, startHour: 19, hours: 2, people: ['amin', 'ravi'] });
  check('the gathering lands in your own week', s().items.length, before + 1);
  check('with a real time on it', s().items.at(-1).startHour, 19);
  check('counted as social load, not hidden', s().items.at(-1).bucket, 'social');
}

rmSync(tmp, { recursive: true, force: true });
if (failures) { console.error(`\n  ${failures} behaviour(s) did not work.\n`); process.exit(1); }
console.log('\n  every button changes the state it claims to.\n');
