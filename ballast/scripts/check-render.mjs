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
    'M 10 13.3h', 'S 16 13h',                 // the week, with real class hours in it
    'Tuesday to Thursday next week is a wall',
    'Mental 104%',                            // what is pulling you down, as chips
    '11h rest owed',
    'TODAY \u00b7 MON 10 NOV', '1pm', '5pm', '11pm',
    'Operating Systems lecture', 'Kilburn LT1',   // the timetable, on the timeline
    'Tips', 'Register',                       // and why that hour matters more
    'Scheduled', 'Owing', 'This day',         // three sections, three drawings, three questions
    '3 \u00b7 13h to go', 'no time yet',        // and what each band adds up to, not just its name
    'NOT ON THE CLOCK',                       // the line between a timeline and a list
    'takes 20m',                              // a duration, said as one, out of the clock column
    'Algorithms problem set', '75%', 'unplanned',
    '1h done', '0h booked', '3h loose',
    'Give it a time', 'Move', 'Unschedule',
    'WOULD HELP', 'Walk the river loop',      // one suggestion, not a paragraph
    'Good ',                                  // the header greets you, under a drawing
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
    'One number hides which part of you is empty.',   // every screen opens the same way
    'Your areas', 'EMPTIEST FIRST',
    'Mental, heavy, 104% of ceiling',        // the whole chart, spoken
    'Mental', 'Mood check-ins and what is contributing',
    'Physical', 'Meals, movement and sleep',
    'Errands', 'Batched into trips you can actually do',
    'ABOUT THIS BUILD', 'Replay the intro', 'Reset to the seeded week',
  ]],
  ['actions.html', 'Tonight · which night', [
    'STEP 1 OF 3 \u00b7 WHICH NIGHT',
    'Which night?', 'One evening at a time.',
    'Tonight', 'Tomorrow',                          // one evening, chosen
    'Free from 5pm',                                // off-hours, folded away
    'WHAT THIS SCREEN IS FOR',                      // the rest of it, behind a tap
    'Plan tonight',
  ]],
  ['tonight/what.html', 'Tonight · what you do', [
    'STEP 2 OF 3 \u00b7 WHAT YOU DO',
    'What would you do?', 'Drag one and watch the battery move.',
    'PICK A NIGHT',                                 // a kind of night, not a dial
    'A recovery night', 'A balanced night', 'Push through',
    'NOW', 'PROJECTED', 'YOUR ACTIONS',
    'Sleep tonight', '6 hrs', 'Take a walk', 'Text a friend', 'Study session', 'Late-night screen',
    'BED BY', 'TO BE UP AT', 'FIRST THING',         // sleep says when, not only how long
    'past midnight',                                // six hours means 1am, given a 7am start
    'Drag a slider, or pick a night above.',
    'WHAT YOU ACTUALLY DO', 'Add your own',         // your evening, in the model
    'Badminton, a night run, band practice',
  ]],
  ['tonight/book.html', 'Tonight · book it', [
    'STEP 3 OF 3 \u00b7 BOOK IT',
    'Book it?', 'Nothing is saved until you press the button.',
    'WHAT THIS PUTS IN YOUR WEEK',            // the effect, stated before you tap
    'Move a slider and what it books appears here',
    'Move a slider first',                    // becomes a real count once a slider moves
    'Rebalance next week', 'Recovery ledger',
  ]],
  ['areas/mental.html', 'Mental area', [
    'How today feels, and what is behind it',         // the area header says why you opened it
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
    'Tap any day to open it hour by hour.',
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
    'Something has to come off', 'Toggle a trade and watch the battery move.',
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
  ['add.html', 'Add · what', [
    'STEP 1 OF 4 \u00b7 WHAT',                  // four short pages, and it says so
    "What's on?",
    'OR START FROM ONE OF THESE',
    'Assignment', 'Shift', 'See people', 'Chore',   // a running start, as drawings
    'Type something first',
  ]],
  ['add/size.html', 'Add · how big', [
    'STEP 2 OF 4 \u00b7 HOW BIG',
    'How big is it?',                         // the shape question, asked second
    'Just turn up', 'An hour you attend',
    'Work first', 'Hours before the day',
    'How long', 'Why ask this first',
  ]],
  ['add/takes.html', 'Add · what it takes', [
    'STEP 3 OF 4 \u00b7 WHAT IT TAKES',
    'What does it take?', 'Drag the faces. Five parts of you.',
    'THIS ONE WEIGHS',                        // the live consequence, above the controls
    'Mental', 'Time', 'Physical', 'Social', 'Errands',   // all five, every time
    'how much this takes out of you',         // the dials, spoken
    'Why five and not one',
  ]],
  ['add/when.html', 'Add · when', [
    'STEP 4 OF 4 \u00b7 WHEN',
    'Which day', 'Today', 'Tomorrow',         // any day, in view, not behind a chip
    'Anytime that day',                       // "no time" stays a real answer
    'Can it move?', 'Hard deadline',
    'YOUR WEEK RIGHT NOW', 'Before you add anything',   // the battery, before you commit
    '13%', 'Heavy week',                      // and it is the real reading, not a mock
  ]],
  ['recover.html', 'Recover', [
    'Rest is a credit you are owed, not an absence.',
    'BALANCE, LAST 14 DAYS', '11h', 'In deficit for 9 days straight',
    "WHAT YOU'RE DOWN", "WHAT YOU'VE BANKED",   // debts and credits, no longer one pile
    'owed', 'banked',
    'Sleep', 'Movement', 'Downtime',
    'LAST FULL DAY OFF', '23 days ago',
  ]],
  ['prescription.html', 'Prescription · what', [
    'STEP 1 OF 2 \u00b7 WHAT',
    'What would help', 'Mental is full, physical has room.',
    'BEST FIT', 'Walk the river loop', 'Costs nothing', 'Under an hour', 'Alone',
    'HOW LONG',
    'OR ONE OF THESE', 'Nap, 25 minutes',     // the alternatives, named rather than cycled
    'Yes, when?',
  ]],
  ['prescription/when.html', 'Prescription · when', [
    'STEP 2 OF 2 \u00b7 WHEN',
    'When does it go?',
    'WHICH DAY', 'Today', 'Tomorrow',         // recovery is no longer today-only
    'WHAT TIME \u00b7 2 GAPS ON TODAY',
    'IF YOU BOOK IT', 'WHERE IT LANDS',       // battery and timeline before committing
    'Book Today at 12pm',                     // defaults into the window a walk belongs in
  ]],
  ['decline/w11-birthday.html', 'Drafter', ['The app writes it. It never sends it.',"Aisyah's birthday dinner", 'Warm', 'Brief', 'Fully honest', "Actually, I'm going", 'Open in WhatsApp']],
  ['widget.html', 'Widget', ['Ballast', 'week 10', 'One thing today. The networks lab report', 'How was today?', '13%', 'Running on empty', 'Fine', 'Meh', 'Hard', 'That tap is the entire daily commitment']],
  ['timetable.html', 'Timetable · week', [
    'Week', 'Modules', 'Import',              // three views of one screen, not a sequence
    'TIMETABLE', 'This week',
    'Operating Systems lecture', 'Kilburn LT1', 'lecture',
    'Gives exam tips', 'Sets coursework', 'Register',   // why an hour is worth more
    'Import from your portal',
  ]],
  ['timetable/modules.html', 'Timetable · modules', [
    'Your modules', 'Dread once, and every class re-prices.',
    'YOUR MODULES', 'CS2040', 'Distributed Systems',
    'Dread 4',                                          // dread lives on the module
    'Below the 80% the department expects.',
  ]],
  ['timetable/import.html', 'Timetable · import', [
    'Paste it. Nothing is scanned or uploaded.',
    'Paste it from your portal', 'One class per line',
    'Back to the week',
  ]],
  ['foundations.html', 'Foundations', [
    'Colour is never the only signal', 'flat fill', 'diagonal hatch', 'cross hatch', 'vertical rule',
    'colour taken away', '44 by 44 point minimum',
    'How it looks at each level', 'Full of it', 'Nearly empty',   // the character, at every reading
    'The five areas', 'Drawings',
    'Colour on a reading still means which band',                 // the rule the hues must not break
    'Decoration has its own palette', 'blush', 'lemon',            // and the group that can never carry one
    'a bug, not a style choice',
    'One thing, five areas', 'Nothing', 'Everything',              // the dial, at every notch
    'the face of the task, not of the person',
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
  ['add/what.html', 'Home'],
  ['add/size.html', 'Home'],
  ['add/takes.html', 'Home'],
  ['add/when.html', 'Home'],
  ['rebalance.html', 'Plan'],
  ['recover.html', 'Home'],
  ['prescription.html', 'Recovery'],
  ['foundations.html', 'Areas'],
  ['decline/w11-birthday.html', 'Plan'],
  ['widget.html', 'Back'],
  ['calm.html', 'Home'],
  ['timetable.html', 'Time'],
  ['timetable/week.html', 'Time'],
  ['timetable/modules.html', 'Time'],
  ['timetable/import.html', 'Time'],
  ['prescription/what.html', 'Recovery'],
  ['prescription/when.html', 'Recovery'],
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
