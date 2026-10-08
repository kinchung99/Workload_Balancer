import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Avatar, Button, Chip, Door, Screen, Section, Stack, Text } from '@/components';
import { color, radius } from '@design/tokens';
import { BAND_WORD, isStale, lastSeen } from '@/lib/circle';
import { addDays, formatShort } from '@/lib/dates';
import { successFeedback, tapFeedback } from '@/lib/haptics';
import { formatHour } from '@/lib/schedule';
import { freeOn } from '@/lib/sharing';
import { useStore } from '@/state/store';
import type { CircleMember } from '@/lib/types';
import { SentPlanCard } from '@/features/social/PlanCards';
import { GROUP_EMOJIS, groupWash } from '@/features/social/groupArt';
import { leaveOrDelete, removeFromGroup, renameGroup } from '@/lib/social';

const TONE = { steady: 'steady', busy: 'busy', heavy: 'heavy', recovery: 'recovery' } as const;

/** The two seeded groups, so `/group/...` renders in the static export. */
export async function generateStaticParams() {
  return [{ id: 'study-crew' }, { id: 'flat-4b' }];
}

/**
 * One group, as a home: who is in it, what you have planned, and the way into
 * planning the next thing.
 *
 * Two different questions, kept apart on purpose. Who is *in* the group changes
 * rarely - members are added on their own page and removed from inside their
 * own block, so it never happens by accident. Planning - who to ask this time,
 * what, and when - is a page of its own behind "Plan a hangout", and asking
 * three of the four leaves the group exactly as it was.
 */
