#!/usr/bin/env node
/**
 * Fails if figma/tokens.json and src/design/tokens.ts have drifted.
 *
 * tokens.json is what Figma imports; tokens.ts is what the app renders. If a
 * designer changes a variable in Figma and exports, or an engineer edits the TS,
 * this is the thing that notices. Run it in CI: `npm run tokens:check`.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dtcg = JSON.parse(readFileSync(join(root, 'figma/tokens.json'), 'utf8'));
const ts = readFileSync(join(root, 'src/design/tokens.ts'), 'utf8');

/** Walk the DTCG tree and yield [dottedPath, value] for every leaf token. */
function* leaves(node, path = []) {
  if (node && typeof node === 'object' && '$value' in node) {
    yield [path.join('.'), node.$value];
    return;
  }
  for (const [k, v] of Object.entries(node ?? {})) {
    if (k.startsWith('$')) continue;
    yield* leaves(v, [...path, k]);
  }
}

const problems = [];
let checked = 0;

for (const [path, value] of leaves(dtcg)) {
  // Only scalar colour / dimension / number tokens are mechanically comparable.
  const isColor = typeof value === 'string' && /^#[0-9A-F]{6}$/i.test(value);
  const isDim = typeof value === 'string' && /^-?\d+(\.\d+)?px$/.test(value);
  const isNum = typeof value === 'number';
  if (!isColor && !isDim && !isNum) continue;

  const needle = isDim ? value.replace('px', '') : isColor ? value : String(value);
  checked += 1;
  // The TS mirror must contain the literal somewhere. Cheap, but it catches the
  // failure that actually happens: a hex or a step gets edited on one side only.
  const found = isColor
    ? new RegExp(needle.replace('#', '#'), 'i').test(ts)
    : new RegExp(`(^|[^\\w.])${needle}([^\\w.]|$)`, 'm').test(ts);
  if (!found) problems.push(`${path} = ${value} is in tokens.json but not in tokens.ts`);
}

// And the reverse for colours: no hex may exist in TS that Figma has never heard of.
const jsonHexes = new Set([...leaves(dtcg)].map(([, v]) => String(v).toUpperCase()).filter(v => /^#[0-9A-F]{6}$/.test(v)));
for (const hex of ts.match(/#[0-9A-Fa-f]{6}/g) ?? []) {
  if (!jsonHexes.has(hex.toUpperCase())) problems.push(`${hex} is in tokens.ts but not in tokens.json`);
}

if (problems.length) {
  console.error(`\n  tokens out of sync (${problems.length} problem${problems.length > 1 ? 's' : ''}):\n`);
  for (const p of problems) console.error(`    - ${p}`);
  console.error('\n  Fix both figma/tokens.json and src/design/tokens.ts, then re-run.\n');
  process.exit(1);
}

console.log(`  tokens in sync: ${checked} scalar tokens verified against src/design/tokens.ts`);
