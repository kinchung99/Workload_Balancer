#!/usr/bin/env node
/**
 * Renders every route to static HTML and asserts the interface study's figures
 * actually reach the screen.
 *
 * The model check proves the maths. This proves the screens are wired to it -
 * that no component quietly hard-codes a percentage the model never produced.
 * Run: `npm run render:check`.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const out = mkdtempSync(join(tmpdir(), 'ballast-render-'));
console.log('  exporting...');
execFileSync('npx', ['expo', 'export', '--platform', 'web', '--output-dir', out], { stdio: 'pipe' });

/** Strip tags and React's SSR comment separators, collapse whitespace. */
const textOf = (route) =>
  readFileSync(join(out, route), 'utf8')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    // Keep aria-label values: a chart's spoken sentence is rendered content too.
    .replace(/<[^>]*?aria-label="([^"]*)"[^>]*>/g, ' $1 ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');

const EXPECTATIONS = [
  ['index.html', 'Home', [
    '13%',                                    // the battery: 100 - 87
    'Running on empty',
    'Something has to come off this week.',
    '13 percent charge. Running on empty.',   // spoken
    'YOUR AREAS', 'Mental', 'Time', 'Errands', 'Social', 'Physical',
    '0% left',                                // mental is over its ceiling
    '69% left',                               // physical has room
    "WHAT'S PULLING YOU DOWN", '\u2212104%', '\u221282%',
    'SUGGESTED FOR YOU', 'Walk the river loop', 'Start now',
    'Operating systems, part 2', 'Caf\u00e9 shift', 'Return the library books',
    '11h of rest owed',
  ]],
  ['areas.html', 'Areas', [
    'Your areas', 'EMPTIEST FIRST',
    'Mental, heavy, 104% of ceiling',        // the whole chart, spoken
    'Mental', 'Mood check-ins and what is contributing',
    'Physical', 'Meals, movement and sleep',
    'Errands', 'Batched into trips you can actually do',
  ]],
  ['actions.html', 'Simulator', [
    'What if I', 'NOW', 'PROJECTED', 'YOUR ACTIONS',
    'Sleep tonight', '6 hrs', 'Take a walk', 'Text a friend', 'Study session', 'Late-night screen',
    'Drag the sliders to see how tonight changes your level.',
    'Put this plan in my week',
  ]],
  ['areas/mental.html', 'Mental area', [
    'LOG YOUR MOOD', 'HIGH ENERGY', 'LOW ENERGY',
    "WHAT'S CONTRIBUTING?", 'Academics', 'Finances', 'Log check-in',
    'RECENT CHECK-INS', 'High Energy \u00b7 Unpleasant',
  ]],
  ['areas/time.html', 'Time area', [
    'HRS COMMITTED', 'HRS RECOVERY', 'Classes and work', 'Protected recovery',
    'Recovery blocks are protected time.',
  ]],
  ['areas/physical.html', 'Physical area', [
    'Tap and describe what you ate', "TODAY'S MEALS",
    'Breakfast', 'Ate \u00b7 Filling', 'Lunch', 'Light snack', 'Dinner', 'Not yet',
    'ACTIVITY TODAY', '4,200', '32 active min',
  ]],
  ['areas/social.html', 'Social area', [
    'LOW-EFFORT RECONNECTION', 'Sam K.', '9 days since you spoke',
    'CLOSE FRIENDS', 'Last spoke 5 days ago', 'Talked today',
    'YOUR CIRCLE', 'A WINDOW', 'Wednesday evening', '84%', 'heavy for 11 days',
  ]],
  ['areas/errands.html', 'Errands area', [
    'Tap and say what you need to do',
    'GROCERIES', 'Pick up oat milk', 'ADMIN', 'Pay the phone bill', 'ACADEMIC', 'Email Prof. Chen',
    'Batched by where they are.',
  ]],
  ['plan.html', 'Plan', [
    'Next week, 4%',           // 100 - 96, the same number the other way up
    'Tuesday to Thursday next week is a wall',
    'Four things inside seventy-two hours',
    'In 8 days',
    '8 days to move something. That is enough',
    'Networks lab report', 'Group presentation', 'Caf\u00e9 shift, covering Amin', "Aisyah's birthday dinner",
    'Movable', 'Hard',
  ]],
  ['rebalance.html', 'Rebalance', [
    '4%', '16%',              // charge before and after the four trades
    '4 changes selected, saving 34 load',
    'Hard deadline. Never suggested for moving',
    'Self-imposed, push to Sunday, saves 6',
    'Ask Jo to take it, saves 14',
    'Send your apologies, saves 9',
    'Batch into one trip Tuesday, saves 5',
    'Recovery. Protected, override if you must',
    'Not this week',
  ]],
  ['add.html', 'Add', [
    'Ballast read that as', 'Mental', '8 hours', 'Thu 13 Nov', 'Hard deadline', 'Dread 4', 'Load 32',
    'How much are you dreading it?', 'Already counted, set once', 'Repeats',
  ]],
  ['recover.html', 'Recover', ['Balance, last 14 days', '11h', 'deficit for 9 days straight', 'Last full day off', '23 days ago']],
  ['prescription.html', 'Prescription', ['Walk the river loop', 'Costs nothing', 'Under an hour', 'Alone', 'Put it in Thursday, 5pm']],
  ['decline/w11-birthday.html', 'Drafter', ["Aisyah's birthday dinner", 'Warm', 'Brief', 'Fully honest', "Actually, I'm going", 'Open in WhatsApp']],
  ['widget.html', 'Widget', ['Ballast', 'week 10', 'One thing today. The networks lab report', 'How was today?', '13%', 'Running on empty', 'Fine', 'Meh', 'Hard', 'That tap is the entire daily commitment']],
  ['foundations.html', 'Foundations', ['Colour is never the only signal', 'flat fill', 'diagonal hatch', 'cross hatch', 'vertical rule', 'colour taken away', '44 by 44 point minimum']],
];

let failures = 0;
for (const [file, name, needles] of EXPECTATIONS) {
  const text = textOf(file);
  const missing = needles.filter((needle) => !text.includes(needle));
  console.log(`  ${missing.length ? 'FAIL' : 'ok  '}  ${name.padEnd(14)} ${needles.length - missing.length}/${needles.length}`);
  for (const needle of missing) {
    failures += 1;
    console.log(`          missing: "${needle}"`);
  }
}

rmSync(out, { recursive: true, force: true });
if (failures) { console.error(`\n  ${failures} expectation(s) did not render.\n`); process.exit(1); }
console.log('\n  every figure in the interface study renders from the model.\n');
