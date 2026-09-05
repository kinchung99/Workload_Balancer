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
  ['src/lib/simulate.ts', 'simulate.ts'],
  ['src/data/seed.ts', 'seed.ts'],
  ['src/state/store.ts', 'store.ts'],
]) {
  const src = readFileSync(join(root, from), 'utf8')
    .replace(/'@design\/tokens'/g, "'./tokens.ts'")
    .replace(/'@\/lib\/(\w+)'/g, "'./$1.ts'")
    .replace(/'@\/data\/(\w+)'/g, "'./$1.ts'")
    .replace(/'\.\/storage'/g, "'./storage.ts'");
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
export const isClient = false;
`,
);
writeFileSync(join(tmp, 'package.json'), '{"type":"module"}');

const { useStore, weekReading, liveCeiling, restOwedFrom, itemsOnDay } = await import(join(tmp, 'store.ts'));
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
  s().bookRecovery(river, river.slot);
  check('a protected block lands in the week', s().items.length, before + 1);
  check('the new block is marked as recovery', s().items.at(-1).isRecovery, true);
  check('it is no longer offered', s().booked.includes('river'), true);
  check('the ledger is credited', restOwedFrom(s().recovery) < owedBefore, true);
  check('credit equals the prescription', owedBefore - restOwedFrom(s().recovery), river.credit);
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
  s().suggestWindow();
  check('the free evening is suggested', s().windowSuggested, true);
  s().reset();
  check('reset restores the seeded week', s().errands.find((e) => e.id === 'e1').done, false);
}

rmSync(tmp, { recursive: true, force: true });
if (failures) { console.error(`\n  ${failures} behaviour(s) did not work.\n`); process.exit(1); }
console.log('\n  every button changes the state it claims to.\n');
