import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import {
  Avatar, Battery, Button, Card, Chip, Door, PageHeader, Screen, Section, Stack, Sticker, Text,
} from '@/components';
import { color } from '@design/tokens';
import { FAMILY } from '@design/families';
import { SCREEN } from '@design/screens';
import { groupWash } from '@/features/social/groupArt';
import { BAND_WORD, circleOrder, frequentFriends, isStale, lastSeen, updatedToday, worthANudge } from '@/lib/circle';
import { chargeOf } from '@/lib/battery';
import { successFeedback, tapFeedback } from '@/lib/haptics';
import { CHECK_IN_MESSAGE, VISIBILITY, VISIBILITY_WORD, onBallastCount, whatsapp, type ShareMode } from '@/lib/sharing';
import { useStore } from '@/state/store';
import { useReading } from '@/state/selectors';
import { bandFor } from '@/lib/load';
import { shownMood } from '@/lib/checkin';
import { PersonRow } from '@/features/social/PersonRow';
import { api } from '@/lib/api';
import { useAiAnswer } from '@/lib/ai';
import type { BandName, CircleMember } from '@/lib/types';

const TONE = { steady: 'steady', busy: 'busy', heavy: 'heavy', recovery: 'recovery' } as const;
const SHARE_EMOJI = (mode: ShareMode) => VISIBILITY.find((option) => option.value === mode)?.emoji ?? '';
const RING: Record<BandName, string> = {
  steady: color.band.steady.fill,
  busy: color.band.busy.fill,
  heavy: color.band.heavy.fill,
  recovery: color.band.recovery.fill,
};

/**
 * Friends — the only part of this app that is between people.
 *
 * Everything else measures one student's week. This measures the gap between
 * four of them, and it runs on one number: how long ago each person last
 * updated their own battery.
 *
 * That number does two jobs. It makes a reading honest — Jo at 24% three days
 * ago is a different claim from Jo at 24% twenty minutes ago — and it is the
 * only thing in Ballast that gives you a reason to open it when your own week
 * is fine. A tracker you keep for yourself is a chore. One where four people
 * checked in this morning is somewhere you look.
 *
 * What is never shared: your numbers, your tasks, your calendar. A band, a
 * charge, and a line you wrote yourself. That is the whole payload.
 */
