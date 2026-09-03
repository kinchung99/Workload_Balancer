#!/usr/bin/env node
/**
 * Renders the model against the interface study's stated figures.
 *
 * The deck quotes specific numbers on pages 1, 3, 5 and 6. This proves the seed
 * plus lib/load.ts actually produce them, rather than a component hard-coding a
 * percentage that nothing computes. Run: `npm run model:check`.
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

const expected = { mental: 104, time: 82, errands: 74, social: 58, physical: 31 };
let failures = 0;
const check = (label, actual, want) => {
  const ok = actual === want;
  if (!ok) failures += 1;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label.padEnd(34)} got ${String(actual).padStart(4)}   deck ${want}`);
};

console.log('\nWeek 10 buckets (deck page 1 and 3)');
for (const b of BUCKETS) check(b, p10[b], expected[b]);

console.log('\nHeadline percentages');
check('week 10 overall (page 1)', overallPercent(p10), 87);
check('week 11 overall (page 5)', overallPercent(p11), 96);

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

console.log('\nRaw week 10 load by bucket');
console.log(' ', JSON.stringify(loadByBucket(W10)));
console.log('  ceilings', JSON.stringify(CEILINGS));

rmSync(tmp, { recursive: true, force: true });
if (failures) { console.error(`\n  ${failures} figure(s) do not match the interface study.\n`); process.exit(1); }
console.log('\n  model matches the interface study.\n');
