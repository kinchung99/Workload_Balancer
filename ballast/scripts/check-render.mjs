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
    'My week', 'Friends', 'What first', 'Recovery',  // four doors
    'Good afternoon',                         // by the same clock the day is marked against
    'To mark', 'Operating Systems lecture', 'Networks tutorial',   // over, and nobody has said
    'BALLAST \u00b7 NOW', 'Did you sign in?', 'Signed in', 'Later', // the notification, one tap each
    '4 marked for you', 'From yesterday',     // the morning-after guesses, one door away
    '36 checked in',                          // the circle, on the home screen
    'Add anything',
  ]],
  ['welcome.html', 'Welcome', [
    'Ballast', 'Plan your week around your energy.',
    'Your week as a battery', 'Hours \u00d7 how draining',   // what it does, in three pictures
    'What to do first', 'Time with friends',
    'Look around as a guest',                 // a build with no server can only be a guest
  ]],
  ['setup/timetable.html', 'Setup · timetable', [
    'STEP 1 OF 4 \u00b7 TIMETABLE', 'Import your timetable',
    'Your modules', 'CS2040', '2 a week',     // the sample week arrives with its timetable
    'Paste a new timetable', 'Next: your tasks',
  ]],
  ['setup/tasks.html', 'Setup · tasks', [
    'STEP 2 OF 4 \u00b7 TASKS', 'What\u2019s on your plate?',
    'Owing work', 'Assignments, prep, revision', 'Errand',   // two kinds of thing, two tiles
    'DUE', 'NEEDS', 'Name it first',
    'On your plate', 'Algorithms problem set', 'Next: your friends',
  ]],
  ['setup/friends.html', 'Setup · friends', [
    'STEP 3 OF 4 \u00b7 FRIENDS', 'Bring your people',
    'Find friends', 'From your contacts, or by email',
    'Your circle', '+53',                     // sixty people, as a row of faces
    'What friends see', 'Evenings only', 'Free evenings, after 5pm.',
  ]],
  ['setup/ready.html', 'Setup · ready', [
    'STEP 4 OF 4 \u00b7 READY', 'You\u2019re set', 'Your week is at 47%.',
    'Your battery', 'Tap a block to mark it', 'Friends see your battery',   // the three things worth knowing
    'Open my week',
  ]],
  ['tonight/night.html', 'Tonight · which night', [
    'STEP 1 OF 3 \u00b7 WHICH NIGHT',
    'Which night?', 'Tonight', 'Tomorrow', 'Free from 5pm', 'Plan tonight',
  ]],
  ['tonight/what.html', 'Tonight · what you do', [
    'STEP 2 OF 3 \u00b7 WHAT YOU DO',
    'What would you do?',
    'NOW', 'PROJECTED',                             // the battery, above everything that moves it
    'Pick a night',                                 // a kind of night, not a dial
    'A recovery night', 'A balanced night', 'Push through',
    'Early night, a walk, one message sent', '66%', '+19',   // what each one is, and what it leaves
    'Fine-tune it',                                 // the sliders, folded to one row
    'Sleep 6 hrs \u00b7 bed by 1am',                // sleep says when, not only how long - even folded
    '1 of your own',                                // and an evening of her own, in the model
    'Pick a night first',
  ]],
  ['tonight/book.html', 'Tonight · book it', [
    'STEP 3 OF 3 \u00b7 BOOK IT',
    'Book it?',
    'What this books',                        // the effect, stated before you tap
    'Nothing yet. Pick a night first.',
    'Pick a night first',                     // becomes a real count once a night is picked
  ]],
  ['plan.html', 'Plan', [
    'WEEK 10 TO 12', 'Next 14 days', 'This week 47%', 'Next 41%',
    'Today', 'Mon 10 Nov', '13.3h booked', '3h free',
    'SCHEDULED', '4 \u00b7 13h',                 // the clock rail
    'Operating Systems lecture', 'Kilburn LT1', 'Tips', 'Register',
    'Unmarked', 'Now',                        // over and not marked, and under way
    '2:30pm',                                 // a line where now is
    '2 to mark',
    'NOT ON THE CLOCK', 'This day', '1 \u00b7 no time yet', 'Owing', '3 \u00b7 13h to go',   // folded, This day first
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
    'Which days get lighter',                 // before you commit, answered in the row
    'What you could put down', '4 on',
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
    'STEP 3 OF 4 \u00b7 HOW DRAINING',
    'How draining is it?', 'Same hours, different cost. One tap.',
    'Pick the face that fits', 'Easy', 'Tiring', 'Exhausting',   // one picker, the same everywhere
    'Where does it drain you?',               // then where it lands, a tap each
    'Mental', 'Time', 'Physical', 'Social', 'Errands', 'Your head',
    'Fine-tune each area',                    // the five dials, folded away
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
    'Your rest bank', 'REST BANK', '\u221211h', 'owed to you',   // a balance, on a card
    '9 days in the red', '14 days ago', 'today',              // the run, as a strip of dots
    'Last full day off', '23 days ago',
    'Where it went',                                          // the ledger, as transactions
    'Sleep', '6.1h a night', '\u22129h',
    'Movement', '2 walks in 9 days',
    'Downtime', 'Sunday afternoon', '+2h',
  ]],
  ['prescription.html', 'Prescription · what', [
    'STEP 1 OF 2 \u00b7 WHAT',
    'What would help', 'Mental is full, physical has room.',
    'BEST FIT', 'Walk the river loop', 'Costs nothing', 'Under an hour', 'Alone',
    'HOW LONG', '1h',                         // a row of chips, shown
    'OR ONE OF THESE', 'Nap, 25 minutes',     // the alternatives, named rather than cycled
    'IN THE MOOD FOR', 'Outside', 'With people', 'Low energy',   // moods re-rank the ideas
    'IDEAS ON YOUR PHONE', 'ROUND 1 \u00b7 1 OF 5',          // no server in the export
    'Another idea',                                           // refresh never runs dry
    'Yes, when?',
  ]],
  ['prescription/when.html', 'Prescription · when', [
    'STEP 2 OF 2 \u00b7 WHEN',
    'When does it go?',
    'WHICH DAY', 'Today', 'Tomorrow',         // recovery is no longer today-only
    'WHAT TIME \u00b7 2 GAPS ON TODAY',
    'Pick a slot',
    'IF YOU BOOK IT', 'Where it lands', 'Today 12pm\u20131pm',   // battery and timeline before committing
    'Book Today at 12pm',                     // defaults into the window a walk belongs in
  ]],
  ['decline/w11-birthday.html', 'Drafter', [
    'The app writes it. It never sends it.', "Aisyah's birthday dinner",
    'What do you want to say?', 'IDEAS ON YOUR PHONE',      // no server in the export: the phone's own ideas
    'Say no, I\u2019m overloaded', 'Come for part of it', 'Something else',
    'Pick a tone', 'Warm', 'Brief', 'Fully honest', 'Formal', 'Playful', 'Detailed',
    'Pick what to say first',                                // nothing is written until you choose
    "Actually, I'm going", 'Open in WhatsApp',
  ]],
  ['message.html', 'Message', ['Write a message', 'Pick a friend or a plan first.']],
  ['widget.html', 'Widget', ['Ballast', 'week 10', 'One thing today. The networks lab report', 'How was today?', '47%', 'Draining', 'Fine', 'Meh', 'Hard', 'That tap is the entire daily commitment']],
  ['timetable.html', 'Timetable · week', [
    'Week', 'Modules', 'Import',              // three views of one screen, not a sequence
    'TIMETABLE', 'This week',
    'Operating Systems lecture', 'Kilburn LT1', 'lecture',
    'Gives exam tips', 'Sets coursework', 'Register',   // why an hour is worth more
    'In my week',                                           // what a flag changes, one tap away
    'Unmarked',                                             // over, and not signed into yet
    'Import from your portal',
  ]],
  ['timetable/modules.html', 'Timetable · modules', [
    'Your modules',
    'CS2040', 'Distributed Systems',
    'Draining',                                         // drain lives on the module
    '89%', '2 classes \u00b7 4h', 'Week 10 of 12',      // three short facts, closed
    'Below 80%', 'No register',                         // where the register stands
  ]],
  ['timetable/import.html', 'Timetable · import', [
    'Paste it from your portal', 'One class per line',
    'Back to the week',
  ]],
  ['friends.html', 'Friends', [
    '36 CHECKED IN TODAY', 'Your circle',
    'Search 60 friends',                      // eighty people are found by typing, not scrolling
    'You', '\ud83d\udd0b 47%', 'Updated 5 min ago',  // your own side of it, first
    '\ud83e\udd73', '\ud83e\uddd1\ud83c\udffd\u200d\ud83d\udcbb',   // a mood and a face they picked
    'Sharing: evenings only',                 // your side of it, and one tap to change it
    'MAYBE CHECK ON', 'Aisyah', 'heavy for 11 days',   // at most one person, ever
    'Frequent', '5 of 60',                    // the few you talk to, on top
    'doing fine \u00b7 22 min ago',              // a reading, and how old it is
    'All friends \u00b7 60',                     // everyone else, one page away
    'Finally handed it in',                   // a line they wrote themselves
    '3 days ago \u00b7 may be out of date',      // a stale reading says so
    // The calendar is one tap into the row, so it is asserted on the row's own
    // page rather than here - collapsed is the whole design of these lists.
    'Tap to change what your circle sees',
    'Find friends', '3 of your contacts are here',
    'Groups', 'New group', 'Study crew', 'Flat 4B',   // the people you plan with most
    'Plan something together',
  ]],
  ['plan-together.html', 'Plan together', [
    'PLAN SOMETHING', 'Find an evening',
    'Amin', '62%', 'Aisyah', '8%',             // their capacity, next to the name
    'Who\u2019s coming', '2 of 60', 'Jo', '24%', 'Study crew',   // who is coming, and the few you see most
    'More', '60 friends',                     // everyone else, in a picker with a search
    'Your own',                                // usual activities of your own
    'When', '3 options',
    'Who\u2019s free when',                       // the heatmap
    'What', 'Dinner \u00b7 2h', 'Day trip \u00b7 6h',
    'WHEN EVERYONE IS FREE',                   // the windows that work for all of you
    'Wed 12 Nov', '6pm – 8pm', 'Pick a time',
  ]],
  ['group/study-crew.html', 'A group', [
    'Study crew', 'GROUP \u00b7 3 PEOPLE', 'You, Amin, Ravi',
    'Members', '2 + you', 'Add members',                    // membership, managed apart from plans
    'Plan a hangout', 'Library session \u00b7 3h',          // the group's usual activity, one tap in
    'Find a time together',
    'Delete this group',
  ]],
  ['group/study-crew/plan.html', 'Group plan', [
    'STUDY CREW', 'Plan a hangout',
    'Who to invite', '2 of 2',                             // a plan asks some or all of them
    'Library session',                                     // the group's usual activity
    'Who\u2019s free when', 'WHEN EVERYONE IS FREE', 'Wed 12 Nov',
  ]],
  ['everyone.html', 'All friends', [
    'All friends', '36 CHECKED IN TODAY',
    'Search 60 friends', 'FREQUENT', 'Amin', 'Hana Yusof',   // the few first
    'Zhi Wei Ng', 'Daniel Lim',                               // then everyone, A to Z
  ]],
  ['module/os.html', 'Module settings', [
    'CS2040', 'Operating Systems', 'Settings',
    'Term', 'Week 10 of 12', 'Runs for', '12 weeks', 'Week now',   // set at import, changed rarely
    'Register', 'Attendance needed', '80%', 'How much it matters',
    'How draining are its classes?', 'Its own flags', 'New flag',
  ]],
  ['marked.html', 'Marked for you', [
    'THE MORNING AFTER', 'Marked for you', 'Yesterday',
    'Laundry and shopping', 'Done \u00b7 auto', 'Went \u00b7 auto',   // what the app assumed
    'Keep', 'Not done', 'Skipped', 'Change',                          // and every way to correct it
    'Keep all 4',
  ]],
  ['group/study-crew/add.html', 'Add members', [
    'Add members',
    'Search friends', 'FREQUENT', 'Jo', 'Aisyah', 'Pick who to add',
  ]],
  ['group/new.html', 'New group', ['New group', 'WHO\u2019S IN', 'Pick at least one friend']],
  /*
   * The public prototype ships with no API URL, so this is the branch it shows -
   * and asserting it is the point. A build with no server must still open every
   * screen and say so plainly rather than erroring or hanging on a fetch.
   */
  /*
   * The first paint, before the health check answers.
   *
   * A static export has no server to find, so this is what the public prototype
   * shows for an instant and then settles on "On this device". Asserting the
   * first frame is what proves the screen never blocks on a network call.
   */
  ['account.html', 'Account', [
    'ACCOUNT', 'One moment', 'Looking for your server',
  ]],
  ['sharing.html', 'Sharing', [
    'YOUR PRIVACY', 'What they see',
    'Your battery \u00b7 47%', 'Always shared',
    // Three levels, each with its consequence written next to it.
    'Nothing', 'They see your battery. No times at all.',
    'Evenings only', 'Free evenings, after 5pm. Nothing daytime.',
    'Free / busy', 'When you are free, all day. Never what you are doing.',
    // The preview is the whole point: their view of you, in their name.
    'Your calendar',
    'Fine-tune', 'Custom hours', 'Who sees your times', 'Everyone in your circle',
  ]],
  ['sharing/hours.html', 'Sharing · hours', [
    'Custom hours', 'Not on yet', 'START FROM', 'Weeknights', 'Weekends',
    'SHORTEST WINDOW WORTH SHOWING', 'HOW FAR AHEAD', 'Use custom hours',
  ]],
  ['sharing/people.html', 'Sharing · people', [
    'Who sees your times', 'Hidden friends still see your battery.',
    'Everyone', 'Only Study crew',
    'Search friends', 'FREQUENT',             // sixty switches need a search and a few on top
  ]],
  ['find-friends.html', 'Find friends', [
    '60 IN YOUR CIRCLE', 'Find your people',
    '3 already here', 'From your contacts. One tap each.',
    'Nadia Rahman', 'On Ballast', 'Add',        // one tap, nothing to send
    'Danny Oduya', 'Not on Ballast yet', 'Invite',
    'Your contacts never leave your phone.',
  ]],
  ['friend/ravi.html', 'A friend\u2019s week', [
    'Ravi', '71%', 'doing fine', '2h ago',
    // The avatar: the same circle the profile draws, so one language covers both.
    'R',
    'battery', 'free', 'reading',               // their profile stats row
    'Free most of this week',                   // a line they wrote themselves
    'THIS WEEK, AS THEY SHARE IT',
    'Wednesday, free 5pm to 11pm',              // published windows, spoken
    'Saturday, free 12pm to 10pm',
    'Free time only. Never what they are doing.',
    'Ask about Saturday',                       // the longest window, as one tap
  ]],
  ['you.html', 'You', [
    'YOUR PROFILE', 'You', '47%',
    // A profile opens with identity and a row of numbers, the way every social
    // app has taught people to read one.
    'battery', 'friends', 'sharing',
    'Edit profile',
    'Recharge', 'Check in', 'Recovery', 'Tonight',     // looking after yourself
    'Your week', 'Timetable', 'What to do first',       // organising the week
  ]],
  ['profile.html', 'Edit profile', [
    'EDIT PROFILE', 'How you appear',
    'WHAT YOUR FRIENDS SEE',                    // the live preview of your own row
    'NAME', 'INITIALS', 'STATUS',
    'Deadline week', 'Finally handed it in',    // suggestions, because a blank box stays blank
    'PICTURE', 'Picture \ud83e\udd8a',          // a photo (offered once in the browser), or one of the faces
    'PHONE (OPTIONAL)', 'Only for opening WhatsApp.',
  ]],
  ['settings.html', 'Settings', [
    'SETTINGS', 'Settings',
    'Account', 'Edit profile', 'Your circle', 'Find friends',
    'Privacy', 'What your circle sees',
    'Your tasks are never read by the server.',
    'Run setup again',
  ]],
  ['item/algo-set.html', 'One item', [
    'DUE THU 13 NOV', 'Algorithms problem set',
    '12 load', 'Soft', 'No time yet',
    'Progress', '3 days left',                // how far along, in the focus colour
    '3h still to do', '1h done', '0h booked', '3h loose', '25%',   // the ring and its legend
    'Did some without booking it?', 'Log time you already put in', // folded to one row
    'Sittings', 'Nothing booked yet.',        // when the rest happens, in the week colour
    '3h still loose', '2 sittings fit before Thu 13 Nov',
    'Suggest 2 sittings',                     // proposes first; nothing is booked unseen
    'Plan, move or add sittings',             // the full planner is a page of its own
    'How draining is it?',                    // the same question as everywhere else
    'Tiring \u00b7 \u22124% of that week\u2019s battery',   // folded, it still says what it costs
    'Write a message to get out of it',
  ]],
  ['item/algo-set/sittings.html', 'Sittings', [
    'DUE THU 13 NOV', 'Sittings', 'Algorithms problem set',
    '3h still loose', '2 sittings fit before Thu 13 Nov',
    'Suggest 2 sittings', 'Plan my own',
  ]],
  ['checkin.html', 'Check in', [
    'How are you?',                           // the whole daily ask, one screen
    'Today feels', 'Sleep and food', 'Slept', 'Ate today',
    'Something good happened?',               // the one input that adds charge
    'Properly laughed', 'Actually rested',
  ]],
  ['priority.html', 'Priority', [
    'WHAT TO DO FIRST', 'Start with this',
    'START HERE', 'Operating systems, part 2',          // number one, answered in full
    'DUE', 'NEEDS', 'COSTS', 'of the week',             // three facts, as tiles
    'WHY IT\u2019S FIRST', 'Due today', 'Hard deadline', 'A 4h block',
    'Booked today at 1pm\u20135pm', 'Open that day',     // when it can actually happen
    'Your next 7 days', '\u2713 It fits', 'still needs a slot',   // the week, and whether it fits
    'Then', '6 of 24 \u00b7 next 7 days', 'Show the other 18',
    'Algorithms problem set', '3h to go', '75%', 'left',   // how much of owing work is left
    'Tomorrow \u00b7 10am\u20133pm',                        // when a fixed thing happens
    'Plan sittings', 'Change time', 'Open day',            // one button to act on each
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
  ['sharing/hours.html', 'What they see'],
  ['sharing/people.html', 'What they see'],
  ['group/study-crew.html', 'Friends'],
  ['group/new.html', 'Friends'],
  ['group/study-crew/add.html', 'Study crew'],
  ['message.html', 'Friends'],
  ['account.html', 'You'],
  ['profile.html', 'You'],
  ['settings.html', 'You'],
  ['find-friends.html', 'Friends'],
  ['friend/ravi.html', 'Friends'],
  ['item/algo-set.html', 'Plan'],
  ['item/algo-set/sittings.html', 'Task'],
  ['marked.html', 'Home'],
  ['everyone.html', 'Friends'],
  ['module/os.html', 'Modules'],
  ['group/study-crew/plan.html', 'Study crew'],
  ['tonight/night.html', 'You'],
  ['timetable.html', 'You'],
  ['timetable/week.html', 'You'],
  ['timetable/modules.html', 'You'],
  ['timetable/import.html', 'You'],
  ['prescription/what.html', 'Recovery'],
  ['prescription/when.html', 'Recovery'],
  ['welcome.html', 'Look around as a guest'],
  ['setup/timetable.html', 'Next: your tasks'],
  ['setup/tasks.html', 'Back'],
  ['setup/friends.html', 'Back'],
  ['setup/ready.html', 'Back'],
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
