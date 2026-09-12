/**
 * What leaves your phone.
 *
 * Two features in this app only work if people can see something of each
 * other's weeks - checking on a friend who has been empty for a fortnight, and
 * finding an evening four people actually share. Both of them are worthless if
 * the price is handing over your diary.
 *
 * So the unit of sharing is a **free window**, never a task. "Thursday, free
 * after six" is enough to plan a dinner and tells nobody what you were doing
 * before six, who you were with, or what you are behind on. Titles, deadlines,
 * dread, areas and the owing list are not shareable in this model - not
 * "private by default", not shareable at all, because there is no field for
 * them in what gets published.
 *
 * On top of that, three levels, and the lowest is genuinely off. A student who
 * wants the battery side of this app and none of the calendar side should be
 * able to have exactly that without leaving the app, and `off` publishes an
 * empty list rather than a suspiciously full one.
 */
import { DAY_END, DAY_START, freeSlots, overlap, slotHours, type Slot } from './schedule';
import type { CircleMember, Item } from './types';

/** Evening starts here. The window nearly every plan between students lands in. */
export const EVENING_FROM = 17;

/**
 * How much of your week other people can see.
 *
 * Deliberately three, not a per-friend matrix. A privacy control nobody can
 * hold in their head gets set once at random and then distrusted, and the
 * honest summary of each of these fits in a sentence.
 */
export type Visibility = 'off' | 'evenings' | 'busy';

export const VISIBILITY: Array<{ value: Visibility; word: string; note: string }> = [
  { value: 'off', word: 'Nothing', note: 'They see your battery. No times at all.' },
  { value: 'evenings', word: 'Evenings only', note: 'Free evenings, after 5pm. Nothing daytime.' },
  { value: 'busy', word: 'Free / busy', note: 'When you are free, all day. Never what you are doing.' },
];

export const VISIBILITY_WORD = (v: Visibility): string =>
  VISIBILITY.find((option) => option.value === v)!.word;

/**
 * Your own free windows on a day, cut down to what you have chosen to publish.
 *
 * Derived from the same `freeSlots` the booking pickers use, so what friends see
 * can never drift from what your own day actually looks like.
 */
export function published(items: Item[], date: string, visibility: Visibility, minHours = 1): Slot[] {
  if (visibility === 'off') return [];
  const free = freeSlots(items, date, minHours);
  if (visibility === 'busy') return free;
  return free
    .map((slot) => ({ start: Math.max(slot.start, EVENING_FROM), end: slot.end }))
    .filter((slot) => slotHours(slot) >= minHours);
}

/** What one person has published for a day. Free windows, in order. */
export const freeOn = (person: CircleMember, date: string): Slot[] =>
  (person.free ?? [])
    .filter((window) => window.date === date)
    .map(({ start, end }) => ({ start, end }))
    .sort((a, b) => a.start - b.start);

/**
 * The inverse of what they published, so a shared day can be drawn as a day.
 *
 * Every block here is unlabelled on purpose. This is the whole privacy promise
 * in one function: the app knows *that* Thursday afternoon is taken and has no
 * way of knowing what takes it.
 */
export function busyFrom(free: Slot[]): Slot[] {
  const blocks: Slot[] = [];
  let cursor = DAY_START;
  for (const window of free) {
    if (window.start > cursor) blocks.push({ start: cursor, end: window.start });
    cursor = Math.max(cursor, window.end);
  }
  if (cursor < DAY_END) blocks.push({ start: cursor, end: DAY_END });
  return blocks;
}

export interface SharedDay {
  date: string;
  /** Windows that work for you and for everyone asked. */
  slots: Slot[];
  /** The longest of them, which is what a suggestion should offer. */
  best: Slot;
}

/**
 * Days that genuinely work for everybody, longest window first.
 *
 * The coordination four busy people will never do in a group chat: it walks the
 * fortnight, intersects your real gaps with what each of them published, and
 * returns only the windows where nobody has to move anything.
 */
export function sharedDays(
  mine: Item[],
  people: CircleMember[],
  days: string[],
  visibility: Visibility,
  minHours = 2,
): SharedDay[] {
  if (!people.length) return [];
  return days
    .map((date) => {
      const ours = published(mine, date, visibility === 'off' ? 'busy' : visibility, minHours);
      const theirs = people.map((person) => freeOn(person, date));
      // Anyone who published nothing for that day cannot be counted as free on it.
      if (!ours.length || theirs.some((list) => list.length === 0)) return null;
      const slots = overlap([ours, ...theirs], minHours);
      if (!slots.length) return null;
      const best = [...slots].sort((a, b) => slotHours(b) - slotHours(a))[0];
      return { date, slots, best };
    })
    .filter((day): day is SharedDay => day !== null)
    .sort((a, b) => slotHours(b.best) - slotHours(a.best));
}

/**
 * Someone in your phone who is not yet in your circle.
 *
 * In the shipped app this list comes from `expo-contacts` after a permission
 * prompt, matched against hashed numbers so the server never learns who is in
 * anyone's address book. In the prototype it is seeded, because reading a real
 * address book to demonstrate a list is not a trade worth making.
 */
export interface PhoneContact {
  id: string;
  name: string;
  initials: string;
  /** Already using Ballast, so adding them is one tap rather than an invitation. */
  onBallast?: boolean;
  /** Already in your circle. Kept out of the list rather than shown greyed. */
  added?: boolean;
}

/**
 * Who to offer, in the order that gets a circle started.
 *
 * People already on Ballast first: the difference between "add" and "invite" is
 * the difference between a feature that works this evening and one that works
 * if somebody else installs something.
 */
export const suggestions = (contacts: PhoneContact[]): PhoneContact[] =>
  contacts
    .filter((contact) => !contact.added)
    .sort((a, b) => Number(!!b.onBallast) - Number(!!a.onBallast) || a.name.localeCompare(b.name));

export const onBallastCount = (contacts: PhoneContact[]): number =>
  contacts.filter((contact) => contact.onBallast && !contact.added).length;

/**
 * A message, opened in the app they already use.
 *
 * Ballast has no inbox and should not have one. Nobody wants a fourth place to
 * check for messages, and a "thinking of you" that has to be read inside a
 * productivity app arrives with the wrong tone entirely. So the app writes the
 * words and hands them to WhatsApp with the chat already open - the student
 * still presses send, which is the part that has to stay theirs.
 *
 * `wa.me` rather than the `whatsapp://` scheme: it resolves to the installed app
 * on both platforms and degrades to the web client in a browser, so the one link
 * works everywhere the prototype runs.
 */
export function whatsapp(message: string, phone?: string): string {
  const text = encodeURIComponent(message);
  return phone ? `https://wa.me/${phone.replace(/\D/g, '')}?text=${text}` : `https://wa.me/?text=${text}`;
}

/** The words themselves. Short, unmistakably from a person, never generated about them. */
export const CHECK_IN_MESSAGE = (name: string): string =>
  `Hey ${name.split(' ')[0]}, thinking of you. How have you been?`;

export const PLAN_MESSAGE = (when: string, who: string[]): string =>
  `${who.length > 1 ? 'Are you both' : 'Are you'} free ${when}? Looks like it works for everyone.`;
