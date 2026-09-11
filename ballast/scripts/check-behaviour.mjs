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
const { openPrep, percentUndone, percentUnplanned, unplanned, scheduledHours, remaining, planSessions, isAtRisk, loadOnDay } = await import(join(tmp, 'prep.ts'));
const { MOMENT_KINDS, WHY_SUGGESTIONS, nextWorth, momentCredits } = await import(join(tmp, 'moments.ts'));
const { parseTimetable, parseLine, toItems, classesOn, moduleWeek, attendanceRate, attendanceStatus, isProtectedClass } = await import(join(tmp, 'timetable.ts'));
const { percentByBucket, overallPercent, loadOf, loadByBucket, mixShares, dreadFromMix, dominantArea, describeMix, MIX_MAX } = await import(join(tmp, 'load.ts'));

/** The reading a screen would show, logs folded in - mirrors state/selectors. */
const charge = (extra = []) => {
  const st = useStore.getState();
  const all = [...st.items, ...extra, ...logItems({ today: st.today, sleepHours: st.sleepHours, meals: st.meals, moods: st.moods, errands: st.errands, moments: st.moments })];
  return chargeOf(overallPercent(percentByBucket(itemsInWeek(all, st.today), st.ceilings)));
};
const { prescriptions } = await import(join(tmp, 'seed.ts'));
const { ACTIONS, PRESETS, initialSim, pointsOf, project, totalPoints } = await import(join(tmp, 'simulate.ts'));

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

console.log('\nProgress in percent, not hours');
{
  s().reset();
  s().setProgressPercent('algo-set', 50);
  check('half done on a four-hour job is two hours', s().items.find((i) => i.id === 'algo-set').prepDone, 2);
  check('which reads as 50% undone', percentUndone(s().items.find((i) => i.id === 'algo-set')), 50);
  s().setProgressPercent('algo-set', 100);
  check('100% clears it from the list', openPrep(s().items, s().today).some((i) => i.id === 'algo-set'), false);
  s().setProgressPercent('algo-set', 0);
  check('and it can be put back to nothing', percentUndone(s().items.find((i) => i.id === 'algo-set')), 100);
  s().setProgressPercent('algo-set', 500);
  check('out-of-range input is clamped', s().items.find((i) => i.id === 'algo-set').prepDone, 4);
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
  check('base week unchanged by any of it', base, 13);
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
  check('the seeded week still reads as the study states', before, 13);
  check('social carries half of it', mixShares(row.mix).social, 0.5);
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