export default function Friends() {
  const router = useRouter();
  const { circle, phoneContacts, sharing, markContacted, logMoment, groups, pic, status, account, moods, vibe, invites, received } = useStore();
  const newPlans = received.filter((invite) => !invite.answer).length;
  const waitingOn = invites.filter((invite) => invite.people.some((id) => !invite.answers?.[id])).length;
  const goingTo = received.filter((invite) => invite.answer === 'yes').length + invites.filter((invite) => invite.scheduled).length;
  const myMood = shownMood(vibe, moods);
  const reading = useReading();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const others = circleOrder(circle);
  const frequent = frequentFriends(circle, 5);
  const you = circle.find((p) => p.isYou);
  const active = updatedToday(circle);
  const nudge = worthANudge(circle);
  const toAdd = onBallastCount(phoneContacts);

  /**
   * The message, opened where they will actually read it.
   *
   * It used to go to the clipboard, which meant the student then had to leave,
   * find the person, and paste - three steps between a good intention and a
   * sent message, which is exactly where good intentions die. The app writes it
   * and WhatsApp opens with the chat ready. Sending is still their tap.
   */
  /*
   * The check-in itself, written by the AI for this person and why they came
   * up - "heavy for 11 days" reads differently from "quiet for a week". The
   * plain line stays until the AI's arrives, and if it never does.
   */
  const firstName = nudge?.person.name.split(' ')[0] ?? '';
  const aiNote = useAiAnswer(
    nudge ? `checkin-note:${nudge.person.id}:${nudge.reason}` : null,
    async () => {
      if (!nudge) return null;
      const res = await api.composeDraft({
        context: {
          kind: 'checkin',
          subject: `Checking in on ${firstName}`,
          to: firstName,
          pressure: `They have been ${nudge.reason}`,
          ...(nudge.person.charge !== undefined ? { theirCharge: nudge.person.charge } : {}),
        },
        intent: { title: 'A gentle check-in', detail: 'No pressure to reply' },
        tone: 'warm',
        length: 'short',
      });
      return res.ok ? res.data.message : null;
    },
  );
  const note = nudge ? aiNote ?? CHECK_IN_MESSAGE(nudge.person.name) : '';

  const send = (person: CircleMember, text = CHECK_IN_MESSAGE(person.name)) => {
    Linking.openURL(whatsapp(text, person.phone));
    markContacted(person.id);
    logMoment('good-chat', 'social', 3);
    successFeedback();
    setSentTo(person.id);
  };

  return (
    <Screen footer={<Button label="Plan something together" onPress={() => router.push('/plan-together')} />}>
      <Stack gap={5} className="pt-2">
        <PageHeader
          {...SCREEN.friends}
          eyebrow={`${active} checked in today`}
          title="Your circle"
        />

        <Pressable
          accessibilityRole="search"
          accessibilityLabel="Search friends"
          onPress={() => { tapFeedback(); router.push('/everyone?search=1' as Href); }}
          className="min-h-min flex-row items-center gap-2 rounded-pill border-2 border-line-hairline bg-sunken px-4 py-3 active:opacity-70"
        >
          <Text variant="callout">🔍</Text>
          <Text variant="body" tone="subtle" className="flex-1">Search {others.length} friends</Text>
        </Pressable>

        {/* You first, in your own colour: the reading your circle sees, and one
            tap to change what they see. The whole thing only works if you keep
            your side of it current. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`You, ${reading.charge} percent. Sharing: ${VISIBILITY_WORD(sharing)}. Tap to change what your circle sees.`}
          onPress={() => { tapFeedback(); router.push('/sharing'); }}
          className="active:opacity-70"
        >
          <View className="overflow-hidden rounded-xl border-2" style={{ borderColor: FAMILY.you.wash }}>
            <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: FAMILY.you.wash, opacity: 0.3 }]} />
            <Stack gap={3} className="px-4 py-4">
              <PersonRow
                name="You"
                initials={account?.initials ?? 'Y'}
                band={bandFor(reading.overall)}
                charge={reading.charge}
                pic={pic}
                mood={myMood}
                status={status}
                line={you?.updatedMinsAgo !== undefined ? `Updated ${lastSeen(you)}` : 'Not shared yet'}
              />
              <Stack direction="row" gap={3} align="center" className="rounded-pill bg-raised px-4 py-2">
                <Text variant="footnote" className="flex-1">
                  {SHARE_EMOJI(sharing)} Sharing: {VISIBILITY_WORD(sharing).toLowerCase()}
                </Text>
                <Text variant="footnote" weight="semibold">Change ›</Text>
              </Stack>
            </Stack>
          </View>
        </Pressable>

        {/* At most one person to check on, ever. A list of five people who might
            need you is a list nobody acts on. */}
        {nudge ? (
          <Card tone="recovery" gap={4}>
            <Stack direction="row" gap={4} align="center">
              <Sticker name="heart" size={42} wiggle />
              <Stack gap={1} grow>
                <Text variant="micro" tone="recovery">MAYBE CHECK ON</Text>
                <Text variant="heading">{nudge.person.name}</Text>
                <Text variant="footnote" tone="muted">{nudge.reason}</Text>
              </Stack>
            </Stack>
            {/* What will be sent, as it will read. */}
            {sentTo !== nudge.person.id ? (
              <View className="rounded-lg bg-raised px-4 py-3">
                <Text variant="callout">{aiNote ? '✨ ' : ''}“{note}”</Text>
              </View>
            ) : null}
            {sentTo === nudge.person.id ? (
              <Text variant="callout" weight="semibold" tone="recovery" accessibilityLiveRegion="polite">
                Opened in WhatsApp.
              </Text>
            ) : (
              <Stack direction="row" gap={2}>
                <Button
                  label="Send it"
                  kind="secondary"
                  className="flex-1"
                  onPress={() => send(nudge.person, note)}
                />
                <Button
                  label="✏️"
                  kind="secondary"
                  accessibilityLabel={`Write ${nudge.person.name} a message`}
                  onPress={() => { tapFeedback(); router.push(`/message?kind=checkin&to=${nudge.person.id}` as Href); }}
                />
              </Stack>
            )}
          </Card>
        ) : null}

        {/* Plans: what you were asked to, and what you asked. */}
        <Section family="people" title="Plans" sticker="calendar" meta={goingTo ? `${goingTo} on` : undefined} action={{ label: 'All ›', onPress: () => router.push('/plans' as Href) }}>
          <Stack direction="row" gap={3}>
            {([
              { tab: 'received', emoji: '📥', title: 'Received', sub: newPlans ? `${newPlans} new` : `${received.length} total`, hot: newPlans },
              { tab: 'sent', emoji: '📤', title: 'Sent', sub: waitingOn ? `${waitingOn} waiting` : `${invites.length} total`, hot: 0 },
            ] as const).map((tile) => (
              <Pressable
                key={tile.tab}
                accessibilityRole="button"
                accessibilityLabel={`${tile.title}, ${tile.sub}`}
                onPress={() => { tapFeedback(); router.push(`/plans?tab=${tile.tab}` as Href); }}
                className="flex-1 flex-row items-center gap-3 rounded-lg bg-raised px-4 py-3 active:opacity-70"
                style={{ borderWidth: 2, borderColor: tile.hot ? color.band.heavy.fill : color.line.hairline }}
              >
                <Text variant="title">{tile.emoji}</Text>
                <Stack gap={0} grow>
                  <Text variant="body" weight="semibold">{tile.title}</Text>
                  <Text variant="micro" tone={tile.hot ? 'heavy' : 'subtle'}>{tile.sub}</Text>
                </Stack>
              </Pressable>
            ))}
          </Stack>
        </Section>

        {/* Groups, as story bubbles: the people you plan with most, one tap away. */}
        <Section family="people" title="Groups" sticker="heart" meta={`${groups.length}`}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingRight: 8 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="New group"
              onPress={() => { tapFeedback(); router.push('/group/new' as Href); }}
              className="items-center gap-2 active:opacity-60"
              style={{ width: 76 }}
            >
              <View className="items-center justify-center rounded-pill border-2 border-dashed border-line-strong bg-raised" style={{ width: 68, height: 68 }}>
                <Text variant="title" tone="subtle">＋</Text>
              </View>
              <Text variant="micro" tone="muted">New group</Text>
            </Pressable>
            {groups.map((group) => {
              const members = circle.filter((person) => group.members.includes(person.id));
              return (
                <Pressable
                  key={group.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${group.name}, ${members.length + 1} people`}
                  onPress={() => { tapFeedback(); router.push(`/group/${group.id}` as Href); }}
                  className="items-center gap-2 active:opacity-60"
                  style={{ width: 76 }}
                >
                  {/* A ring like a story bubble, so a group reads as a place you can open. */}
                  <View className="items-center justify-center rounded-pill bg-raised" style={{ width: 68, height: 68, borderWidth: 3, borderColor: color.decor.blush, padding: 3 }}>
                    <View className="h-full w-full items-center justify-center rounded-pill" style={{ backgroundColor: groupWash(group.id) }}>
                      <Text variant="title">{group.emoji}</Text>
                    </View>
                  </View>
                  <Text variant="micro" weight="semibold" numberOfLines={1}>{group.name}</Text>
                  <Stack direction="row" style={{ marginTop: -2 }}>
                    {members.slice(0, 3).map((person, i) => (
                      <View key={person.id} className="items-center justify-center rounded-pill bg-sunken" style={{ width: 20, height: 20, marginLeft: i ? -6 : 0, borderWidth: 1.5, borderColor: color.surface.page }}>
                        <Text variant="micro">{person.initials[0]}</Text>
                      </View>
                    ))}
                  </Stack>
                </Pressable>
              );
            })}
          </ScrollView>
        </Section>

        {/* The few you actually talk to. Everyone else is one page away, A to Z. */}
        <Section family="people" title="Frequent" sticker="star" meta={`${frequent.length} of ${others.length}`}>
          {frequent.map((person) => (
            <FriendRow
              key={person.id}
              person={person}
              open={open === person.id}
              sent={sentTo === person.id}
              onToggle={() => { tapFeedback(); setOpen(open === person.id ? null : person.id); }}
              onSend={() => send(person)}
              onWrite={() => { tapFeedback(); router.push(`/message?kind=checkin&to=${person.id}` as Href); }}
              onCalendar={() => { tapFeedback(); router.push(`/friend/${person.id}`); }}
            />
          ))}
          <Door
            family="people"
            title={`All friends · ${others.length}`}
            sub={`${active} checked in today`}
            onPress={() => router.push('/everyone' as Href)}
          />
          <Door
            family="people"
            sticker="chat"
            title="Find friends"
            sub={toAdd ? `${toAdd} of your contacts are here` : 'From your contacts'}
            onPress={() => router.push('/find-friends')}
          />
        </Section>

        <View className="h-2" />
      </Stack>
    </Screen>
  );
}

/**
 * One person. Closed it is a reading; open it is the two things you can do.
 *
 * The stale case matters most: a number nobody has confirmed for three days is
 * shown greyed with the age next to it, because the alternative is the app
 * quietly inventing news.
 */
function FriendRow({
  person, open, sent, onToggle, onSend, onWrite, onCalendar,
}: {
  person: CircleMember;
  open: boolean;
  sent: boolean;
  onToggle: () => void;
  onSend: () => void;
  onWrite: () => void;
  onCalendar: () => void;
}) {
  const stale = isStale(person);
  const charge = person.charge ?? 0;

  return (
    <Stack gap={3} className={`rounded-xl border-2 bg-raised px-4 py-4 ${open ? 'border-inverse' : 'border-line-hairline'}`}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${person.name}, ${BAND_WORD[person.band]}, ${charge} percent, updated ${lastSeen(person)}${person.status ? `. “${person.status}”` : ''}`}
        onPress={onToggle}
        className="active:opacity-70"
      >
        <Stack direction="row" gap={2} align="start">
          <View className="flex-1">
            <PersonRow
              name={person.name}
              initials={person.initials}
              band={person.band}
              charge={charge}
              pic={person.pic}
              mood={person.mood}
              status={person.status}
              stale={stale}
              active={(person.updatedMinsAgo ?? Infinity) < 60}
              line={stale ? `${lastSeen(person)} · may be out of date` : `${BAND_WORD[person.band]} · ${lastSeen(person)}`}
            />
          </View>
          <Text variant="heading" tone="subtle" className="pt-4">{open ? '⌃' : '⌄'}</Text>
        </Stack>
      </Pressable>

      {open ? (
        <Stack direction="row" gap={2} wrap>
          <Chip
            label={person.free?.length ? `See when they're free` : 'Calendar is private'}
            tone={person.free?.length ? 'selected' : 'plain'}
            onPress={person.free?.length ? onCalendar : undefined}
            readOnly={!person.free?.length}
          />
          {sent ? (
            <Chip label="Opened in WhatsApp" tone="steady" readOnly />
          ) : (
            <Chip label="Say hi" onPress={onSend} />
          )}
          <Chip label="✏️ Write a message" onPress={onWrite} />
        </Stack>
      ) : null}
    </Stack>
  );
}
