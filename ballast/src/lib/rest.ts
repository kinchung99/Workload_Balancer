/**
 * What might help, on the phone.
 *
 * Claude suggests recovery when there is a server and an account (see
 * `server/src/routes/compose.ts`). This is the rest of the time: a catalogue of
 * small, real things to do, ranked by the same rule the screen has always
 * stated - rest the area that is full by drawing on the one with room - and by
 * whatever moods the student tapped. "Another idea" walks down the ranking, so
 * refreshing never runs dry and never repeats until everything has been shown.
 */
import type { RestIdea, VibeId } from '@shared/contract';
import type { BucketKey, Prescription } from './types';

export const VIBES: Array<{ id: VibeId; label: string; emoji: string }> = [
  { id: 'outside', label: 'Outside', emoji: '🌿' },
  { id: 'indoors', label: 'Indoors', emoji: '🏠' },
  { id: 'alone', label: 'Alone', emoji: '🧍' },
  { id: 'people', label: 'With people', emoji: '👥' },
  { id: 'free', label: 'Costs nothing', emoji: '💸' },
  { id: 'low', label: 'Low energy', emoji: '🪫' },
];

/** Lengths the screen offers. An idea's own length snaps to the nearest. */
export const DURATIONS = [0.25, 0.5, 0.75, 1, 1.5, 2];

export const hoursFor = (minutes?: number): number => {
  if (!minutes) return 1;
  const hours = minutes / 60;
  return DURATIONS.reduce((best, d) => (Math.abs(d - hours) < Math.abs(best - hours) ? d : best));
};

/** A recovery idea the phone knows, with the moods it suits. */
export interface RestEntry extends Prescription {
  vibes: VibeId[];
}

type Raw = [string, string, string, BucketKey, number, [number, number], VibeId[]];

/** Title, detail, picture, area it gives back to, minutes, best hours, moods. */
const RAW: Raw[] = [
  ['Walk somewhere green', 'A park, a canal, a quiet street with trees. No podcast.', '🌳', 'physical', 30, [10, 19], ['outside', 'alone', 'free', 'low']],
  ['Stretch for fifteen minutes', 'Floor, slow, nothing to prove. Neck and hips first.', '🧘', 'physical', 15, [7, 22], ['indoors', 'alone', 'free', 'low']],
  ['A phone-free hour', 'Phone in another room. Anything else at all.', '📵', 'mental', 60, [18, 23], ['indoors', 'alone', 'free', 'low']],
  ['Swim a few slow lengths', 'Not training. Float between them if you like.', '🏊', 'physical', 45, [7, 20], ['indoors', 'alone']],
  ['Coffee with a friend', 'Somebody easy. No study talk allowed.', '☕', 'social', 45, [10, 18], ['outside', 'people']],
  ['Bike ride, no destination', 'Out for twenty minutes, back for twenty.', '🚲', 'physical', 45, [9, 19], ['outside', 'alone', 'free']],
  ['Read something for fun', 'Not for a module. Fiction counts double.', '📖', 'mental', 40, [19, 23], ['indoors', 'alone', 'free', 'low']],
  ['Call someone who makes you laugh', 'A proper call, not a voice note.', '📞', 'social', 30, [12, 22], ['people', 'free', 'low']],
  ['Catch the sunset', 'Walk to somewhere with a view and stay till it is gone.', '🌅', 'physical', 40, [16, 20], ['outside', 'free']],
  ['Cook something slow', 'A recipe with stirring in it. Music on.', '🍲', 'mental', 60, [17, 21], ['indoors', 'alone']],
  ['Game night with flatmates', 'Cards, a board game, anything with turns.', '🎲', 'social', 60, [18, 23], ['indoors', 'people', 'free']],
  ['Dance to three songs', 'Door shut, volume up, nobody watching.', '💃', 'physical', 15, [8, 22], ['indoors', 'alone', 'free']],
  ['Draw or doodle', 'Bad drawings only. The point is your hands.', '✏️', 'mental', 30, [12, 23], ['indoors', 'alone', 'free', 'low']],
  ['Sit in a café, no laptop', 'One drink, a window seat, people-watching.', '🥐', 'mental', 45, [9, 18], ['outside', 'alone']],
  ['Kick a ball about', 'Whoever is around. Twenty minutes is enough.', '⚽', 'physical', 45, [11, 20], ['outside', 'people', 'free']],
  ['Lie down with an album', 'Start to finish, eyes shut, no skipping.', '🎧', 'mental', 45, [13, 23], ['indoors', 'alone', 'free', 'low']],
  ['Bake something easy', 'Banana bread, cookies. Share it after.', '🧁', 'social', 60, [14, 21], ['indoors', 'people']],
  ['Gentle yoga video', 'Beginner, twenty minutes, mat or towel.', '🧘‍♀️', 'physical', 25, [7, 22], ['indoors', 'alone', 'free', 'low']],
  ['Picnic in the park', 'Shop snacks on the way. Bring a friend.', '🧺', 'social', 90, [11, 18], ['outside', 'people']],
  ['Long shower, then nothing', 'Warm water, then twenty minutes of doing nothing.', '🚿', 'mental', 30, [18, 23], ['indoors', 'alone', 'free', 'low']],
  ['Water the plants, slowly', 'Or visit some. Ten quiet minutes with something alive.', '🪴', 'mental', 15, [8, 20], ['indoors', 'alone', 'free', 'low']],
  ['Walk with a friend', 'Side by side is easier than face to face.', '🚶', 'social', 40, [10, 20], ['outside', 'people', 'free']],
];

