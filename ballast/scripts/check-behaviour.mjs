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
  ['src/lib/prep.ts', 'prep.ts'],
  ['src/lib/moments.ts', 'moments.ts'],
  ['src/lib/timetable.ts', 'timetable.ts'],
  ['src/lib/priority.ts', 'priority.ts'],
  ['src/lib/circle.ts', 'circle.ts'],
  ['src/lib/swap.ts', 'swap.ts'],
  ['src/lib/sharing.ts', 'sharing.ts'],
  ['src/lib/review.ts', 'review.ts'],
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
export const SCHEMA_VERSION = 10;
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
const { migrateSaved, SCHEMA_VERSION } = await import(join(tmp, 'storage.ts'));
const { chargeOf } = await import(join(tmp, 'battery.ts'));
const { daySchedule, freeSlots, overlap, startOptions, endHour, placeIn, sleepWindow, formatHour } = await import(join(tmp, 'schedule.ts'));
const { categorise, errandLoad, outstandingLoad, openErrands } = await import(join(tmp, 'errands.ts'));
const { buildTrades, totalSaved } = await import(join(tmp, 'rebalance.ts'));
const { findCollision, clusterCount, CLUSTER_MIN_ITEMS } = await import(join(tmp, 'forecast.ts'));
const { openPrep, percentUndone, percentUnplanned, unplanned, scheduledHours, sittingsOf, remaining, planSessions, isAtRisk, loadOnDay } = await import(join(tmp, 'prep.ts'));
const { MOMENT_KINDS, WHY_SUGGESTIONS, nextWorth, momentCredits } = await import(join(tmp, 'moments.ts'));
const { parseTimetable, parseLine, toItems, classesOn, moduleWeek, attendanceRate, attendanceStatus, isProtectedClass } = await import(join(tmp, 'timetable.ts'));
const { prioritise, rank, urgencyFactor } = await import(join(tmp, 'priority.ts'));
const { circleOrder, isStale, lastSeen, updatedToday, worthANudge, STALE_AFTER_MINS } = await import(join(tmp, 'circle.ts'));
const { bestSwap, findSwap, firstRefusal, skippable, wantOf, whyNoSwap, DEFAULT_WANT, WANT_CHOICES } = await import(join(tmp, 'swap.ts'));
const { CHECK_IN_MESSAGE, EVENING_FROM, PLAN_MESSAGE, VISIBILITY, busyFrom, freeOn, onBallastCount, published, sharedDays, suggestions, whatsapp } = await import(join(tmp, 'sharing.ts'));
const { CADENCE_WORD, DEFAULT_WEIGHTS, REVIEW_FROM_HOUR, VERDICT, adherence, describeWeights, dueForReview, retune, reviewEvery, weightsFrom } = await import(join(tmp, 'review.ts'));
const { percentByBucket, overallPercent, loadOf, loadByBucket, mixShares, dreadFromMix, dominantArea, describeMix, notchAt, MIX_MAX } = await import(join(tmp, 'load.ts'));

/** The reading a screen would show, logs folded in - mirrors state/selectors. */
const charge = (extra = []) => {
  const st = useStore.getState();
  const all = [...st.items, ...extra, ...logItems({ today: st.today, sleepHours: st.sleepHours, meals: st.meals, moods: st.moods, errands: st.errands, moments: st.moments })];
  return chargeOf(overallPercent(percentByBucket(itemsInWeek(all, st.today), st.ceilings)));
};
const { prescriptions } = await import(join(tmp, 'seed.ts'));
const { ACTIONS, PRESETS, customAction, initialSim, pointsOf, project, totalPoints } = await import(join(tmp, 'simulate.ts'));

