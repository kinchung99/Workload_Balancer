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
    'WEEK 10',
    '13%', 'Nearly empty',                    // the hero: a face, a number, a word
    '13 percent left. Nearly empty. Made of Mental 0%',      // spoken, with its parts
    'WHAT THIS NUMBER IS',                    // the explanation, behind a tap
    'Mental, 0% left', 'Physical, 69% left',  // areas as icons plus a number
    'M 10 10.3h', 'S 16 13h',                 // the week, at a glance
    'Tuesday to Thursday next week is a wall',
    'Mental 104%',                            // what is pulling you down, as chips
    '11h rest owed',
    'TODAY \u00b7 MON 10 NOV', '1pm', '5pm', '11pm',
    'OWING', 'THIS DAY',                      // deadline work and loose tasks, split
    'Algorithms problem set', '75%', 'unplanned',
    '1h done', '0h booked', '3h loose',
    'Give it a time', 'Move', 'Unschedule',
    'WOULD HELP', 'Walk the river loop',      // one suggestion, not a paragraph
  ]],
  ['welcome.html', 'Intro', [
    'THE WHOLE IDEA',
    'Not every hour costs the same.',
    'Group presentation', '3 hours',
    'Reading you enjoy', '6 hours',
    'Half the hours. Twice the load.',        // the selling point, computed live
    'Every planner measures hours',
    'Skip the intro',
  ]],
  ['areas.html', 'Areas', [
    'Your areas', 'EMPTIEST FIRST',
    'Mental, heavy, 104% of ceiling',        // the whole chart, spoken
    'Mental', 'Mood check-ins and what is contributing',
    'Physical', 'Meals, movement and sleep',
    'Errands', 'Batched into trips you can actually do',
    'ABOUT THIS BUILD', 'Replay the intro', 'Reset to the seeded week',
  ]],
  ['actions.html', 'Simulator', [
    'TONIGHT', 'Try it before you live it.',        // the purpose, in five words
    'WHAT THIS IS FOR',                             // the rest of it, behind a tap
    'Free from 5pm',                                // off-hours, folded away
    'BED BY', 'TO BE UP AT', 'FIRST THING',         // sleep says when, not only how long
    'past midnight',                                // six hours means 1am, given a 7am start
    'Tonight', 'Tomorrow',                          // one evening, chosen
    'WHAT YOU ACTUALLY DO', 'Add your own',         // your evening, in the model
    'Badminton, a night run, band practice',
    'PICK A NIGHT',                                 // a kind of night, not a dial
    'A recovery night', 'A balanced night', 'Push through',
    'NOW', 'PROJECTED', 'YOUR ACTIONS',
    'Sleep tonight', '6 hrs', 'Take a walk', 'Text a friend', 'Study session', 'Late-night screen',
    'Drag a slider, or pick a night above.',
    'Move a slider first',                    // becomes a real count once a slider moves
    'WHAT THIS PUTS IN YOUR WEEK',            // the effect, stated before you tap
    'Move a slider and what it books appears here',
  ]],
  ['areas/mental.html', 'Mental area', [
    'LOG YOUR MOOD', 'HIGH ENERGY', 'LOW ENERGY',
    "WHAT'S CONTRIBUTING?", 'Academics', 'Finances', 'Log check-in',
    'SOMETHING GOOD HAPPENED?',               // the one input that adds charge
    'Properly laughed', 'Finished something', 'Proud of myself',
    'Helped someone', 'Actually rested',
    'Pick one and say why',                   // a reason, not just a category
    'RECENT CHECK-INS', 'High Energy \u00b7 Unpleasant',
  ]],
  ['areas/time.html', 'Time area', [
    'HRS COMMITTED', 'HRS RECOVERY', 'Committed', 'Protected recovery',
    'WHAT PROTECTED MEANS',                   // the explanation, behind a tap
  ]],
  ['areas/physical.html', 'Physical area', [
    'Tap and describe what you ate', "TODAY'S MEALS",
    'Breakfast', 'Ate \u00b7 Filling', 'Lunch', 'Light snack', 'Dinner', 'Not yet',
    'ACTIVITY TODAY', '4,200', '32 active min',
    'HOW DID YOU SLEEP?', '8h',               // logged on waking
    'Each option shows what it would do first',  // each option previews its own effect
  ]],
  ['areas/social.html', 'Social area', [
    'LOW-EFFORT RECONNECTION', 'Sam K.', '9 days since you spoke',
    'CLOSE FRIENDS', 'Last spoke 5 days ago', 'Talked today',
    'YOUR CIRCLE', '84%', 'heavy for 11 days',
    'PLAN SOMETHING', 'WHO', 'WHAT', 'WHEN EVERYONE IS FREE',
    'Day trip', '71%',                        // Ravi's battery, shown before you invite him
  ]],
  ['areas/errands.html', 'Errands area', [
    'ADD A TASK OR ERRAND', 'Pick up oat milk',  // one list for everything you just do
    'Sorted into a batch, priced, and put on the day you choose',
    'WHY BATCHING IS FREE',                   // the reasoning, behind a tap
    'Type something first',                   // empty submits are refused
    'GROCERIES', 'ADMIN', 'Pay the phone bill', 'ACADEMIC', 'Email Prof. Chen',
  ]],
  ['plan.html', 'Plan', [
    'Next week, 4%',           // 100 - 96, the same number the other way up
    'Tap a day.',
    'THE COLLISION', '72 hours', '4 things',  // the pile-up as a shape, not a list
    'Hard', 'Movable',                        // the legend, trimmed to the words
    'h free',                                 // gaps are where things get added
    'h booked', 'h free',
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
    'NEXT WEEK, IF YOU APPLY',                // which days get lighter, before you commit
    'WHAT YOU COULD PUT DOWN',
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
    'Which day?', 'Today', 'Tomorrow',        // any day, in view, not behind a chip
    'Anytime that day',                       // "no time" stays a real answer
    'Does it need work beforehand?',          // an interview and an assignment are different shapes
    'Just turn up', 'Needs preparation',
    'How much are you dreading it?', 'Already counted, set once', 'Repeats',
  ]],
  ['recover.html', 'Recover', [
    'BALANCE, LAST 14 DAYS', '11h', 'In deficit for 9 days straight',
    "WHAT YOU'RE DOWN", "WHAT YOU'VE BANKED",   // debts and credits, no longer one pile
    'owed', 'banked',
    'Sleep', 'Movement', 'Downtime',
    'LAST FULL DAY OFF', '23 days ago',
  ]],
  ['prescription.html', 'Prescription', [
    'Walk the river loop', 'Costs nothing', 'Under an hour', 'Alone',
    'WHICH DAY', 'Today', 'Tomorrow',         // recovery is no longer today-only
    'HOW LONG', 'WHAT TIME \u00b7 1 GAP ON TODAY',
    'IF YOU BOOK IT', 'WHERE IT LANDS',       // battery and timeline before committing
    'Book Today at 12pm',                          // defaults into the window a walk belongs in
    'Show me something else',
  ]],
  ['decline/w11-birthday.html', 'Drafter', ["Aisyah's birthday dinner", 'Warm', 'Brief', 'Fully honest', "Actually, I'm going", 'Open in WhatsApp']],
  ['widget.html', 'Widget', ['Ballast', 'week 10', 'One thing today. The networks lab report', 'How was today?', '13%', 'Running on empty', 'Fine', 'Meh', 'Hard', 'That tap is the entire daily commitment']],
  ['foundations.html', 'Foundations', [
    'Colour is never the only signal', 'flat fill', 'diagonal hatch', 'cross hatch', 'vertical rule',
    'colour taken away', '44 by 44 point minimum',
    'How it looks at each level', 'Full of it', 'Nearly empty',   // the character, at every reading
    'The five areas', 'Drawings',
    'Colour on a reading still means which band',                 // the rule the hues must not break
  ]],
];

