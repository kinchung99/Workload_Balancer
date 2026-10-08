/**
 * What is worth telling you about, and what is waiting on you.
 *
 * Two kinds of thing reach the bell. Things that still need you are worked out
 * live from the week - a friend request to answer, a deadline tomorrow with
 * work left, a class to mark - so each one disappears the moment it is dealt
 * with. Things that happened are kept as events - a friend said yes, somebody
 * joined your group - and stay as history.
 *
 * Only what is worth an interruption is here. Every item has a stable id, so
 * the bell counts only what you have not seen yet, and a standing condition
 * (rest owed, a heavy week ahead) does not nag forever.
 */
import { addDays, formatShort } from './dates';
import { autoMarkedIn, clockHour, toMark } from './marking';
import { remaining } from './prep';
import { findCollision, leadLabel } from './forecast';
import { worthANudge } from './circle';
import { firstName } from './people';
import type { CircleMember, GroupInvite, Item, MoodCheckIn, Notice, ReceivedInvite } from './types';
import { formatHour } from './schedule';
import type { PendingRequestDTO } from '@shared/contract';

/** Everything the quick-update page asks about, and how many things that is. */
export interface QuickUpdate {
  /** Classes and tasks whose time has passed, not marked yet. */
  toMark: Item[];
  /** Marked done for you the morning after, waiting for a yes. */
  auto: Item[];
  /** Today's check-in has not happened yet. */
  checkIn: boolean;
  count: number;
}

export function quickUpdate(state: { items: Item[]; today: string; moods: MoodCheckIn[]; sleepHours: number | null }): QuickUpdate {
  const due = toMark(state.items, state.today, clockHour(state.today));
  const auto = autoMarkedIn(state.items);
  const checkedIn = state.moods.some((mood) => mood.date === state.today) || state.sleepHours !== null;
  return { toMark: due, auto, checkIn: !checkedIn, count: due.length + auto.length + (checkedIn ? 0 : 1) };
}

export type BellKind = 'friend' | 'group' | 'plan' | 'update' | 'due' | 'wall' | 'nudge' | 'rest' | 'low' | 'event';

export interface Bell {
  id: string;
  kind: BellKind;
  emoji: string;
  title: string;
  body?: string;
  /** Where tapping it goes. */
  to?: string;
  /** For a question: the id it answers about. */
  ref?: string;
  at?: string;
}

export interface BellState {
  items: Item[];
  today: string;
  requests: PendingRequestDTO[];
  groupInvites: GroupInvite[];
  received: ReceivedInvite[];
  circle: CircleMember[];
  notices: Notice[];
  restOwed: number;
  charge: number;
  update: QuickUpdate;
}

/** Everything for the bell, questions first, then today, then what happened. */
export function bells(state: BellState): Bell[] {
  const { today } = state;
  const out: Bell[] = [];

  for (const request of state.requests.filter((r) => r.direction === 'incoming')) {
    out.push({ id: `friend:${request.userId}`, kind: 'friend', emoji: '👋', title: `${request.name} wants to be friends`, ref: request.userId, at: request.at });
  }
  for (const invite of state.groupInvites) {
    out.push({ id: `group:${invite.id}`, kind: 'group', emoji: invite.emoji, title: `${invite.from} invited you to ${invite.name}`, ref: invite.id, at: invite.at });
  }
  for (const plan of state.received.filter((r) => !r.answer && r.date >= today)) {
    out.push({
      id: `plan:${plan.id}`, kind: 'plan', emoji: '🎉', title: `${plan.from} invited you to ${plan.title.split(/ with | · /)[0]}`,
      body: `${formatShort(plan.date)} · ${formatHour(plan.startHour)}`, ref: plan.id, at: plan.at, to: '/plans',
    });
  }

  if (state.update.count) {
    const parts = [
      state.update.toMark.length ? `${state.update.toMark.length} to mark` : '',
      state.update.auto.length ? `${state.update.auto.length} marked for you` : '',
      state.update.checkIn ? 'check in' : '',
    ].filter(Boolean);
    out.push({
      id: `update:${today}:${state.update.count}`, kind: 'update', emoji: '⏳',
      title: `${state.update.count} thing${state.update.count === 1 ? '' : 's'} to update`, body: parts.join(' · '), to: '/update',
    });
  }

  // Work due today or tomorrow that is not finished.
  const soon = state.items
    .filter((item) => item.prepHours && !item.parentId && remaining(item) > 0)
    .filter((item) => {
      const due = item.deadline ?? item.date;
      return due === today || due === addDays(today, 1);
    })
    .slice(0, 3);
  for (const item of soon) {
    const due = item.deadline ?? item.date;
    out.push({
      id: `due:${item.id}:${due}`, kind: 'due', emoji: '⏰',
      title: `${item.title} is due ${due === today ? 'today' : 'tomorrow'}`, body: `${remaining(item)}h still to do`, to: `/item/${item.id}`,
    });
  }

  const wall = findCollision(state.items, today);
  if (wall) out.push({ id: `wall:${wall.from}`, kind: 'wall', emoji: '🧱', title: wall.headline, body: leadLabel(wall.leadDays), to: '/rebalance' });

  const nudge = worthANudge(state.circle);
  if (nudge) {
    out.push({
      id: `nudge:${nudge.person.id}:${today}`, kind: 'nudge', emoji: '💛',
      title: `${firstName(nudge.person.name)} has been ${nudge.reason}`, body: 'A message might help', to: `/message?kind=checkin&to=${nudge.person.id}`,
    });
  }

  if (state.restOwed >= 8) out.push({ id: `rest:${today}`, kind: 'rest', emoji: '🌿', title: `${state.restOwed}h of rest owed`, body: 'Book something that helps', to: '/recover' });
  if (state.charge < 25) out.push({ id: `low:${today}`, kind: 'low', emoji: '🪫', title: `Battery at ${state.charge}%`, body: 'See where it goes', to: '/battery' });

  for (const event of state.notices) {
    out.push({ id: event.id, kind: 'event', emoji: event.emoji, title: event.title, body: event.body, to: event.to, at: event.at });
  }
  return out;
}

/** How many of these you have not seen. What the bell's badge says. */
export const unseen = (list: Bell[], seen: string[]): number => list.filter((bell) => !seen.includes(bell.id)).length;

/** "2h ago", "Yesterday", "9 Nov" - when something happened. */
export function whenWord(at: string | undefined, now = Date.now()): string {
  if (!at) return '';
  const minutes = Math.round((now - Date.parse(at)) / 60000);
  if (Number.isNaN(minutes)) return '';
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)}h ago`;
  if (minutes < 60 * 48) return 'Yesterday';
  return formatShort(at.slice(0, 10));
}