const tagsFor = (minutes: number, vibes: VibeId[]): string[] =>
  [
    vibes.includes('free') ? 'Costs nothing' : null,
    minutes < 60 ? 'Under an hour' : null,
    vibes.includes('alone') ? 'Alone' : vibes.includes('people') ? 'With people' : null,
    vibes.includes('low') ? 'Low energy' : null,
  ].filter((tag): tag is string => !!tag).slice(0, 3);

export const CATALOGUE: RestEntry[] = RAW.map(([title, detail, emoji, refills, minutes, preferred, vibes]) => ({
  id: `phone-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
  title, detail, emoji, refills, minutes, preferred, vibes,
  credit: 3,
  slot: '',
  tags: tagsFor(minutes, vibes),
}));

/**
 * The demo week's own four, with the moods they suit.
 *
 * They were written for this student's actual Monday ("between your 2pm and
 * your shift"), so they lead - but only until a mood is tapped that they do not
 * fit, which is when the catalogue should take over.
 */
const SEEDED_VIBES: Record<string, VibeId[]> = {
  river: ['outside', 'alone', 'free'],
  nap: ['indoors', 'alone', 'free', 'low'],
  pool: ['indoors', 'alone'],
  empty: ['indoors', 'alone', 'free', 'low'],
};

export const fromSeed = (entry: Prescription): RestEntry => ({ ...entry, vibes: SEEDED_VIBES[entry.id] ?? [] });

/**
 * Best first: matches the moods tapped, then the demo week's own ideas, then
 * gives back to the area with the most room, then avoids the area that is
 * already full. Ties keep their order.
 */
export function rankRest<T extends Prescription & { vibes?: VibeId[] }>(
  entries: T[],
  { vibes, room, full }: { vibes: VibeId[]; room: BucketKey; full: BucketKey },
): T[] {
  const score = (entry: T) =>
    (entry.vibes ?? []).filter((v) => vibes.includes(v)).length * 10
    + (entry.id in SEEDED_VIBES ? 5 : 0)
    + (entry.refills === room ? 3 : 0)
    - (entry.refills === full ? 2 : 0);
  return entries
    .map((entry, order) => ({ entry, order, score: score(entry) }))
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .map(({ entry }) => entry);
}

/** What Claude suggested, as something the booking flow already knows how to book. */
export const fromIdea = (idea: RestIdea): RestEntry => ({
  id: idea.id,
  title: idea.title,
  detail: idea.detail,
  emoji: idea.emoji,
  refills: idea.area,
  minutes: idea.minutes,
  preferred: [idea.from, idea.to],
  tags: idea.tags,
  credit: 3,
  slot: '',
  vibes: [],
});

/** The area's name as the card says it. */
export const GIVES_BACK: Record<BucketKey, string> = {
  mental: 'Rests your head',
  physical: 'Moves your body',
  social: 'Fills your social side',
  time: 'Gives you time back',
  errands: 'Clears a small job',
};