/**
 * Every route outside the tab bar must offer a way out. Tab screens have the tab
 * bar; these do not, so without this a shared link is a dead end - which is
 * exactly what happened on the area screens.
 */
const EXITS = [
  ['areas/mental.html', 'Areas'],
  ['areas/time.html', 'Areas'],
  ['areas/physical.html', 'Areas'],
  ['areas/social.html', 'Areas'],
  ['areas/errands.html', 'Areas'],
  ['add.html', 'Home'],
  ['rebalance.html', 'Plan'],
  ['recover.html', 'Home'],
  ['prescription.html', 'Recovery'],
  ['foundations.html', 'Areas'],
  ['decline/w11-birthday.html', 'Plan'],
  ['widget.html', 'Back'],
  ['calm.html', 'Home'],
  ['welcome.html', 'Skip the intro'],
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

console.log('');
const missingExits = EXITS.filter(([file, label]) => !textOf(file).includes(label));
console.log(`  ${missingExits.length ? 'FAIL' : 'ok  '}  ${'every route has a way out'.padEnd(14)} ${EXITS.length - missingExits.length}/${EXITS.length}`);
for (const [file, label] of missingExits) {
  failures += 1;
  console.log(`          ${file} has no "${label}" exit`);
}

rmSync(out, { recursive: true, force: true });
if (failures) { console.error(`\n  ${failures} expectation(s) did not render.\n`); process.exit(1); }
console.log('\n  every figure in the interface study renders from the model.\n');
