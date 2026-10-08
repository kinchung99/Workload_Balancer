/**
 * Friends and groups, asked rather than added.
 *
 * Every way of bringing someone in - a friend request, a group invitation -
 * goes out as a question and waits for a yes. Signed in, that question goes to
 * the server and the other person's phone; in the sample week the store plays
 * both sides, and its friends answer by themselves a few seconds later.
 *
 * Screens call these and never decide which of the two they are talking to.
 */
import { api } from './api';
import { useStore } from '@/state/store';

const live = () => useStore.getState().mode === 'live' && !!useStore.getState().account;

/** Pull requests and groups again after a change, so every screen agrees. */
export async function refreshSocial(): Promise<void> {
  if (!live()) return;
  const me = useStore.getState().account!.id;
  const [requests, groups, plans] = await Promise.all([api.requests(), api.groups(), api.invites()]);
  if (requests.ok) useStore.getState().setRequests(requests.data.requests);
  if (groups.ok) useStore.getState().setGroupsFromServer(groups.data.groups, me);
  if (plans.ok) useStore.getState().setInvitesFromServer(plans.data.invites, me);
}

/** Ask to be friends, by email (or a six-letter code when signed in). */
export async function sendFriendRequest(handle: string, name?: string, id?: string): Promise<boolean> {
  const typed = handle.trim();
  if (live()) {
    const code = typed.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const asCode = !typed.includes('@') && code.length === 6;
    const res = await api.addFriend(asCode ? { code } : { email: typed.toLowerCase() });
    await refreshSocial();
    return res.ok;
  }
  useStore.getState().sendFriendRequest(typed, name, id);
  return true;
}

/** Yes or no to someone who asked; or taking back a request of your own. */
export async function answerFriend(userId: string, accept: boolean): Promise<void> {
  if (live()) {
    await api.respondToFriend(userId, accept ? 'accept' : 'decline');
    await refreshSocial();
    return;
  }
  useStore.getState().answerFriendRequest(userId, accept);
}

/** Make a group and ask the friends picked. Returns its id. */
export async function createGroupAndInvite(name: string, emoji: string, invite: string[]): Promise<string | null> {
  if (live()) {
    const res = await api.createGroup({ name, emoji, invite });
    await refreshSocial();
    return res.ok ? res.data.id : null;
  }
  const id = useStore.getState().createGroup({ name, emoji, members: [] });
  useStore.getState().updateGroup(id, { owner: true });
  useStore.getState().inviteToGroup(id, invite);
  return id;
}

export async function inviteToGroup(groupId: string, ids: string[]): Promise<void> {
  if (live()) {
    await api.inviteToGroup(groupId, ids);
    await refreshSocial();
    return;
  }
  useStore.getState().inviteToGroup(groupId, ids);
}

/** Take a member out, or an invitation back. */
export async function removeFromGroup(groupId: string, userId: string, invitedOnly: boolean): Promise<void> {
  if (live()) {
    await api.removeFromGroup(groupId, userId);
    await refreshSocial();
    return;
  }
  if (invitedOnly) useStore.getState().cancelGroupInvite(groupId, userId);
  else useStore.getState().removeGroupMember(groupId, userId);
}

/** Yes or no to a group somebody asked you into. */
export async function answerGroup(id: string, accept: boolean): Promise<void> {
  if (live()) {
    await api.respondToGroup(id, accept ? 'accept' : 'decline');
    await refreshSocial();
    return;
  }
  useStore.getState().answerGroupInvite(id, accept);
}

/** Leave a group you did not make, or delete one you did. */
export async function leaveOrDelete(groupId: string, owner: boolean): Promise<void> {
  if (live()) {
    if (owner) await api.deleteGroup(groupId);
    else await api.removeFromGroup(groupId, useStore.getState().account!.id);
    await refreshSocial();
    return;
  }
  useStore.getState().deleteGroup(groupId);
}

/** A new name or picture, shared with everyone in it when signed in. */
export async function renameGroup(groupId: string, patch: { name?: string; emoji?: string }): Promise<void> {
  useStore.getState().updateGroup(groupId, patch);
  if (live()) await api.updateGroup(groupId, patch);
}

/* ------------------------------------------------------------------ plans */

export interface PlanDraft {
  title: string;
  date: string;
  startHour: number;
  hours: number;
  people: string[];
  groupId?: string;
}

/** Ask people to a plan. It waits for their answers before it goes in your week. */
export async function sendPlan(plan: PlanDraft): Promise<boolean> {
  if (live()) {
    const res = await api.invite({ title: plan.title, date: plan.date, startHour: plan.startHour, hours: plan.hours, people: plan.people });
    if (res.ok) useStore.getState().sendInvite({ ...plan, id: res.data.id });
    await refreshSocial();
    return res.ok;
  }
  useStore.getState().sendInvite(plan);
  return true;
}

/** A plan you sent, into your week. Your week is yours, so this stays on the phone. */
export const schedulePlan = (id: string): void => useStore.getState().scheduleInvite(id);

/** Call it off, for everyone. */
export async function cancelPlan(id: string): Promise<void> {
  useStore.getState().cancelInvite(id);
  if (live()) {
    await api.cancelInvite(id);
    await refreshSocial();
  }
}

/** Yes or no to a plan you were asked to. Yes puts it in your week. */
export async function answerPlan(id: string, yes: boolean): Promise<void> {
  useStore.getState().answerReceived(id, yes);
  if (live()) {
    await api.replyToInvite(id, yes ? 'yes' : 'no');
    await refreshSocial();
  }
}
