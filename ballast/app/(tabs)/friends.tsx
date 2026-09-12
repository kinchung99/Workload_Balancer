import { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Battery, Button, Card, Chip, PageHeader, Screen, Stack, Sticker, Text,
} from '@/components';
import { color } from '@design/tokens';
import { SCREEN } from '@design/screens';
import { BAND_WORD, circleOrder, isStale, lastSeen, updatedToday, worthANudge } from '@/lib/circle';
import { chargeOf } from '@/lib/battery';
import { successFeedback, tapFeedback } from '@/lib/haptics';
import { CHECK_IN_MESSAGE, VISIBILITY_WORD, onBallastCount, whatsapp } from '@/lib/sharing';
import { useStore } from '@/state/store';
import { useReading } from '@/state/selectors';
import type { BandName, CircleMember } from '@/lib/types';

const TONE = { steady: 'steady', busy: 'busy', heavy: 'heavy', recovery: 'recovery' } as const;
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
  const { circle, phoneContacts, sharing, markContacted, logMoment } = useStore();
  const reading = useReading();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const others = circleOrder(circle);
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
  const send = (person: CircleMember) => {
    Linking.openURL(whatsapp(CHECK_IN_MESSAGE(person.name), person.phone));
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

        {/* Your own row first, because the whole thing only works if you keep
            your side of it current. This is the come-back loop. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`You, ${reading.charge} percent. Sharing: ${VISIBILITY_WORD(sharing)}. Tap to change what your circle sees.`}
          onPress={() => { tapFeedback(); router.push('/sharing'); }}
          className="active:opacity-70"
        >
          <Card tone={active > 0 ? 'steady' : 'sunken'} gap={4}>
            <Stack direction="row" gap={4} align="center">
              <Battery
                charge={reading.charge}
                loadPercent={reading.overall}
                width={64}
                height={32}
                label={`You, ${reading.charge} percent`}
              />
              <Stack gap={1} grow>
                <Text variant="body" weight="semibold">You · {reading.charge}%</Text>
                <Text variant="micro" tone="subtle">
                  {you?.updatedMinsAgo !== undefined ? `Updated ${lastSeen(you)}` : 'Not shared yet'}
                </Text>
              </Stack>
              <Sticker name="wave" size={38} wiggle={active > 0} />
            </Stack>
            <Stack direction="row" gap={3} align="center">
              <Text variant="footnote" tone="muted" className="flex-1">
                Sharing: {VISIBILITY_WORD(sharing).toLowerCase()}
              </Text>
              <Text variant="footnote" tone="subtle">Change ›</Text>
            </Stack>
          </Card>
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
            {sentTo === nudge.person.id ? (
              <Text variant="callout" weight="semibold" tone="recovery" accessibilityLiveRegion="polite">
                Opened in WhatsApp.
              </Text>
            ) : (
              <Button
                label={`Send "thinking of you"`}
                kind="secondary"
                onPress={() => send(nudge.person)}
              />
            )}
          </Card>
        ) : null}

        {/* The circle. View only — tap a row for what you can do about it. */}
        <Stack gap={3}>
          <Stack direction="row" gap={3} align="center" className="rounded-pill py-2 pl-2 pr-4" style={{ backgroundColor: color.decor.candy }}>
            <View className="items-center justify-center rounded-pill" style={{ width: 30, height: 30, backgroundColor: color.surface.page }}>
              <Sticker name="people" size={21} />
            </View>
            <Text variant="caption" weight="semibold" className="flex-1">Everyone</Text>
          </Stack>

          {others.map((person) => (
            <FriendRow
              key={person.id}
              person={person}
              open={open === person.id}
              sent={sentTo === person.id}
              onToggle={() => { tapFeedback(); setOpen(open === person.id ? null : person.id); }}
              onSend={() => send(person)}
              onCalendar={() => { tapFeedback(); router.push(`/friend/${person.id}`); }}
            />
          ))}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={toAdd ? `Find friends. ${toAdd} of your contacts are already on Ballast.` : 'Find friends from your contacts'}
            onPress={() => { tapFeedback(); router.push('/find-friends'); }}
            className="active:opacity-70"
          >
            <Stack direction="row" gap={4} align="center" className="min-h-row rounded-lg border-2 border-dashed border-line-strong px-4 py-4">
              <Sticker name="chat" size={34} />
              <Stack gap={1} grow>
                <Text variant="body" weight="semibold">Find friends</Text>
                <Text variant="micro" tone="subtle">
                  {toAdd ? `${toAdd} of your contacts are here` : 'From your contacts'}
                </Text>
              </Stack>
              <Text variant="heading" tone="subtle">›</Text>
            </Stack>
          </Pressable>
        </Stack>

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
  person, open, sent, onToggle, onSend, onCalendar,
}: {
  person: CircleMember;
  open: boolean;
  sent: boolean;
  onToggle: () => void;
  onSend: () => void;
  onCalendar: () => void;
}) {
  const stale = isStale(person);
  const charge = person.charge ?? 0;

  return (
    <Stack gap={3} className={`rounded-lg border-2 px-4 py-4 ${open ? 'border-inverse bg-decor-cream' : 'border-line-hairline bg-raised'}`}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${person.name}, ${BAND_WORD[person.band]}, ${charge} percent, updated ${lastSeen(person)}`}
        onPress={onToggle}
        className="active:opacity-70"
      >
        <Stack direction="row" gap={4} align="center">
          <View
            className="items-center justify-center rounded-pill"
            style={{ width: 44, height: 44, borderWidth: 2.5, borderColor: stale ? color.line.strong : RING[person.band] }}
          >
            <Text variant="footnote" weight="semibold" tone={stale ? 'subtle' : TONE[person.band]}>
              {person.initials}
            </Text>
          </View>
          <Stack gap={1} grow>
            <Stack direction="row" gap={3} align="center">
              <Text variant="body" weight="semibold">{person.name}</Text>
              <Text variant="body" weight="semibold" tone={stale ? 'subtle' : TONE[person.band]}>{charge}%</Text>
            </Stack>
            <Text variant="micro" tone="subtle">
              {stale ? `${lastSeen(person)} · may be out of date` : `${BAND_WORD[person.band]} · ${lastSeen(person)}`}
            </Text>
            {person.status ? <Text variant="micro" tone="muted">“{person.status}”</Text> : null}
          </Stack>
          <Text variant="heading" tone="subtle">{open ? '⌃' : '⌄'}</Text>
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
            <Chip label="Send a message" onPress={onSend} />
          )}
        </Stack>
      ) : null}
    </Stack>
  );
}