export default function GroupPage() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { groups, circle, today, invites } = useStore();
  const group = groups.find((g) => g.id === id);
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);

  if (!group) {
    return (
      <Screen back="/friends" backLabel="Friends">
        <Stack gap={4} className="pt-6">
          <Text variant="title">That group is gone.</Text>
          <Button label="Back to your circle" onPress={() => router.replace('/friends')} />
        </Stack>
      </Screen>
    );
  }

  const members = circle.filter((person) => group.members.includes(person.id));
  const invited = circle.filter((person) => (group.invited ?? []).some((i) => i.id === person.id));
  // Only the person who made a group takes other people out of it.
  const owner = group.owner !== false;
  const wash = groupWash(group.id);
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));

  return (
    <Screen back="/friends" backLabel="Friends">
      <Stack gap={5} className="pt-2">
        {/* The group's own header: its picture, its name, its people. */}
        <View className="overflow-hidden rounded-xl" style={{ backgroundColor: wash }}>
          <Stack gap={4} className="px-5 py-5">
            <Stack direction="row" gap={4} align="center">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Change the group's picture and name"
                onPress={() => { tapFeedback(); setEditing(!editing); }}
                className="items-center justify-center rounded-pill bg-raised active:opacity-70"
                style={{ width: 72, height: 72, borderWidth: 2, borderColor: color.ink.default }}
              >
                <Text variant="display">{group.emoji}</Text>
                <View className="absolute items-center justify-center rounded-pill bg-inverse" style={{ right: -2, bottom: -2, width: 24, height: 24 }}>
                  <Text variant="micro" tone="inverse">✎</Text>
                </View>
              </Pressable>
              <Stack gap={1} grow>
                <Text variant="micro">GROUP · {members.length ? `${members.length + 1} PEOPLE` : 'JUST YOU'}{invited.length ? ` · ${invited.length} INVITED` : ''}</Text>
                {editing ? (
                  <TextInput
                    value={group.name}
                    onChangeText={(name) => void renameGroup(group.id, { name: name.slice(0, 32) })}
                    accessibilityLabel="Group name"
                    autoFocus
                    className="min-h-min rounded-md border border-line-strong bg-page px-3 py-2 text-heading text-ink-default"
                  />
                ) : (
                  <Text variant="title" accessibilityRole="header">{group.name}</Text>
                )}
                <Text variant="footnote" tone="muted">You{members.length ? `, ${members.map((m) => m.name).join(', ')}` : ''}</Text>
              </Stack>
            </Stack>

            {editing ? (
              <Stack direction="row" gap={2} wrap>
                {GROUP_EMOJIS.map((emoji) => (
                  <Pressable
                    key={emoji}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: emoji === group.emoji }}
                    accessibilityLabel={`Picture ${emoji}`}
                    onPress={() => { tapFeedback(); void renameGroup(group.id, { emoji }); }}
                    className="items-center justify-center rounded-md active:opacity-60"
                    style={{
                      width: 40, height: 40,
                      backgroundColor: emoji === group.emoji ? color.surface.raised : 'transparent',
                      borderWidth: emoji === group.emoji ? 2 : 0, borderColor: color.ink.default,
                    }}
                  >
                    <Text variant="heading">{emoji}</Text>
                  </Pressable>
                ))}
              </Stack>
            ) : (
              <Stack direction="row" align="center">
                {members.map((person, i) => (
                  <View key={person.id} style={{ marginLeft: i ? -10 : 0, borderRadius: radius.pill, borderWidth: 2, borderColor: wash }}>
                    <Avatar initials={person.initials} band={person.band} size={36} pic={person.pic} />
                  </View>
                ))}
              </Stack>
            )}
          </Stack>
        </View>

        {/* Members: tap one to open it. Removing lives inside, never on a corner. */}
        <Section family="people" title="Members" meta={`${members.length} + you`}>
          {members.map((person) => (
            <MemberBlock
              key={person.id}
              person={person}
              days={days}
              open={open === person.id}
              confirming={confirm === person.id}
              canRemove={owner}
              onToggle={() => { tapFeedback(); setOpen(open === person.id ? null : person.id); setConfirm(null); }}
              onMessage={() => { tapFeedback(); router.push(`/message?kind=checkin&to=${person.id}` as Href); }}
              onAskRemove={() => { tapFeedback(); setConfirm(person.id); }}
              onKeep={() => { tapFeedback(); setConfirm(null); }}
              onRemove={() => {
                void removeFromGroup(group.id, person.id, false);
                successFeedback();
                setOpen(null);
                setConfirm(null);
              }}
            />
          ))}
          {/* Asked, not in yet: they join when they say yes. */}
          {invited.map((person) => (
            <Stack key={person.id} direction="row" gap={3} align="center" className="rounded-lg border-2 border-dashed border-line-strong bg-raised px-4 py-3">
              <View style={{ opacity: 0.55 }}><Avatar initials={person.initials} band={person.band} size={40} pic={person.pic} /></View>
              <Stack gap={0} grow>
                <Text variant="body" weight="semibold">{person.name}</Text>
                <Text variant="micro" tone="busy">✉️ Invited · waiting for a yes</Text>
              </Stack>
              {owner ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Take back the invitation to ${person.name}`}
                  onPress={() => { tapFeedback(); void removeFromGroup(group.id, person.id, true); }}
                  className="min-h-min items-center justify-center rounded-pill border-2 border-line-hairline bg-sunken px-3 active:opacity-70"
                >
                  <Text variant="caption" weight="bold">Take back</Text>
                </Pressable>
              ) : null}
            </Stack>
          ))}
          <Door family="people" sticker="wave" title="Invite friends" sub="They join when they say yes" onPress={() => router.push(`/group/${group.id}/add` as Href)} />
        </Section>

        {/* Planning is its own page; here is the way in, starting from what you usually do. */}
        <Section family="week" title="Plan a hangout" sticker="heart">
          {(group.activities ?? []).length ? (
            <Stack direction="row" gap={2} wrap>
              {(group.activities ?? []).map((activity) => (
                <Chip
                  key={activity.id}
                  label={`${activity.emoji} ${activity.label} · ${activity.hours}h`}
                  tone="recovery"
                  onPress={() => { tapFeedback(); router.push(`/group/${group.id}/plan?act=${activity.id}` as Href); }}
                />
              ))}
            </Stack>
          ) : null}
          <Button label="Find a time together" onPress={() => { tapFeedback(); router.push(`/group/${group.id}/plan` as Href); }} />
        </Section>

        {/* Plans made in this group, with who has said yes. */}
        {invites.some((invite) => invite.groupId === group.id) ? (
          <Section family="people" title="Plans" sticker="heart" meta={`${invites.filter((invite) => invite.groupId === group.id).length}`}>
            {invites.filter((invite) => invite.groupId === group.id).map((invite) => <SentPlanCard key={invite.id} invite={invite} />)}
          </Section>
        ) : null}

        {/* Ending it asks twice: the button, then a yes. */}
        {ending ? (
          <Stack gap={3} className="rounded-lg border-2 border-heavy-fill bg-heavy-wash px-4 py-4">
            <Text variant="heading" tone="heavy">{owner ? `Delete ${group.name} for everyone?` : `Leave ${group.name}?`}</Text>
            <Stack direction="row" gap={2}>
              <Button label="Keep it" kind="secondary" className="flex-1" onPress={() => { tapFeedback(); setEnding(false); }} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={owner ? 'Yes, delete the group' : 'Yes, leave the group'}
                onPress={async () => {
                  await leaveOrDelete(group.id, owner);
                  successFeedback();
                  router.replace('/friends');
                }}
                className="min-h-button flex-1 items-center justify-center rounded-pill bg-heavy-fill px-4 active:opacity-70"
              >
                <Text variant="callout" weight="bold" tone="inverse">{owner ? 'Yes, delete' : 'Yes, leave'}</Text>
              </Pressable>
            </Stack>
          </Stack>
        ) : (
          <Button label={owner ? 'Delete this group' : 'Leave this group'} kind="quiet" onPress={() => { tapFeedback(); setEnding(true); }} />
        )}
      </Stack>
    </Screen>
  );
}

/**
 * One member. Closed: a face, a name, a battery. Open: how they are, when they
 * are free this week, and the two things you can do - message them, or take
 * them out of the group, which asks once more before it happens.
 */
function MemberBlock({
  person, days, open, confirming, canRemove, onToggle, onMessage, onAskRemove, onKeep, onRemove,
}: {
  person: CircleMember;
  days: string[];
  open: boolean;
  confirming: boolean;
  canRemove: boolean;
  onToggle: () => void;
  onMessage: () => void;
  onAskRemove: () => void;
  onKeep: () => void;
  onRemove: () => void;
}) {
  const stale = isStale(person);
  const free = days.flatMap((date) => freeOn(person, date).map((slot) => ({ date, ...slot })));

  return (
    <Stack gap={3} className={`rounded-lg border-2 px-4 py-3 ${open ? 'border-inverse bg-decor-cream' : 'border-line-hairline bg-raised'}`}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${person.name}, ${person.charge}% battery. ${open ? 'Close' : 'Open'}`}
        onPress={onToggle}
        className="active:opacity-70"
      >
        <Stack direction="row" gap={3} align="center">
          <Avatar initials={person.initials} band={person.band} size={40} stale={stale} pic={person.pic} mood={person.mood} />
          <Stack gap={1} grow>
            <Text variant="body" weight="semibold">{person.name}</Text>
            <Text variant="micro" tone="subtle">{stale ? `${lastSeen(person)} · may be out of date` : `${BAND_WORD[person.band]} · ${lastSeen(person)}`}</Text>
          </Stack>
          <Text variant="body" weight="semibold" tone={stale ? 'subtle' : TONE[person.band]}>{person.charge}%</Text>
          <Text variant="heading" tone="subtle">{open ? '⌃' : '⌄'}</Text>
        </Stack>
      </Pressable>

      {open ? (
        <Stack gap={3}>
          {person.status ? <Text variant="callout" tone="muted">“{person.status}”</Text> : null}
          <Stack gap={1}>
            <Text variant="micro" tone="subtle">FREE THIS WEEK</Text>
            <Text variant="footnote" tone={free.length ? 'recovery' : 'subtle'}>
              {free.length
                ? free.slice(0, 4).map((slot) => `${formatShort(slot.date).slice(0, 3)} ${formatHour(slot.start)}–${formatHour(slot.end)}`).join(' · ')
                : 'Nothing shared'}
            </Text>
          </Stack>
          {confirming ? (
            // Two buttons, side by side: removing someone is never one tap.
            <Stack gap={2} className="rounded-md bg-heavy-wash px-3 py-3">
              <Text variant="callout" weight="semibold" tone="heavy">Remove {person.name} from the group?</Text>
              <Stack direction="row" gap={2}>
                <Button label="Keep" kind="secondary" className="flex-1" onPress={onKeep} />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Yes, remove ${person.name}`}
                  onPress={onRemove}
                  className="min-h-button flex-1 items-center justify-center rounded-pill bg-heavy-fill px-4 active:opacity-70"
                >
                  <Text variant="callout" weight="bold" tone="inverse">Yes, remove</Text>
                </Pressable>
              </Stack>
            </Stack>
          ) : (
            <Stack direction="row" gap={2}>
              <Button label="✨ Message" kind="secondary" className="flex-1" onPress={onMessage} />
              {canRemove ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${person.name} from the group`}
                  onPress={onAskRemove}
                  className="min-h-button flex-1 items-center justify-center rounded-pill border-2 border-heavy-fill bg-heavy-wash px-4 active:opacity-70"
                >
                  <Text variant="callout" weight="semibold" tone="heavy" className="text-center">Remove</Text>
                </Pressable>
              ) : null}
            </Stack>
          )}
        </Stack>
      ) : null}
    </Stack>
  );
}
