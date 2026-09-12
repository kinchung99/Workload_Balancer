#!/usr/bin/env node
/**
 * Renders the model against the interface study's stated figures.
 *
 * Two kinds of number live here and it matters which is which.
 *
 * The **loads** are the study's, and they are the model's actual claim:
 * `load = hours x dread`, so the group presentation weighs 24 and the networks
 * lab report weighs 10 whatever else changes. Those are asserted against the
 * deck and must never move.
 *
 * The **percentages** are loads measured against Amira's ceilings, and a ceiling
 * is a personal fact the app is designed to move - see `recalibrate`. Hers were
 * raised once the battery turned out to sit pinned near empty in ordinary weeks,
 * which is a calibration decision rather than a model one. So they are asserted
 * against the current calibration, with the deck's original figure alongside.
 *
 * Run: `npm run model:check`.
 */
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = join(root, '.model-check');
rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });
// Node infers module type from the nearest package.json; the app's is CommonJS.
writeFileSync(join(tmp, 'package.json'), '{"type":"module"}');

// Node strips TS types natively but does not know the bundler path aliases.
for (const [from, to] of [
  ['src/design/tokens.ts', 'tokens.ts'],
  ['src/lib/types.ts', 'types.ts'],
  ['src/lib/dates.ts', 'dates.ts'],
  ['src/lib/load.ts', 'load.ts'],
  ['src/data/seed.ts', 'seed.ts'],
]) {
  const src = readFileSync(join(root, from), 'utf8')
    .replace(/'@design\/tokens'/g, "'./tokens.ts'")
    .replace(/'@\/lib\/(\w+)'/g, "'./$1.ts'")
    .replace(/'\.\/(\w+)'/g, "'./$1.ts'");
  writeFileSync(join(tmp, to), src);
}

const { seedItems, CEILINGS, TODAY } = await import(join(tmp, 'seed.ts'));
const { percentByBucket, overallPercent, loadByBucket, BUCKETS, sumLoad, loadOf } = await import(join(tmp, 'load.ts'));
const { isSameWeek, addDays } = await import(join(tmp, 'dates.ts'));

const week = (anchor) => seedItems.filter((i) => isSameWeek(i.date, anchor));
const W10 = week(TODAY);
const W11 = week(addDays(TODAY, 7));

const p10 = percentByBucket(W10, CEILINGS);
const p11 = percentByBucket(W11, CEILINGS);

let failures = 0;
const check = (label, actual, want, source = 'deck') => {
  const ok = actual === want;
  if (!ok) failures += 1;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label.padEnd(34)} got ${String(actual).padStart(4)}   ${source} ${want}`);
};

// The study's own loads. These are the model, and they do not move.
console.log('\nWeek 10 load by bucket (deck pages 1 and 3)');
const load10 = loadByBucket(W10);
for (const [b, want] of Object.entries({ mental: 104, time: 68, errands: 19.3, social: 10, physical: 3 })) {
  check(b, load10[b], want);
}

// Loads against Amira's ceilings. Raised from the deck's, so the battery sits
// where a student can actually work with it - see the header.
console.log('\nWeek 10 against her ceilings (calibrated, was 104/82/74/58/31)');
const calibrated = { mental: 65, time: 43, errands: 57, social: 42, physical: 17 };
for (const b of BUCKETS) check(b, p10[b], calibrated[b], 'now ');

console.log('\nHeadline percentages (deck read 87 and 96 on the old ceilings)');
check('week 10 overall (page 1)', overallPercent(p10), 53, 'now ');
check('week 11 overall (page 5)', overallPercent(p11), 59, 'now ');
check('week 10 charge, what Home shows', 100 - overallPercent(p10), 47, 'now ');

console.log('\nWeek 11 trade prices (page 6)');
const byId = Object.fromEntries(seedItems.map((i) => [i.id, i]));
check('chapter 9 reading saves', loadOf(byId['w11-ch9']), 6);
check('café shift covering Amin saves', loadOf(byId['w11-amin']), 14);
check("Aisyah's birthday dinner saves", loadOf(byId['w11-birthday']), 9);
check('networks lab report load (page 5)', loadOf(byId['w11-net-lab']), 10);
check('group presentation load (page 5)', loadOf(byId['w11-pres']), 24);

const town = W11.filter((i) => i.place === 'in town');
check('four errands in town, batched saves', sumLoad(town) - 3, 5);

// The rebalance meter. The deck prints "96% -> 71%, saving 46 load" but its own
// four listed savings sum to 34, and no consistent model turns 34 into 25 points.
// The app computes rather than quotes, so the meter shows the honest end state.
const SELECTED = ['w11-ch9', 'w11-amin', 'w11-birthday'];
const kept = W11.filter((i) => !SELECTED.includes(i.id) && i.place !== 'in town');
const batched = [{ ...byId['w11-pharmacy'], id: 'batched', hours: 1.5, dread: 2 }];
const after = overallPercent(percentByBucket([...kept, ...batched], CEILINGS));
const saved = SELECTED.reduce((t, id) => t + loadOf(byId[id]), 0) + 5;

console.log('\nRebalance, four changes applied (page 6)');
console.log(`  ..    load returned                     got ${String(saved).padStart(4)}   deck 46  (deck's own rows sum to 34)`);
console.log(`  ..    week 11 after                     got ${String(after).padStart(4)}%  deck 71% (illustrative)`);
check('rebalancing is worth nine points of battery', (100 - after) - (100 - overallPercent(p11)), 9, 'aim ');

console.log('\nRaw week 10 load by bucket');
console.log(' ', JSON.stringify(loadByBucket(W10)));
console.log('  ceilings', JSON.stringify(CEILINGS));

rmSync(tmp, { recursive: true, force: true });
if (failures) { console.error(`\n  ${failures} figure(s) are not what they should be.\n`); process.exit(1); }
console.log('\n  model matches the study, and the calibration is where we set it.\n');
