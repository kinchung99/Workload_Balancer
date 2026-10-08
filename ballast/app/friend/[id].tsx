import { useMemo, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import {
  Avatar, Button, Card, Chip, Screen, Stack, Sticker, Text,
} from '@/components';
import { color } from '@design/tokens';
import { BAND_WORD, isStale, lastSeen } from '@/lib/circle';
import { PLAN_MESSAGE, busyFrom, freeOn, whatsapp } from '@/lib/sharing';
import { DAY_END, DAY_START, formatHour, slotHours, weekDays } from '@/lib/schedule';
import { dayName, formatShort } from '@/lib/dates';
import { successFeedback, tapFeedback } from '@/lib/haptics';
import { useStore } from '@/state/store';
import type { BandName } from '@/lib/types';

const TONE = { steady: 'steady', busy: 'busy', heavy: 'heavy', recovery: 'recovery' } as const;
const BAR = 30;

/** Two seeded friends, so `/friend/...` renders in the static export. */
export async function generateStaticParams() {
  return [{ id: 'ravi' }, { id: 'aisyah' }];
}

/**
 * One friend's published calendar.
 *
 * The thing a group chat cannot do. Four students trying to find an evening
 * send eleven messages and settle on a day that suits nobody, because none of
 * them can see the others' weeks — and the reason none of them can is that
 * showing your calendar has always meant showing your calendar.
 *
 * It does not here. Every filled block below is a window somebody chose to
 * publish; every empty one is "taken", with no way of knowing by what. That is
 * enough to plan a dinner and not enough to know anything about their week, and
 * the asymmetry is the point. Their battery sits at the top the whole time,
 * because a free evening from someone at 8% is not the same offer as a free
 * evening from someone at 71%.
 */
export default function FriendDay() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { circle, today } = useStore();
  const [sent, setSent] = useState(false);

  const person = circle.find((p) => p.id === id);
  const days = useMemo(() => weekDays(today), [today]);

  if (!person) {
    return (
      <Screen back="/friends" backLabel="Friends">
        <Stack gap={4} className="pt-6">
          <Text variant="title">Not in your circle.</Text>
          <Button label="Back to your circle" onPress={() => router.replace('/friends')} />
        </Stack>
      </Screen>
    );
  }

  const stale = isStale(person);
  const charge = person.charge ?? 0;
  const band: BandName = person.band;
  const shared = days.map((date) => ({ date, free: freeOn(person, date) }));
  const anyShared = shared.some((day) => day.free.length > 0);
  const best = shared
    .flatMap((day) => day.free.map((slot) => ({ ...slot, date: day.date })))
    .sort((a, b) => slotHours(b) - slotHours(a))[0];

  const open = (message: string) => {
    Linking.openURL(whatsapp(message, person.phone));
    successFeedback();
    setSent(true);
  };

  return (
    <Screen
      back="/friends"
      backLabel="Friends"
      footer={
        <>
          {best ? (
            <Button
              label={`Ask about ${dayName(best.date)}`}
              onPress={() => open(PLAN_MESSAGE(`${dayName(best.date)} from ${formatHour(best.start)}`, [person.name]))}
            />
          ) : null}
          <Button
            label="✨ Write them a message"
            kind={best ? 'secondary' : 'primary'}
            onPress={() => { tapFeedback(); router.push(`/message?kind=checkin&to=${person.id}` as Href); }}
          />
        </>
      }
    >
      <Stack gap={5} className="pt-2">
        {/*
          Their profile, in the same shape as yours.
          
          Avatar, name, the line they wrote, then their numbers. A friend's page
          reading like your own is what makes the circle feel like one place
          rather than a list of readouts.
        */}
        <Card tone={stale ? 'sunken' : band} gap={5} align="center">
          <Avatar initials={person.initials} band={stale ? undefined : band} stale={stale} size={96} charge={charge} pic={person.pic} mood={person.mood} />

          <Stack gap={2} align="center">
            <Text variant="title" accessibilityRole="header">{person.name}</Text>
            <Text variant="micro" tone={stale ? 'subtle' : TONE[band]}>
              {stale ? `Last checked in ${lastSeen(person)}` : `${BAND_WORD[band]} · ${lastSeen(person)}`}
            </Text>
            {person.status ? (
              <Text variant="callout" tone="muted" className="text-center">“{person.status}”</Text>
            ) : null}
          </Stack>

        </Card>


        {/* The published week. Filled is theirs to give, empty is only "taken". */}
        <Stack gap={3}>
          <Text variant="micro" tone="subtle">THIS WEEK, AS THEY SHARE IT</Text>

          {anyShared ? (
            <Card gap={4}>
              {shared.map(({ date, free }) => (
                <Pressable
                  key={date}
                  accessibilityRole="button"
                  accessibilityLabel={
                    free.length
                      ? `${dayName(date)}, free ${free.map((s) => `${formatHour(s.start)} to ${formatHour(s.end)}`).join(', ')}`
                      : `${dayName(date)}, nothing shared`
                  }
                  disabled={!free.length}
                  onPress={() => {
                    tapFeedback();
                    open(PLAN_MESSAGE(`${dayName(date)} from ${formatHour(free[0].start)}`, [person.name]));
                  }}
                  className="active:opacity-70"
                >
                  <Stack gap={2}>
                    <Stack direction="row" gap={3} align="center">
                      <Text variant="caption" weight="semibold" style={{ width: 62 }}>
                        {date === today ? 'Today' : dayName(date).slice(0, 3)}
                      </Text>
                      <Text variant="micro" tone={free.length ? 'recovery' : 'subtle'}>
                        {free.length
                          ? free.map((slot) => `${formatHour(slot.start)}–${formatHour(slot.end)}`).join(' · ')
                          : 'nothing shared'}
                      </Text>
                    </Stack>

                    {/* The day as one bar. No labels anywhere on it, ever. */}
                    <View className="flex-row overflow-hidden rounded-sm" style={{ height: BAR }}>
                      {(free.length ? merge(free, busyFrom(free)) : [{ start: DAY_START, end: DAY_END, free: false }])
                        .map((block) => (
                          <View
                            key={`${block.start}-${block.end}-${block.free}`}
                            style={{
                              flex: block.end - block.start,
                              backgroundColor: block.free ? color.band.recovery.fill : color.surface.sunken,
                            }}
                          />
                        ))}
                    </View>
                  </Stack>
                </Pressable>
              ))}
            </Card>
          ) : (
            <Card tone="sunken" gap={3}>
              <Stack direction="row" gap={4} align="center">
                <Sticker name="cloud" size={34} />
                <Text variant="callout" tone="muted" className="flex-1">
                  {person.name.split(' ')[0]} keeps their calendar private.
                </Text>
              </Stack>
              <Text variant="footnote" tone="subtle">You can still message them.</Text>
            </Card>
          )}

        </Stack>

        <Stack direction="row" gap={2} wrap>
          {sent ? <Chip label="Opened in WhatsApp" tone="steady" readOnly /> : null}
          <Chip label="👥 Plan with others" onPress={() => { tapFeedback(); router.push('/plan-together'); }} />
        </Stack>

        {best ? (
          <Text variant="footnote" tone="muted">
            Longest window: {formatShort(best.date)}, {slotHours(best)}h from {formatHour(best.start)}.
          </Text>
        ) : null}

        <View className="h-2" />
      </Stack>
    </Screen>
  );
}

/**
 * The day as one ordered run of blocks.
 *
 * Free and busy windows arrive as two separate lists that between them tile the
 * day; interleaving them by start time is what lets the bar be drawn in one
 * pass with flex weights rather than absolute positions.
 */
function merge(
  free: Array<{ start: number; end: number }>,
  busy: Array<{ start: number; end: number }>,
): Array<{ start: number; end: number; free: boolean }> {
  return [
    ...free.map((slot) => ({ ...slot, free: true })),
    ...busy.map((slot) => ({ ...slot, free: false })),
  ].sort((a, b) => a.start - b.start);
}
