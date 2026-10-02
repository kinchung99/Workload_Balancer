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
import { InvitedList } from '@/features/social/Planner';
import { GROUP_EMOJIS, groupWash } from '@/features/social/groupArt';

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
  const { groups, circle, today, invites, toggleGroupMember, updateGroup, deleteGroup } = useStore();
  const group = groups.find((g) => g.id === id);
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);

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
                <Text variant="micro">GROUP · {members.length + 1} PEOPLE</Text>
                {editing ? (
                  <TextInput
                    value={group.name}
                    onChangeText={(name) => updateGroup(group.id, { name: name.slice(0, 32) })}
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
                    onPress={() => { tapFeedback(); updateGroup(group.id, { emoji }); }}
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
              onToggle={() => { tapFeedback(); setOpen(open === person.id ? null : person.id); setConfirm(null); }}
              onMessage={() => { tapFeedback(); router.push(`/message?kind=checkin&to=${person.id}` as Href); }}
              onRemove={() => {
                if (confirm !== person.id) { tapFeedback(); setConfirm(person.id); return; }
                toggleGroupMember(group.id, person.id);
                successFeedback();
                setOpen(null);
                setConfirm(null);
              }}
            />
          ))}
          <Door family="people" sticker="wave" title="Add members" sub="From your circle" onPress={() => router.push(`/group/${group.id}/add` as Href)} />
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

        {invites.some((invite) => invite.groupId === group.id) ? (
          <InvitedList invites={invites.filter((invite) => invite.groupId === group.id)} />
        ) : null}

        <Button
          label="Delete this group"
          kind="quiet"
          onPress={() => {
            deleteGroup(group.id);
            successFeedback();
            router.replace('/friends');
          }}
        />
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
  person, days, open, confirming, onToggle, onMessage, onRemove,
}: {
  person: CircleMember;
  days: string[];
  open: boolean;
  confirming: boolean;
  onToggle: () => void;
  onMessage: () => void;
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
          <Stack direction="row" gap={2}>
            <Button label="✨ Message" kind="secondary" className="flex-1" onPress={onMessage} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={confirming ? `Confirm removing ${person.name}` : `Remove ${person.name} from the group`}
              onPress={onRemove}
              className={`min-h-button flex-1 items-center justify-center rounded-pill border-2 px-4 active:opacity-70 ${
                confirming ? 'border-heavy-fill bg-heavy-fill' : 'border-heavy-fill bg-heavy-wash'
              }`}
            >
              <Text variant="callout" weight="semibold" tone={confirming ? 'inverse' : 'heavy'} className="text-center">
                {confirming ? `Tap to remove ${person.name}` : 'Remove from group'}
              </Text>
            </Pressable>
          </Stack>
        </Stack>
      ) : null}
    </Stack>
  );
}