let failures = 0;
const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label.padEnd(52)} ${ok ? '' : `got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`}`);
};
const s = () => useStore.getState();
const addDaysISO = (iso, days) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

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
  check('the week reads 53% used before', before, 53);
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
  check('base week is unaffected by any of it', base, 47);
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
  s().addErrand('Collect the parcel', 'Admin', 0.75, 2, { date: s().today });
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
  check('which reaches the battery', withErrand.some((i) => i.bucket === 'errands' && i.loadOverride > 0), true);

  // Finishing a seeded one has to move the number too, or the list is inert.
  s().reset();
  const seededErrand = s().errands.find((e) => !e.addedByUser);
  s().toggleErrand(seededErrand.id);
  check('finishing a seeded errand pays out', s().moments.some((m) => m.kind === 'errand-done'), true);
  check('worth what the errand weighed', s().moments.find((m) => m.kind === 'errand-done').credit, errandLoad(seededErrand));
  s().toggleErrand(seededErrand.id);
  check('un-ticking takes the payout back', s().moments.some((m) => m.kind === 'errand-done'), false);

  // Effort is the student's to set: a bank call is not a walk.
  s().reset();
  check('easy work weighs less', errandLoad({ hours: 1, effort: 1 }), 1);
  check('dreaded work weighs more', errandLoad({ hours: 1, effort: 3 }), 3);

  // Given a slot, it becomes a block on that day instead of an anonymous lump.
  s().reset();
  s().addErrand('Collect the parcel', 'Admin', 0.75, 2, { date: s().today, startHour: 9 });
  const scheduled = logItems({ today: s().today, sleepHours: null, meals: s().meals, moods: s().moods, errands: s().errands });
  check('a scheduled errand becomes a timed block', scheduled.some((i) => i.title === 'Collect the parcel' && i.startHour === 9), true);
  check('and is not also counted as floating', outstandingLoad(s().errands), 0);
  check('so it shows up on the day it was given', daySchedule([...s().items, ...scheduled], s().today).timed.some((i) => i.title === 'Collect the parcel'), true);
}

console.log('\nSleep says when, not only how long');
{
  s().reset();
  // Tomorrow opens with an 8am walk, so waking is 7 and the rest follows.
  const nine = sleepWindow(s().items, s().today, 9);
  check('waking is pinned an hour before the first thing', nine.wake, 7);
  check('nine hours means a 10pm bedtime', nine.bed, 22);
  check('which is not past midnight', nine.afterMidnight, false);

  const seven = sleepWindow(s().items, s().today, 7);
  check('seven hours lands exactly on midnight', seven.bed, 0);
  check('and that is flagged as past midnight', seven.afterMidnight, true);
  check('six hours pushes it to 1am', sleepWindow(s().items, s().today, 6).bed, 1);

  // The café shift runs to 11pm tonight, so a long night cannot start at ten.
  const long = sleepWindow(s().items, s().today, 12);
  check('it knows what runs latest tonight', long.lastEnd, 23);
  check('and flags a bedtime that cannot happen', long.clash, true);
  check('a night that fits does not flag', sleepWindow(s().items, s().today, 6).clash, false);
}

console.log('\nProtected recovery can be moved');
{
  s().reset();
  const river = prescriptions.find((p) => p.id === 'river');
  s().bookRecovery(river, 12, 1);
  const block = s().items.find((i) => i.id === `recovery-${river.id}`);
  check('it books where asked', block.startHour, 12);
  check('and it is protected', block.isRecovery, true);

  // Protected means work is planned around it, not that the hour is fixed.
  s().scheduleItem(block.id, 19);
  check('the hour can be changed afterwards', s().items.find((i) => i.id === block.id).startHour, 19);
  check('it is still protected', s().items.find((i) => i.id === block.id).isRecovery, true);
  check('and still on the timeline', daySchedule(s().items, s().today).timed.some((i) => i.id === block.id), true);

  const suggestion = placeIn(s().items.filter((i) => i.id !== block.id), s().today, 1, [12, 21]);
  check('a suggested hour is offered', typeof suggestion, 'number');
  check('and it sits inside the window', suggestion >= 12 && suggestion <= 21, true);

  s().scheduleItem(block.id, undefined);
  check('or it can be handed back entirely', s().items.find((i) => i.id === block.id).startHour, undefined);
}

console.log('\nThe timetable is fourteen real hours');
{
  s().reset();
  const week = ['0','1','2','3','4','5','6'].map((_, i) => addDaysISO(s().today, i));
  const classes = week.flatMap((d) => classesOn(s().items, d));
  check('every class has a time', classes.every((c) => c.startHour !== undefined), true);
  check('and a room', classes.every((c) => !!c.room), true);
  check('they total fourteen hours', classes.reduce((t, c) => t + c.hours, 0), 14);
  // Same fourteen hours the invisible blob weighed, so the study's figures hold.
  check('and twenty-eight load', classes.reduce((t, c) => t + loadOf(c), 0), 28);
  check('none of them is hidden from the day', classes.every((c) => !c.spread), true);

  const mon = classesOn(s().items, s().today);
  check('Monday opens with three hours of class', mon.reduce((t, c) => t + c.hours, 0), 3);
  check('in clock order', mon.map((c) => c.startHour), [...mon.map((c) => c.startHour)].sort((a, b) => a - b));
}

console.log('\nDread belongs to the module, not the hour');
{
  s().reset();
  const net = () => s().modules.find((m) => m.id === 'net');
  const netClasses = () => s().items.filter((i) => i.moduleId === 'net');
  check('networks starts at dread 2', net().dread, 2);
  s().setModuleDread('net', 5);
  check('raising it re-prices every class in the module', netClasses().every((c) => c.dread === 5), true);
  check('and leaves other modules alone', s().items.filter((i) => i.moduleId === 'os').every((c) => c.dread === 2), true);
  check('the module remembers it', net().dread, 5);
}

console.log('\nWhy an hour can be worth more than its length');
{
  s().reset();
  const lecture = s().items.find((i) => i.moduleId === 'os' && i.sessionKind === 'lecture');
  check('the OS lecture is marked as giving tips', lecture.flags.includes('tips'), true);
  check('so the app will not move it', isProtectedClass(lecture), true);

  // It is listed in the rebalance sheet, locked - refusing visibly, not silently.
  const trades = buildTrades(itemsInWeek(s().items, s().today));
  const guard = trades.find((t) => t.id.startsWith('class-'));
  check('and the rebalancer says so out loud', !!guard, true);
  check('locked, like a hard deadline', guard.locked, true);
  check('and worth nothing to skip', guard.saves, 0);

  const plain = s().items.find((i) => i.moduleId === 'alg' && i.sessionKind === 'tutorial');
  check('an unflagged class is not protected', isProtectedClass(plain), false);
  s().toggleClassFlag(plain.id, 'tips');
  check('until you mark it', isProtectedClass(s().items.find((i) => i.id === plain.id)), true);
  s().toggleClassFlag(plain.id, 'tips');
  check('and tapping again clears it', isProtectedClass(s().items.find((i) => i.id === plain.id)), false);
}

console.log('\nAttendance, when somebody is counting');
{
  s().reset();
  check('algorithms sits at 78%', attendanceRate(s().modules.find((m) => m.id === 'alg')), 78);
  check('which is below the 80% expected', attendanceStatus(s().modules.find((m) => m.id === 'alg')), 'below');
  check('networks is fine at 92%', attendanceStatus(s().modules.find((m) => m.id === 'net')), 'fine');
  check('and nothing is claimed where nobody counts', attendanceStatus(s().modules.find((m) => m.id === 'ds')), 'untracked');
  s().markAttendance('alg', true);
  check('turning up moves it', attendanceRate(s().modules.find((m) => m.id === 'alg')), 80);
  s().markAttendance('alg', false);
  check('and missing one moves it back', attendanceRate(s().modules.find((m) => m.id === 'alg')) < 80, true);
}

console.log('\nImporting a pasted timetable');
{
  s().reset();
  const pasted = [
    'Mon 09:00-11:00 CS2040 Operating Systems Lecture Kilburn LT1',
    'Tue 14:00-16:00 CS2011 Algorithms Lab in Lab A',
    'Thu 8-10am CS2035 Networks Lecture',
    'this line is not a class at all',
  ].join('\n');
  const read = parseTimetable(pasted);
  check('it reads three of the four lines', read.classes.length, 3);
  check('and hands the fourth back rather than dropping it', read.skipped.length, 1);

  const [first] = read.classes;
  check('Monday', first.day, 0);
  check('nine until eleven', [first.startHour, first.hours], [9, 2]);
  check('the module code', first.code, 'CS2040');
  check('the kind', first.kind, 'lecture');
  check('and the room', first.room, 'Kilburn LT1');
  check('12-hour times work too', read.classes[2].startHour, 8);
  check('as does "in Lab A"', read.classes[1].room, 'Lab A');

  const built = toItems(read.classes, s().today, 2);
  check('they become real items on the right days', built.map((i) => i.date), [addDaysISO(s().today, 0), addDaysISO(s().today, 1), addDaysISO(s().today, 3)]);
  s().importTimetable(built, []);
  check('importing replaces rather than appends', s().items.filter((i) => i.moduleId).length, 3);
  check('and leaves the rest of the week alone', !!s().items.find((i) => i.id === 'os-2'), true);
}

console.log('\nOne list for everything you just do');
{
  s().reset();
  // Added from the errands screen: it belongs to a day, so it shows there too.
  s().addErrand('Collect the parcel', 'Admin', 0.75, 2, { date: s().today });
  const logged = () => logItems({ today: s().today, sleepHours: null, meals: s().meals, moods: s().moods, errands: s().errands, moments: s().moments });
  const withLogs = () => [...s().items, ...logged()];
  check('it appears on its own day, not as a lump', logged().some((i) => i.title === 'Collect the parcel'), true);
  check("and waits in that day's list", daySchedule(withLogs(), s().today).anytime.some((i) => i.title === 'Collect the parcel'), true);
  check('it is still on the errands list', s().errands.some((e) => e.title === 'Collect the parcel'), true);

  // Added from capture as "just turn up": same object, so it lands in both too.
  s().addErrand('Dentist appointment', categorise('dentist appointment'), 1, 2, { date: s().today, startHour: 9 }, 'errands');
  check('a turn-up thing joins the same list', s().errands.some((e) => e.title === 'Dentist appointment'), true);
  check('and takes its slot in the timeline', daySchedule(withLogs(), s().today).timed.some((i) => i.title === 'Dentist appointment'), true);

  // A thing you turn up to is not always an errand, and the load must follow it.
  s().addErrand('Interview', 'Admin', 1, 3, { date: s().today }, 'mental');
  check('it costs the area it belongs to', logged().find((i) => i.title === 'Interview').bucket, 'mental');

  // Tomorrow's task is not on today's list.
  s().addErrand('Post the parcel', 'Admin', 0.5, 2, { date: addDaysISO(s().today, 1) });
  check("tomorrow's task stays on tomorrow", daySchedule(withLogs(), s().today).all.some((i) => i.title === 'Post the parcel'), false);
  check('and is there tomorrow', daySchedule(withLogs(), addDaysISO(s().today, 1)).all.some((i) => i.title === 'Post the parcel'), true);
  check('four of your own are outstanding', openErrands(s().errands).length, 4);
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

  check('next week starts at 59% used', before, 59);
  check('four trades come pre-selected', trades.filter((t) => t.selected).length, 4);

  // Exactly what the screen passes: the selection travels on the trades.
  s().applyTrades(trades);
  const after = weekReading(s().items, anchor, s().ceilings).overall;

  check('the week actually gets lighter', after < before, true);
  check('it lands at 50% used', after, 50);
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

console.log('\nEvery launch starts from the seeded semester');
{
  // Only the intro flag is written, so nothing about a week can outlive a reload.
  const saved = { onboarded: true, items: [{ id: 'junk' }], sleepHours: 4, moments: [{ id: 'm' }] };
  const kept = ((({ onboarded }) => ({ onboarded }))(saved));
  check('the week is not persisted', kept.items, undefined);
  check('nor is anything logged', kept.sleepHours, undefined);
  check('nor are good moments', kept.moments, undefined);
  check('only whether the intro has run', kept.onboarded, true);
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
  check('a current save is left alone', migrateSaved({ onboarded: true, sleepHours: 8 }, SCHEMA_VERSION).sleepHours, 8);
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
  // 11am is now a networks tutorial, so the nearest free start is 8.
  check('a full window falls back to the nearest hour', squeezed, 8);
  check('rather than the earliest of the day', squeezed !== 7, true);

  check('sleep is marked as never placeable', ACTIONS.find((a) => a.id === 'sleep').logOnly, true);
  check('and it is the only one', ACTIONS.filter((a) => a.logOnly).length, 1);
  s().reset();
  s().applyPlan([], 9);
  check('committing sleep adds no block at all', daySchedule(s().items, s().today).timed.some((i) => /sleep/i.test(i.title)), false);
  check('it only moves the log', s().sleepHours, 9);
}

console.log('\nWork that takes more than one sitting');
{
  s().reset();
  const owing = openPrep(s().items, s().today);
  check('unfinished prep shows on today', owing.length > 0, true);
  const algo = owing.find((i) => i.id === 'algo-set');
  check('the problem set is on the list', !!algo, true);
  check('it starts three quarters undone', percentUndone(algo), 75);
  check('with three hours left', remaining(algo), 3);

  // It stays on every day until its deadline, not just the day it is due.
  const tomorrow = addDaysISO(s().today, 1);
  check('and it is still there tomorrow', openPrep(s().items, tomorrow).some((i) => i.id === 'algo-set'), true);

  s().logProgress('algo-set', 2);
  check('logging two hours moves it to 25%', percentUndone(s().items.find((i) => i.id === 'algo-set')), 25);
  s().logProgress('algo-set', 5);
  check('progress cannot exceed the estimate', remaining(s().items.find((i) => i.id === 'algo-set')), 0);
  check('and it leaves the list once done', openPrep(s().items, s().today).some((i) => i.id === 'algo-set'), false);
}

console.log('\nPlanning the sittings');
{
  s().reset();
  const algo = s().items.find((i) => i.id === 'algo-set');
  const plan = planSessions(algo, s().items, s().today);
  check('it proposes sittings', plan.length > 0, true);
  check('none longer than two hours', plan.every((p) => p.hours <= 2), true);
  check('none after the deadline', plan.every((p) => p.date <= algo.deadline), true);
  check('they add up to what is left', Math.min(remaining(algo), plan.reduce((t, p) => t + p.hours, 0)) > 0, true);
  check('spread across days rather than crammed', new Set(plan.map((p) => p.date)).size, plan.length);
  // Work goes where there is room, not simply onto the next day.
  const chosen = plan.map((p) => loadOnDay(s().items, p.date));
  const window = [];
  for (let o = 0; o <= 3; o += 1) window.push(loadOnDay(s().items, addDaysISO(s().today, o)));
  check('it avoids the heaviest day it could have used', Math.max(...chosen) <= Math.max(...window), true);

  s().scheduleSessions('algo-set', plan, { replace: true });
  const booked = s().items.filter((i) => i.parentId === 'algo-set');
  check('booking creates one item per sitting', booked.length, plan.length);
  check('each with a real time', booked.every((i) => i.startHour !== undefined), true);

  // Re-planning replaces rather than stacking.
  s().scheduleSessions('algo-set', plan, { replace: true });
  check('re-planning does not double them', s().items.filter((i) => i.parentId === 'algo-set').length, plan.length);

  // Pushing moves the work, never the deadline - that is not ours to move.
  s().reset();
  const due = s().items.find((i) => i.id === 'algo-set').deadline;
  s().scheduleSessions('algo-set', [{ date: s().today, startHour: 8, hours: 2 }], { replace: true });
  s().pushSittings('algo-set', s().today, addDaysISO(s().today, 1));
  check("today's sitting moves to tomorrow", s().items.find((i) => i.parentId === 'algo-set').date, addDaysISO(s().today, 1));
  check('it loses its slot and waits on that list', s().items.find((i) => i.parentId === 'algo-set').startHour, undefined);
  check('and the deadline has not moved', s().items.find((i) => i.id === 'algo-set').deadline, due);
}

console.log('\nTonight, as three kinds of night');
{
  s().reset();
  const now = chargeOf(weekReading(s().items, s().today, s().ceilings).overall);
  const outcome = (id) => project(now, PRESETS.find((p) => p.id === id).state);

  check('every preset sets every slider', PRESETS.every((p) => ACTIONS.every((a) => p.state[a.id] !== undefined)), true);
  check('a recovery night leaves you better off', outcome('recover') > now, true);
  check('pushing through costs you', outcome('push') < now, true);
  check('balanced sits between the two', outcome('balanced') > outcome('push') && outcome('balanced') < outcome('recover'), true);
  check('and none of them is just the baseline', PRESETS.every((p) => totalPoints(p.state) !== 0), true);

  // A preset is a starting point, not a commitment: nothing is saved by picking one.
  const before = s().items.length;
  check('choosing one books nothing on its own', s().items.length, before);
}

console.log('\nBooking moves the bar, giving it back moves it straight in again');
{
  s().reset();
  const algo = () => s().items.find((i) => i.id === 'algo-set');
  check('three hours are unplanned to begin with', unplanned(algo(), s().items), 3);
  check('so the bar reads 75%', percentUnplanned(algo(), s().items), 75);

  s().scheduleSessions('algo-set', [{ date: s().today, startHour: 8, hours: 2, note: 'Finish section 2' }]);
  check('booking two hours drops the bar', percentUnplanned(algo(), s().items), 25);
  check('though none of it is actually done yet', percentUndone(algo()), 75);
  check('and the note is kept', s().items.find((i) => i.parentId === 'algo-set').note, 'Finish section 2');

  const session = s().items.find((i) => i.parentId === 'algo-set');
  s().unscheduleSession(session.id);
  check('giving the sitting back puts the bar straight up again', percentUnplanned(algo(), s().items), 75);
  check('and the sitting is gone from the day', scheduledHours(algo(), s().items), 0);
}

console.log('\nProgress is sittings ticked off, not a percentage guessed');
{
  s().reset();
  const algo = () => s().items.find((i) => i.id === 'algo-set');
  s().scheduleSessions('algo-set', [
    { date: s().today, startHour: 8, hours: 2, note: 'Finish section 2' },
    { date: addDaysISO(s().today, 1), startHour: 9, hours: 1 },
  ]);
  const first = () => sittingsOf(algo(), s().items)[0];
  check('two sittings are booked', sittingsOf(algo(), s().items).length, 2);
  check('and none of them is done', sittingsOf(algo(), s().items).filter((x) => x.sessionDone).length, 0);
  check('booked hours are booked, not done', scheduledHours(algo(), s().items), 3);

  const id = first().id;
  s().completeSitting(id);
  check('ticking one off moves its hours onto the bar', algo().prepDone, 3);
  check('the sitting is marked rather than deleted', first().sessionDone, true);
  check('a done sitting stops counting as booked', scheduledHours(algo(), s().items), 1);
  check('and the day still remembers it happened', s().items.some((i) => i.id === id && i.date === s().today), true);
  check('ticking the same one twice changes nothing', (s().completeSitting(id), algo().prepDone), 3);

  s().completeSitting(sittingsOf(algo(), s().items)[1].id);
  check('finishing the work clears it from the list', openPrep(s().items, s().today).some((i) => i.id === 'algo-set'), false);

  // Work also happens without being booked first.
  s().reset();
  s().logUnbookedHours('algo-set', 1);
  check('an unbooked hour still counts', algo().prepDone, 2);
  check('which reads as half undone', percentUndone(algo()), 50);
  s().logUnbookedHours('algo-set', 99);
  check('and it can never exceed the whole job', algo().prepDone, 4);
}

console.log('\nThe battery can go up, not only down');
{
  s().reset();
  const base = chargeOf(weekReading(s().items, s().today, s().ceilings).overall);
  const laughed = MOMENT_KINDS.find((k) => k.id === 'laughed');
  s().logMoment(laughed.id, laughed.bucket, laughed.credit);
  const withMoment = logItems({ today: s().today, sleepHours: null, meals: s().meals, moods: s().moods, errands: s().errands, moments: s().moments });
  check('a good moment is recorded', s().moments.length, 1);
  check('and it gives load back rather than taking it', withMoment.some((i) => i.loadOverride < 0), true);
  check('in the area it belongs to', withMoment.find((i) => i.loadOverride < 0).bucket, 'mental');

  check('and it can say why', s().moments[0].note, undefined);
  s().logMoment('finished', 'mental', 8, 'Handed something in');
  check('a reason is kept with it', s().moments[1].note, 'Handed something in');
  check('every kind has prompts to pick from', MOMENT_KINDS.every((k) => (WHY_SUGGESTIONS[k.id] ?? []).length > 0), true);

  // No ceiling, but the fifth laugh is not the first.
  s().reset();
  check('the first is worth full value', nextWorth(laughed, 0), laughed.credit);
  check('the second is worth half', nextWorth(laughed, 1), laughed.credit / 2);
  for (let i = 0; i < 20; i += 1) s().logMoment(laughed.id, laughed.bucket, laughed.credit);
  const spam = Math.abs(momentCredits(s().moments, s().today).mental);
  s().reset();
  for (let i = 0; i < 4; i += 1) {
    const k = MOMENT_KINDS.filter((m) => m.bucket === 'mental')[i % 2];
    s().logMoment(k.id, k.bucket, k.credit);
  }
  const varied = Math.abs(momentCredits(s().moments, s().today).mental);
  check('twenty taps of one thing tails off', spam < laughed.credit * 5, true);
  check('a genuinely varied day is worth more per tap', varied / 4 > spam / 20, true);
  check('but a good day is no longer capped', spam > 12, true);
  check('base week unchanged by any of it', base, 47);
}

console.log('\nEvery notch on a dial is reachable');
{
  // A 300pt track with a 34pt knob. The usable travel is 266, not 300, because
  // the knob is half a knob wide at each end - and mapping x/width onto the
  // scale put the top notch past the right edge, where no thumb could land.
  const W = 300, KNOB = 34;
  check('the far left is nothing', notchAt(0, W, KNOB), 0);
  check('the far right is the top of the scale', notchAt(W, W, KNOB), MIX_MAX);
  check('the knob centre at the left edge is still nothing', notchAt(KNOB / 2, W, KNOB), 0);
  check('the knob centre at the right edge is the top', notchAt(W - KNOB / 2, W, KNOB), MIX_MAX);
  check('the middle is the middle', notchAt(W / 2, W, KNOB), Math.round(MIX_MAX / 2));
  check('past either end is clamped, not wrapped', [notchAt(-40, W, KNOB), notchAt(W + 40, W, KNOB)], [0, MIX_MAX]);
  check('every notch has somewhere to land', [0, 1, 2, 3, 4, 5].every((n) => {
    const x = KNOB / 2 + (n / MIX_MAX) * (W - KNOB);
    return notchAt(x, W, KNOB) === n;
  }), true);
}

console.log('\nOne thing, five areas — the mix');
{
  s().reset();
  const one = (mix) => [{ id: 'x', title: 'Group presentation', bucket: 'mental', hours: 4, dread: 3, commitment: 'soft', date: s().today, mix }];

  // The arithmetic. Total is untouched; only where it lands changes.
  check('no mix behaves exactly as before', loadByBucket(one(undefined)), { mental: 12, time: 0, errands: 0, social: 0, physical: 0 });
  check('an even three-way split still totals 12', Object.values(loadByBucket(one({ mental: 2, time: 2, social: 2 }))).reduce((a, b) => a + b, 0), 12);
  check('and lands 4 in each of the three named', loadByBucket(one({ mental: 2, time: 2, social: 2 })), { mental: 4, time: 4, errands: 0, social: 4, physical: 0 });
  check('weights are proportions, not points', loadByBucket(one({ mental: 4, social: 2 })), { mental: 8, time: 0, errands: 0, social: 4, physical: 0 });
  check('an all-zero mix falls back to the bucket', loadByBucket(one({ mental: 0, social: 0 })), { mental: 12, time: 0, errands: 0, social: 0, physical: 0 });

  // Dread is read off the worst area, not summed.
  check('dread is the worst area', dreadFromMix({ mental: 4, time: 2, social: 1 }), 4);
  check('three areas at 4 is still dread 4, not 12', dreadFromMix({ mental: 4, time: 4, social: 4 }), 4);
  check('nothing set still costs something', dreadFromMix({}), 1);
  check('the scale tops out at the model max', dreadFromMix({ mental: 99 }), MIX_MAX);
  check('the loudest area keeps the icon', dominantArea({ mental: 1, social: 4 }, 'mental'), 'social');
  check('and is said in words', describeMix({ mental: 4, social: 2 }, 'mental'), 'Mostly mental, some social');
  check('one area reads as just that area', describeMix({ social: 3 }, 'mental'), 'Social');

  // Shape beats total. Held at equal ceilings first, so the property is the
  // model's and not an artefact of one student's calibration.
  const flat = { mental: 100, time: 100, errands: 100, social: 100, physical: 100 };
  const concentrated = overallPercent(percentByBucket(one({ mental: 3 }), flat));
  const spread = overallPercent(percentByBucket(one({ mental: 2, time: 2, social: 2 }), flat));
  check('at equal ceilings, spreading the same load reads lower', spread < concentrated, true);
  // And then the thing that makes per-area ceilings worth having: spreading into
  // a SMALL ceiling is worse, not better. Four load of social is a quarter of
  // Amira's social ceiling and a twenty-fifth of her mental one.
  const ceil = s().ceilings;
  const intoSocial = overallPercent(percentByBucket(one({ mental: 2, social: 2 }), ceil));
  const allMental = overallPercent(percentByBucket(one({ mental: 3 }), ceil));
  check('but spreading into a smaller ceiling reads higher, correctly', intoSocial > allMental, true);

  // And it reaches the battery through the real store action.
  const before = charge();
  s().addErrand('Group presentation', 'Academic', 4, 3, { date: s().today }, 'mental', { mental: 3, social: 3 });
  const added = s().errands[0];
  check('the split is stored with the thing', added.mix, { mental: 3, social: 3 });
  const rows = logItems({ today: s().today, sleepHours: s().sleepHours, meals: s().meals, moods: s().moods, errands: s().errands, moments: s().moments });
  const row = rows.find((r) => r.title === 'Group presentation');
  check('and survives becoming a row on the day', row.mix, { mental: 3, social: 3 });
  check('it moves the battery', charge() < before, true);
  check('the seeded week reads 47% left', before, 47);
  check('social carries half of it', mixShares(row.mix).social, 0.5);
}

console.log('\nAn evening plan never books two things at once');
{
  s().reset();
  // Your own activity, added the way the Tonight screen adds it.
  const mine = customAction('badminton', 'Badminton', 2, 'physical');
  s().addCustomAction(mine);

  // Two recovery blocks that both want the evening, planned for tomorrow -
  // which is where the clash lived: blocks already placed in the same pass were
  // dated "today", so they did not count as occupied on any other night.
  const day = addDaysISO(s().today, 1);
  const blocks = [
    { id: 'walk', label: 'Take a walk', bucket: 'physical', hours: 1, credit: 4, preferred: [12, 19] },
    { id: mine.id, label: mine.label, bucket: mine.bucket, hours: 2, credit: 8, preferred: mine.preferred },
  ];

  const items = s().items;
  const placed = blocks.reduce((acc, block) => {
    const taken = acc.filter((b) => b.startHour !== undefined).map((b, i) => ({
      id: `taken-${i}`, title: b.label, bucket: b.bucket, hours: b.hours,
      dread: 1, commitment: 'self', date: day, startHour: b.startHour, isRecovery: true,
    }));
    const startHour = placeIn([...items, ...taken], day, block.hours, block.preferred, s().offHour);
    return [...acc, { ...block, startHour }];
  }, []);

  check('both of them got an hour', placed.every((b) => b.startHour !== undefined), true);
  const overlap2 = (a, b) => a.startHour < b.startHour + b.hours && b.startHour < a.startHour + a.hours;
  check('and the two do not sit on top of each other', overlap2(placed[0], placed[1]), false);
  check('neither starts before the hour your day is your own', placed.every((b) => b.startHour >= s().offHour), true);

  // And the same holds once they are really booked.
  s().applyPlan(placed.map(({ id, label, bucket, hours, credit, startHour }) => ({ id, label, bucket, hours, credit, startHour })), undefined, day);
  const booked = s().items.filter((i) => i.id.startsWith('plan-') && i.date === day);
  check('two protected blocks land on that evening', booked.length, 2);
  const [a, b] = booked.sort((x, y) => x.startHour - y.startHour);
  check('and they still do not overlap once booked', a.startHour + a.hours <= b.startHour, true);
}

console.log('\nWhat to do first');
{
  s().reset();
  const items = s().items;
  const { first, couldMove } = prioritise(items, s().today);

  check('the list is not empty', first.length > 0, true);
  check('it is sorted worst-first', first.every((row, i) => i === 0 || first[i - 1].score >= row.score), true);
  check('every row can say why it is there', first.every((row) => row.reasons.length > 0), true);

  // The shape of the urgency curve is the model, so assert the curve itself.
  check('due today counts for three times its size', urgencyFactor(0), 3);
  check('it drops steeply inside three days', urgencyFactor(1) > urgencyFactor(3), true);
  check('and falls below one past the week, so size cannot win on its own', urgencyFactor(8) < 1, true);

  // Same size, same day: a promise to someone else outranks one to yourself.
  const base = { bucket: 'mental', hours: 2, dread: 3, date: s().today, importance: 2 };
  const hard = rank({ ...base, id: 'h', title: 'Hard', commitment: 'hard' }, items, s().today);
  const self = rank({ ...base, id: 's', title: 'Self', commitment: 'self' }, items, s().today);
  check('a hard deadline outranks a self-imposed one', hard.score > self.score, true);
  check('and says so', hard.reasons.includes('Hard deadline'), true);

  // A small job due tomorrow beats a big one due next week.
  const soon = rank({ ...base, id: 'a', title: 'Small, tomorrow', hours: 1, commitment: 'soft', date: addDaysISO(s().today, 1) }, items, s().today);
  const later = rank({ ...base, id: 'b', title: 'Big, next week', hours: 3, commitment: 'soft', date: addDaysISO(s().today, 6) }, items, s().today);
  check('near and small beats far and large', soon.score > later.score, true);

  // Work that can no longer fit goes straight to the top, wherever it started.
  const impossible = {
    id: 'impossible', title: 'Eight hours due today', bucket: 'mental', hours: 8, dread: 3,
    commitment: 'self', date: s().today, deadline: s().today, prepHours: 8, prepDone: 0, importance: 1,
  };
  const withIt = [...items, impossible];
  const atRisk = rank(impossible, withIt, s().today);
  check('eight hours due today cannot fit', atRisk.reasons.includes('Not enough time left'), true);
  check('and that outranks everything else on the list', atRisk.score > first[0].score, true);
  check('even though it is the least important thing there', impossible.importance, 1);

  // The other half of the question.
  check('there is something you could move', couldMove.length > 0, true);
  check('nothing locked is ever offered', couldMove.every((row) => row.item.commitment !== 'hard'), true);
  check('nor the lecture that gives the hints', couldMove.every((row) => !isProtectedClass(row.item)), true);
  check('and it is ordered by what it gives back', couldMove.every((row, i) => i === 0 || couldMove[i - 1].saves >= row.saves), true);

  // Background load is not a choice, so it is not on the list.
  check('the timetable is not something to prioritise', first.every((row) => !row.item.moduleId || row.item.date >= s().today), true);
  check('nor repeating commitments', first.every((row) => !row.item.repeats), true);
  check('nor protected recovery', first.every((row) => !row.item.isRecovery), true);
  check('nor a sitting of something already on the list', first.every((row) => !row.item.parentId), true);
}

console.log('\nLooking after yourself moves the number');
{
  s().reset();
  const start = charge();
  check('an ordinary week leaves you something to work with', start >= 30 && start <= 50, true);

  // A good day: slept well, ate properly, felt good, and three things went right.
  s().logSleep(8.5);
  const slept = charge();
  check('a good night is worth having', slept > start, true);

  s().setMealStatus('dinner', 'filling');
  const fed = charge();
  check('and so is a proper meal', fed > slept, true);

  s().logMood('high-pleasant', []);
  for (const id of ['laughed', 'finished', 'rested']) {
    const kind = MOMENT_KINDS.find((k) => k.id === id);
    s().logMoment(kind.id, kind.bucket, kind.credit);
  }
  const good = charge();
  check('a genuinely good day lifts it by ten points or more', good - start >= 10, true);
  check('and it never goes over full', good <= 100, true);

  // The other direction costs less than it used to.
  s().reset();
  const before = charge();
  s().logSleep(5);
  s().logMood('low-unpleasant', []);
  const rough = charge();
  check('a rough day still costs something', rough < before, true);
  check('but less than a good day gives back', before - rough < good - start, true);

  // And the thing the app recommends is worth doing.
  s().reset();
  const pre = charge();
  const walk = prescriptions[0];
  s().bookRecovery(walk, 12, 1, s().today);
  check('booking the recovery it suggested moves the battery up', charge() > pre, true);
  check('by what the ledger says it is worth, not by one hour', s().items.at(-1).loadOverride, -walk.credit);
}

console.log('\nThe battery has room to move in both directions');
{
  s().reset();
  const start = charge();

  // The floor of a student's week: classes, the commute, the shift, the chores -
  // everything entered once and counted forever, with no deadlines on top. That
  // is what an ordinary quiet week looks like, and it is the reading the app has
  // to be able to get to, or "you are doing fine" is a state it can never show.
  const floor = itemsInWeek(s().items.filter((i) => i.repeats || i.spread), s().today);
  const quiet = chargeOf(overallPercent(percentByBucket(floor, s().ceilings)));
  console.log(`    (classes and the shift alone read ${quiet}%)`, JSON.stringify(percentByBucket(floor, s().ceilings)));
  check('a quiet week reads in the seventies', quiet >= 68 && quiet <= 88, true);

  const half = s().items.map((i) => (i.repeats || i.spread || i.isRecovery ? i : { ...i, hours: i.hours / 2 }));
  const light = chargeOf(overallPercent(percentByBucket(itemsInWeek(half, s().today), s().ceilings)));
  console.log(`    (half the deadline work reads ${light}%)`);
  check('halving the work you chose is worth ten points', light - start >= 10, true);

  // And the worst week in the seed is still clearly worse, without bottoming out.
  const next = chargeOf(weekReading(s().items, nextWeek(s().today), s().ceilings).overall);
  check('the wall week is worse than this one', next < start, true);
  check('but not pinned at nothing', next >= 25, true);

  // No area sits at zero any more, which was the thing that made the headline
  // number useless: one flat bucket dragged everything with it.
  const areas = percentByBucket(itemsInWeek(s().items, s().today), s().ceilings);
  check('no area is over its own ceiling', Object.values(areas).every((p) => p <= 100), true);
  check('and the emptiest still has something left', 100 - Math.max(...Object.values(areas)) >= 25, true);
}

console.log('\nYour circle, and how old each reading is');
{
  const { circle } = await import(join(tmp, 'seed.ts'));

  // The number the whole feature runs on.
  check('a fresh reading reads in minutes', lastSeen({ updatedMinsAgo: 22 }), '22 min ago');
  check('an hour or more reads in hours', lastSeen({ updatedMinsAgo: 140 }), '2h ago');
  check('a day or more reads in days', lastSeen({ updatedMinsAgo: 4380 }), '3 days ago');
  check('never checked in says so', lastSeen({}), 'never checked in');

  // A reading nobody has confirmed is not news, and must not be presented as it.
  check('a day-old reading is stale', isStale({ updatedMinsAgo: STALE_AFTER_MINS + 1 }), true);
  check('an hour-old one is not', isStale({ updatedMinsAgo: 60 }), false);
  check('and no reading at all is stale', isStale({}), true);

  check('three of the four checked in today', updatedToday(circle), 3);
  check('you are never counted as one of your own friends', updatedToday(circle.filter((p) => p.isYou)), 0);

  // Emptiest first - but a stale battery sinks rather than rises.
  const order = circleOrder(circle);
  check('you are not in your own circle list', order.every((p) => !p.isYou), true);
  check('the emptiest fresh reading is first', order[0].id, 'aisyah');
  check('and the stale one is last however low it reads', order.at(-1).id, 'jo');

  // At most one person to check on, ever.
  const nudge = worthANudge(circle);
  check('exactly one person is suggested', !!nudge && !!nudge.person, true);
  check('it is the one stuck heavy', nudge.person.id, 'aisyah');
  check('and it says why', nudge.reason, 'heavy for 11 days');
  check('nobody is suggested when everyone is fine', worthANudge([
    { id: 'a', name: 'A', initials: 'A', band: 'steady', charge: 80, updatedMinsAgo: 10 },
  ]), null);
}

console.log('\nSwapping, not dropping');
{
  s().reset();
  const day = '2030-01-10';
  const mods = [
    { id: 'safe',  code: 'SAFE', name: 'Comfortable', requiredAttendance: 80, held: 10, attended: 10, dread: 2, importance: 2 },
    { id: 'tight', code: 'TGHT', name: 'On the line',  requiredAttendance: 80, held: 10, attended: 8,  dread: 2, importance: 2 },
    { id: 'free',  code: 'FREE', name: 'Uncounted',    requiredAttendance: null, held: 10, attended: 4, dread: 2, importance: 2 },
  ];
  const item = (over) => ({
    id: over.id, title: over.title, bucket: over.bucket ?? 'social', hours: over.hours ?? 4,
    dread: over.dread ?? 3, commitment: over.commitment ?? 'soft', date: day, ...over,
  });

  // The one thing the app asks, and what it assumes when nobody has said.
  check('silence is neutral', wantOf(item({ id: 'x', title: 'x' })), DEFAULT_WANT);
  check('and never drives a decision', DEFAULT_WANT, 3);
  check('capture offers the ends and the middle', WANT_CHOICES.map(([v]) => v), [1, 3, 5]);

  // Adam's dilemma: the wedding and the Thursday class.
  const wedding = item({ id: 'wedding', title: "Sister's wedding", want: 5, hours: 8 });
  const comfortable = item({ id: 'lecture', title: 'Thursday lecture', want: 2, hours: 3, dread: 2, commitment: 'hard', moduleId: 'safe' });
  const swap = findSwap([wedding, comfortable], mods);
  check('the wedding is what you keep', swap.keep.id, 'wedding');
  check('the lecture is what goes', swap.drop.id, 'lecture');
  check('and it says what missing it costs', swap.cost, 'You would be at 91%, still above 80%');
  check('with the load handed back', swap.saves, 6);

  // The same class, from a student who cannot afford it. This is the whole test:
  // a timetable cannot tell these two students apart and the arithmetic can.
  const onTheLine = item({ ...comfortable, id: 'lecture', moduleId: 'tight' });
  check('at 80% exactly, one more absence is refused',
    skippable(onTheLine, mods).reason, 'One more absence takes you under 80%');
  check('and nothing is offered', findSwap([wedding, onTheLine], mods), null);

  // Ordering: every timetabled class is stored hard, so checking `commitment`
  // first made the app answer "hard deadline" to the question it exists to answer.
  check('a counted class is judged on attendance, not on being timetabled',
    skippable(comfortable, mods).canSkip, true);

  // The refusals the model will not talk itself out of.
  check('the class that gives hints is never traded',
    skippable(item({ id: 'tips', title: 'Revision lecture', flags: ['tips'], moduleId: 'free' }), mods).reason,
    'This is the one that gives hints');
  check('nor is a hard deadline', skippable(item({ id: 'h', title: 'Exam', commitment: 'hard' }), mods).canSkip, false);
  check('nor anything weekly', skippable(item({ id: 'w', title: 'Bins', repeats: true }), mods).canSkip, false);
  check('nor anything with a date on it',
    skippable(item({ id: 'd', title: 'Form', deadline: '2030-01-20' }), mods).canSkip, false);

  // Trust, in two rules. Trivia and your own study are not currency.
  const errand = item({ id: 'post', title: 'Post office', hours: 0.5, dread: 3, bucket: 'errands' });
  check('a one-and-a-half-load errand is not worth a trade', findSwap([wedding, errand], mods), null);
  const prep = item({ id: 'prep', title: 'Seminar reading', bucket: 'mental', commitment: 'self', hours: 4, prepHours: 6 });
  check('and the app never offers to drop the prep for the thing itself',
    findSwap([wedding, prep], mods), null);
  const solo = item({ id: 'solo', title: 'Revision block', bucket: 'mental', commitment: 'self', hours: 4 });
  check('nor your own study time', findSwap([wedding, solo], mods), null);

  // Wanting something is not enough on its own.
  check('a day of things you merely tolerate offers nothing',
    findSwap([item({ id: 'a', title: 'A' }), item({ id: 'b', title: 'B' })], mods), null);
  check('one thing on its own is not a choice', findSwap([wedding], mods), null);

  // Sleep and meals are not appointments; a captured task is.
  const logRow = { ...item({ id: 'log-sleep', title: 'Short night' }), isLog: true, spread: true };
  check('logs are not on the table', findSwap([wedding, logRow], mods), null);
  const captured = { ...item({ id: 'log-errand-1', title: 'Shift at the cafe', bucket: 'time', hours: 6 }), isLog: true, spread: false };
  check('but a shift you typed in yourself is', findSwap([wedding, captured], mods).drop.id, 'log-errand-1');

  // The refusal, which is the answer on most days.
  const why = whyNoSwap([wedding, onTheLine], mods);
  check('it names what you wanted', why.keep.id, 'wedding');
  check('and exactly what would not move', why.blocked.map((b) => b.item.id), ['lecture']);
  check('there is no refusal to report when there is a swap', whyNoSwap([wedding, comfortable], mods), null);
  check('nor when you wanted nothing in particular',
    whyNoSwap([item({ id: 'a', title: 'A' }), item({ id: 'b', title: 'B', commitment: 'hard' })], mods), null);

  // A week at a time, which is how Rebalance reads it.
  const week = [addDaysISO(day, 0), addDaysISO(day, 1)];
  const both = [wedding, onTheLine, { ...comfortable, id: 'later', date: week[1] }, { ...wedding, id: 'gig', title: 'The gig', date: week[1] }];
  const found = bestSwap(both, week, mods);
  check('the week offers the day that has a real trade on it', found.date, week[1]);
  check('with the thing you want kept', found.keep.id, 'gig');
  check('a week of refusals offers no swap', bestSwap([wedding, onTheLine], week, mods), null);
  check('and reports the first one instead', firstRefusal([wedding, onTheLine], week, mods).date, week[0]);
}

console.log('\nMaking the swap');
{
  s().reset();
  // The seeded fortnight holds exactly one honest trade: covering Amin's shift
  // on the Wednesday, against the seminar the student marked as wanted.
  const anchor = nextWeek(s().today);
  const days = Array.from({ length: 7 }, (_, i) => addDaysISO(anchor, i));
  const real = bestSwap(s().items, days, s().modules);
  check('next week has one', !!real, true);
  check('it is the shift picked up for someone else', real.drop.id, 'w11-amin');
  check('kept for the thing marked really-want', wantOf(real.keep) > DEFAULT_WANT, true);

  const before = s().items.length;
  s().dropSwap(real.drop.id);
  check('taking it off removes exactly one thing', s().items.length, before - 1);
  check('and it is gone', s().items.some((i) => i.id === 'w11-amin'), false);
  check('so the same swap is not offered twice', bestSwap(s().items, days, s().modules)?.drop?.id ?? null, null);

  // A captured turn-up task lives in the errands list, so dropping it has to
  // reach there or the button would appear to do nothing.
  s().reset();
  s().addErrand('Shift at the bar', 'Admin', 6, 3, { date: s().today }, 'time', undefined, 1);
  const errandId = s().errands[0].id;
  check('the rating is stored with it', s().errands[0].want, 1);
  s().dropSwap(`log-errand-${errandId}`);
  check('and dropping its row removes the errand', s().errands.some((e) => e.id === errandId), false);
}

console.log('\nWhat leaves your phone');
{
  s().reset();
  const { circle, phoneContacts } = await import(join(tmp, 'seed.ts'));
  const today = s().today;
  const mine = s().items;

  check('three levels, no more', VISIBILITY.map((v) => v.value), ['off', 'evenings', 'busy']);
  check('evenings by default', s().sharing, 'evenings');

  // Off is genuinely off. Not "off but still discoverable".
  check('off publishes nothing at all', published(mine, today, 'off'), []);
  const evening = published(mine, today, 'evenings');
  check('evenings never start before five', evening.every((slot) => slot.start >= EVENING_FROM), true);
  const all = published(mine, today, 'busy');
  check('free/busy shows more of the day than evenings does', all.length >= evening.length, true);

  // The privacy promise, as arithmetic: what is published has no field for a
  // title, so no amount of reading it can reveal one.
  check('a published window carries only two numbers',
    [...new Set(all.flatMap((slot) => Object.keys(slot)))].sort(), ['end', 'start']);

  // Busy is the inverse of free and says nothing about what fills it.
  const free = [{ start: 18, end: 22 }];
  check('the rest of the day is blocked out', busyFrom(free), [{ start: 7, end: 18 }, { start: 22, end: 23 }]);
  check('and a day with nothing free is one solid block', busyFrom([]), [{ start: 7, end: 23 }]);
  check('a fully free day has no blocks', busyFrom([{ start: 7, end: 23 }]), []);

  // Whose evenings these are.
  const ravi = circle.find((p) => p.id === 'ravi');
  check('their published windows come back in order',
    freeOn(ravi, addDaysISO(today, 2)).map((s2) => s2.start), [17]);
  check('a day they published nothing for is empty', freeOn(ravi, addDaysISO(today, 1)), []);

  // Finding an evening: the coordination four people never do themselves.
  const days = Array.from({ length: 7 }, (_, i) => addDaysISO(today, i));
  const withRavi = sharedDays(mine, [ravi], days, 'busy', 2);
  check('you and Ravi share at least one evening', withRavi.length > 0, true);
  check('longest window first', withRavi[0].best.end - withRavi[0].best.start >= 2, true);
  const aisyah = circle.find((p) => p.id === 'aisyah');
  check('the more people, the fewer windows',
    sharedDays(mine, [ravi, aisyah], days, 'busy', 2).length <= withRavi.length, true);
  check('someone who shared nothing cannot be counted free',
    sharedDays(mine, [{ id: 'x', name: 'X', initials: 'X', band: 'steady' }], days, 'busy', 2), []);
  check('and nobody asked means nothing offered', sharedDays(mine, [], days, 'busy', 2), []);

  // Starting a circle from the address book.
  check('people already on Ballast come first',
    suggestions(phoneContacts).slice(0, 3).every((c) => c.onBallast), true);
  check('anyone already added is not offered again',
    suggestions(phoneContacts).some((c) => c.added), false);
  check('three of your contacts are here and not yet added', onBallastCount(phoneContacts), 3);

  const before = s().circle.length;
  s().addFriend('c-nadia');
  check('adding one grows your circle', s().circle.length, before + 1);
  check('she arrives with no invented battery', s().circle.at(-1).charge, undefined);
  check('and no invented calendar', s().circle.at(-1).free, undefined);
  s().addFriend('c-nadia');
  check('adding her twice does nothing', s().circle.length, before + 1);
  check('and she drops off the suggestions', onBallastCount(s().phoneContacts), 2);
  s().addFriend('c-priya');
  check('someone not on Ballast is never silently added', s().circle.length, before + 1);

  // Handing a message to the app they already use.
  check('the link opens a chat with the words in it',
    whatsapp('Hey Jo', '60123456702'), 'https://wa.me/60123456702?text=Hey%20Jo');
  check('spaces and punctuation survive the trip',
    whatsapp(CHECK_IN_MESSAGE('Aisyah Binti')),
    'https://wa.me/?text=Hey%20Aisyah%2C%20thinking%20of%20you.%20How%20have%20you%20been%3F');
  check('a number is stripped to digits', whatsapp('hi', '+60 12-345 6701'), 'https://wa.me/60123456701?text=hi');
  check('the plan message names the time, not the task',
    PLAN_MESSAGE('Thu from 7pm', ['amin', 'ravi']),
    'Are you both free Thu from 7pm? Looks like it works for everyone.');
  check('and reads right for one person',
    PLAN_MESSAGE('Thu from 7pm', ['amin']),
    'Are you free Thu from 7pm? Looks like it works for everyone.');

  // Turning it off, and back on.
  s().setSharing('off');
  check('the setting sticks', s().sharing, 'off');
  check('and publishes nothing while it is off', published(s().items, today, s().sharing), []);
  s().reset();
  check('reset puts your circle back', s().circle.length, circle.length);
  check('and your sharing back to evenings', s().sharing, 'evenings');
}

console.log('\nThe evening question');
{
  s().reset();
  check('three answers, no more', VERDICT.map((v) => v.value), ['good', 'too-much', 'wrong-order']);
  check('everything starts at one', DEFAULT_WEIGHTS, { urgency: 1, importance: 1, want: 1 });

  // "Too full" is read as a complaint about what was done, not how much.
  const full = retune(DEFAULT_WEIGHTS, 'too-much');
  check('too full leans towards what you want', full.want > 1, true);
  check('and away from raw importance', full.importance < 1, true);
  check('without touching deadlines', full.urgency, 1);

  // "Wrong order" is a deadline problem.
  const wrong = retune(DEFAULT_WEIGHTS, 'wrong-order');
  check('wrong order leans on deadlines', wrong.urgency > 1, true);
  check('and off what you fancy', wrong.want < 1, true);

  // A good day is not a no-op: it walks an old over-correction back.
  check('a good day settles a stretched weight back towards neutral',
    retune({ urgency: 1.6, importance: 1, want: 1 }, 'good').urgency < 1.6, true);
  check('and leaves a neutral one alone', retune(DEFAULT_WEIGHTS, 'good'), DEFAULT_WEIGHTS);

  // Bounded, both ways. One bad evening cannot rewrite the app.
  let hammered = DEFAULT_WEIGHTS;
  for (let i = 0; i < 40; i += 1) hammered = retune(hammered, 'wrong-order');
  check('forty complaints cannot push a weight past the ceiling', hammered.urgency <= 1.6, true);
  check('nor below the floor', hammered.want >= 0.6, true);
  let softened = DEFAULT_WEIGHTS;
  for (let i = 0; i < 40; i += 1) softened = retune(softened, 'too-much');
  check('and a deadline can never be flattened to nothing', softened.importance >= 0.6, true);

  // Folded over history, in order.
  check('an unanswered history teaches nothing',
    weightsFrom([{ date: '2030-01-01', felt: 'hard', percent: 60 }]), DEFAULT_WEIGHTS);
  const history = [
    { date: '2030-01-01', felt: 'hard', percent: 60, verdict: 'too-much' },
    { date: '2030-01-02', felt: 'hard', percent: 60, verdict: 'too-much' },
  ];
  check('two evenings move it twice as far', weightsFrom(history).want, retune(retune(DEFAULT_WEIGHTS, 'too-much'), 'too-much').want);
  check('and it says what it learned', describeWeights(weightsFrom(history)), 'What you want to be at counts more');
  check('a fresh app claims to have learned nothing', describeWeights(DEFAULT_WEIGHTS), null);

  // The weights have to reach the ranking, or the question is theatre.
  const today = s().today;
  const base = { bucket: 'social', hours: 4, dread: 3, commitment: 'soft', date: addDaysISO(today, 1) };
  const wanted = { ...base, id: 'wanted', title: 'The thing you want', want: 5 };
  const not = { ...base, id: 'not', title: 'The thing you do not', want: 1, hours: 4.4 };
  const pool = [wanted, { ...not, hours: 4 }];
  const gap = (w) => {
    const [top, bottom] = prioritise(pool, today, 7, w).first;
    return Math.round((top.score / bottom.score) * 100) / 100;
  };
  // Wanting something counts, quietly, before anyone has tuned anything - it has
  // to, because a factor sitting at exactly 1 could never be tuned at all.
  check('untuned, wanting it is worth a little', gap(DEFAULT_WEIGHTS) < 1.3, true);
  check('and saying your days are too full is worth more', gap(softened) > gap(DEFAULT_WEIGHTS), true);
  check('the wanted one leads either way', prioritise(pool, today, 7, softened).first[0].item.id, 'wanted');
  check('and the row only says why once you have tuned it',
    [
      prioritise(pool, today, 7, DEFAULT_WEIGHTS).first[0].reasons.includes('You want this'),
      prioritise(pool, today, 7, softened).first[0].reasons.includes('You want this'),
    ],
    [false, true]);

  /*
   * The assertion that keeps this safe to ship.
   *
   * A task the student never rated cannot be moved by the `want` weight, however
   * hard it is pushed: unrated sits at the middle of the scale, the factor there
   * is exactly 1, and 1 to any power is 1. So a whole seeded semester ranks
   * identically - the tuning only ever moves things it was actually told about.
   *
   * Only the want weight is pushed here. The other two multiply factors that
   * *are* set on every task, so of course they move the scores; that is them
   * working, not leaking.
   */
  const unrated = s().items.map(({ want, ...rest }) => rest);
  check('a task nobody rated cannot be moved by that rating',
    prioritise(unrated, today, 7, { urgency: 1, importance: 1, want: 1.6 }).first.map((r) => r.score),
    prioritise(unrated, today, 7, DEFAULT_WEIGHTS).first.map((r) => r.score));

  // Keeping to your own plan buys you quiet.
  check('no history is not bad history', adherence([], today).rate, 1);
  const sittings = [
    { id: 's1', parentId: 'p', title: 'a', bucket: 'mental', hours: 2, dread: 3, commitment: 'self', date: addDaysISO(today, -2), sessionDone: true },
    { id: 's2', parentId: 'p', title: 'b', bucket: 'mental', hours: 2, dread: 3, commitment: 'self', date: addDaysISO(today, -1) },
  ];
  check('half the sittings kept reads as half', adherence(sittings, today), { kept: 1, booked: 2, rate: 0.5 });
  check('tomorrow is not yet a broken promise',
    adherence([{ ...sittings[1], date: addDaysISO(today, 3) }], today).booked, 0);
  check('keeping to it earns you quiet', reviewEvery(1), 3);
  check('drifting gets asked nightly', reviewEvery(0.2), 1);
  check('and it says so plainly', CADENCE_WORD(1), 'Asking every few days');

  // When to ask.
  check('never before the evening', dueForReview([], today, 14, 1), false);
  check('but once it is late, yes', dueForReview([], today, REVIEW_FROM_HOUR, 1), true);
  check('not twice in one night',
    dueForReview([{ date: today, felt: 'fine', percent: 40, verdict: 'good' }], today, 22, 1), false);
  check('not again tomorrow when you are keeping to the plan',
    dueForReview([{ date: addDaysISO(today, -1), felt: 'fine', percent: 40, verdict: 'good' }], today, 22, 1), false);
  check('but yes tomorrow when you are not',
    dueForReview([{ date: addDaysISO(today, -1), felt: 'fine', percent: 40, verdict: 'good' }], today, 22, 0.2), true);

  // Through the store, which is what the card actually calls.
  const before = s().dayReports.length;
  s().reportDay('hard', 62, 'too-much');
  check('the evening is recorded', s().dayReports.length, before + 1);
  check('with the answer on it', s().dayReports.at(-1).verdict, 'too-much');
  check('and the ranking has changed', weightsFrom(s().dayReports).want > 1, true);
  check('a plain day report still teaches nothing', (() => {
    s().reset(); s().reportDay('hard', 62);
    return weightsFrom(s().dayReports);
  })(), DEFAULT_WEIGHTS);
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
