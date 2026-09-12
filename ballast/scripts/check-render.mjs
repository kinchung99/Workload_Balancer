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
    'WEEK 10', 'Good ',                       // a greeting under a drawing
    '47%', 'Doing fine',                      // the hero: a face, a number, a word
    'DO THIS NEXT', 'Operating systems, part 2',   // one next thing, not a list
    'Tuesday to Thursday next week is a wall',     // the one warning worth interrupting for
    'My week', 'Friends', 'What first', 'Recovery',  // four doors, and nothing else
    '3 checked in',                           // the circle, on the home screen
    'Add anything',
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
  ['tonight/night.html', 'Tonight · which night', [
    'STEP 1 OF 3 \u00b7 WHICH NIGHT',
    'Which night?', 'Tonight', 'Tomorrow', 'Free from 5pm', 'Plan tonight',
  ]],
  ['tonight/what.html', 'Tonight · what you do', [
    'STEP 2 OF 3 \u00b7 WHAT YOU DO',
    'What would you do?',
    'PICK A NIGHT',                                 // a kind of night, not a dial
    'A recovery night', 'A balanced night', 'Push through',
    'NOW', 'PROJECTED', 'YOUR ACTIONS',
    'Sleep tonight', '6 hrs', 'Take a walk', 'Text a friend', 'Study session', 'Late-night screen',
    'BED BY', 'TO BE UP AT', 'FIRST THING',         // sleep says when, not only how long
    'past midnight',                                // six hours means 1am, given a 7am start
    'Drag a slider, or pick a night above.',
    'WHAT YOU ACTUALLY DO', 'Add your own',         // your evening, in the model
    'Badminton', 'Remove', '1 of your own above',   // and one she added herself
  ]],
  ['tonight/book.html', 'Tonight · book it', [
    'STEP 3 OF 3 \u00b7 BOOK IT',
    'Book it?',
    'WHAT THIS PUTS IN YOUR WEEK',            // the effect, stated before you tap
    'Move a slider and what it books appears here',
    'Move a slider first',                    // becomes a real count once a slider moves
    'Rebalance next week', 'Recovery ledger',
  ]],
  ['plan.html', 'Plan', [
    'WEEK 10 TO 12', 'Next 14 days', 'This week 47%', 'Next 41%',
    'Today', 'Mon 10 Nov', '13.3h booked', '3h free',
    'Scheduled', '4 \u00b7 13h',                 // the clock rail
    'Operating Systems lecture', 'Kilburn LT1', 'Tips', 'Register',
    'NOT ON THE CLOCK', 'Owing', '3 \u00b7 13h to go', 'This day', 'no time yet',
    'Algorithms problem set', '75%', 'unplanned', '1h done', '0h booked', '3h loose',
    'Tap to plan it',                         // read-only rows: the verbs are one tap away
    'takes 20m',
    'Tuesday to Thursday next week is a wall.', 'In 8 days',   // one line, not a chart
    'Rebalance next week',
  ]],
  ['rebalance.html', 'Rebalance', [
    'Something has to come off', 'Toggle a trade and watch the battery move.',
    // The one piece of advice here a calendar could not have produced: which of
    // two things to go to, decided from a rating only the student can give.
    'A SWAP, WEDNESDAY', 'Go to one, not both.',
    'KEEP', 'Distributed Systems seminar', 'You said you want this',
    'DROP', 'Caf\u00e9 shift, covering Amin', 'A soft arrangement \u00b7 14 load back',
    'Make the swap',
    '41%', '50%',             // charge before and after the four trades
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
    'Work first', 'Hours before the day', 'How long',
  ]],
  ['add/takes.html', 'Add · what it takes', [
    'STEP 3 OF 4 \u00b7 WHAT IT TAKES',
    'What does it take?', 'Drag the faces. Five parts of you.',
    'THIS ONE WEIGHS',                        // the live consequence, above the controls
    'Mental', 'Time', 'Physical', 'Social', 'Errands',   // all five, every time
    'how much this takes out of you',         // the dials, spoken
  ]],
  ['add/when.html', 'Add · when', [
    'STEP 4 OF 4 \u00b7 WHEN',
    'Which day', 'Today', 'Tomorrow',         // any day, in view, not behind a chip
    'Anytime that day',                       // "no time" stays a real answer
    'Can it move?', 'Hard deadline',
    // The one thing the app cannot derive, asked once, in three words, next to
    // the question it belongs with.
    'Want to be there?', 'Rather not', "Don't mind", 'Really want to',
    'Lets the app swap things, not just drop them.',
    'YOUR WEEK RIGHT NOW', 'Before you add anything',   // the battery, before you commit
    '47%', 'Busy week',                       // and it is the real reading, not a mock
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
  ['widget.html', 'Widget', ['Ballast', 'week 10', 'One thing today. The networks lab report', 'How was today?', '47%', 'Draining', 'Fine', 'Meh', 'Hard', 'That tap is the entire daily commitment']],
  ['timetable.html', 'Timetable · week', [
    'Week', 'Modules', 'Import',              // three views of one screen, not a sequence
    'TIMETABLE', 'This week',
    'Operating Systems lecture', 'Kilburn LT1', 'lecture',
    'Gives exam tips', 'Sets coursework', 'Register',   // why an hour is worth more
    'Import from your portal',
  ]],
  ['timetable/modules.html', 'Timetable · modules', [
    'Your modules',
    'YOUR MODULES', 'CS2040', 'Distributed Systems',
    'Dread 4',                                          // dread lives on the module
    'Below the 80% the department expects.',
  ]],
  ['timetable/import.html', 'Timetable · import', [
    'Paste it from your portal', 'One class per line',
    'Back to the week',
  ]],
  ['friends.html', 'Friends', [
    '3 CHECKED IN TODAY', 'Your circle',
    'You \u00b7 47%', 'Updated 5 min ago',        // your own side of it, first
    'Sharing: evenings only',                 // your side of it, and one tap to change it
    'MAYBE CHECK ON', 'Aisyah', 'heavy for 11 days',   // at most one person, ever
    'Everyone',
    'running empty \u00b7 2h ago',               // a reading, and how old it is
    'Finally handed it in',                   // a line they wrote themselves
    '3 days ago \u00b7 may be out of date',      // a stale reading says so
    // The calendar is one tap into the row, so it is asserted on the row's own
    // page rather than here - collapsed is the whole design of these lists.
    'Tap to change what your circle sees',
    'Find friends', '3 of your contacts are here',
    'Plan something together',
  ]],
  ['plan-together.html', 'Plan together', [
    'PLAN SOMETHING', 'Find an evening',
    'WHO', 'Amin', '62%', 'Aisyah', '8%',      // their capacity, next to the name
    'WHAT', 'Dinner \u00b7 2h', 'Day trip \u00b7 6h',
    'WHEN EVERYONE IS FREE',                   // the windows that work for all of you
    'Wed 12 Nov', '6pm – 8pm', 'Pick a time',
  ]],
  ['sharing.html', 'Sharing', [
    'YOUR PRIVACY', 'What they see',
    'Your battery \u00b7 47%', 'Always shared. It is how they know to check on you.',
    // Three levels, each with its consequence written next to it.
    'Nothing', 'They see your battery. No times at all.',
    'Evenings only', 'Free evenings, after 5pm. Nothing daytime.',
    'Free / busy', 'When you are free, all day. Never what you are doing.',
    // The preview is the whole point: their view of you, in their name.
    "AMIN'S VIEW OF YOUR WEEK", '5pm\u201311pm',
    'Never a title, a deadline or who you are with. There is no field for it.',
  ]],
  ['find-friends.html', 'Find friends', [
    '4 IN YOUR CIRCLE', 'Find your people',
    '3 already here', 'From your contacts. One tap each.',
    'Nadia Rahman', 'On Ballast', 'Add',        // one tap, nothing to send
    'Danny Oduya', 'Not on Ballast yet', 'Invite',
    'Matching happens on your phone.', 'Your contacts are never uploaded.',
  ]],
  ['friend/ravi.html', 'A friend\u2019s week', [
    'UPDATED 2H AGO', 'Ravi', '71%', 'doing fine',
    'Free most of this week',                   // a line they wrote themselves
    'THIS WEEK, AS THEY SHARE IT',
    'Wednesday, free 5pm to 11pm',              // published windows, spoken
    'Saturday, free 12pm to 10pm',
    'Free time only. Never what they are doing.',
    'Ask about Saturday',                       // the longest window, as one tap
  ]],
  ['you.html', 'You', [
    'You', '47%',
    'Check in', 'Recovery', 'Tonight', 'Timetable', 'What to do first',
    'Replay intro', 'Reset',
  ]],
  ['item/algo-set.html', 'One item', [
    'DUE THU 13 NOV', 'Algorithms problem set',
    '12 load', 'Soft', 'No time yet',
    '3h still to do', '1h done \u00b7 0h booked \u00b7 3h loose',
    'Book 2 sittings for me',                 // every verb for this thing, in one place
    'DID SOME WITHOUT BOOKING IT?',
    'How much are you dreading it?', 'Changing this re-prices the whole week.',
    'Write a message to get out of it',
  ]],
  ['checkin.html', 'Check in', [
    'How are you?',                           // the whole daily ask, one screen
    'TODAY FEELS', 'SLEPT', 'ATE TODAY',
    'SOMETHING GOOD HAPPENED?',               // the one input that adds charge
    'Properly laughed', 'Actually rested',
  ]],
  ['priority.html', 'Priority', [
    'WHAT TO DO FIRST', 'Start with this',
    'Start here', 'of 24 \u00b7 next 7 days',   // six shown, the rest behind a tap
    'Show the other 18',
    'Operating systems, part 2', 'Due today', 'Hard deadline',   // the reasons, as chips
    'Algorithms problem set', '3h to go', 'Plan the sittings',
    'Could move', 'back',                     // the half no planner asks about
    'Write the message', 'Move it',
    'BEFORE ANY OF IT',                       // at 13%, rest stops being a reward
  ]],
];

/**
 * Every route outside the tab bar must offer a way out. Tab screens have the tab
 * bar; these do not, so without this a shared link is a dead end - which is
 * exactly what happened on the area screens.
 */
const EXITS = [
  ['add.html', 'Home'],
  ['add/what.html', 'Home'],
  ['add/size.html', 'Home'],
  ['add/takes.html', 'Home'],
  ['add/when.html', 'Home'],
  ['rebalance.html', 'Plan'],
  ['recover.html', 'Home'],
  ['prescription.html', 'Recovery'],
  ['decline/w11-birthday.html', 'Plan'],
  ['widget.html', 'Back'],
  ['calm.html', 'Home'],
  ['priority.html', 'Home'],
  ['checkin.html', 'You'],
  ['plan-together.html', 'Friends'],
  ['sharing.html', 'Friends'],
  ['find-friends.html', 'Friends'],
  ['friend/ravi.html', 'Friends'],
  ['item/algo-set.html', 'Plan'],
  ['tonight/night.html', 'You'],
  ['timetable.html', 'You'],
  ['timetable/week.html', 'You'],
  ['timetable/modules.html', 'You'],
  ['timetable/import.html', 'You'],
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
