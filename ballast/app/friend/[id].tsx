import { useMemo, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import {
  Avatar, Button, Chip, Screen, Section, Stack, Sticker, Text,
} from '@/components';
import { color } from '@design/tokens';
import { BAND_WORD, isStale, lastSeen } from '@/lib/circle';
import { PLAN_MESSAGE, busyFrom, freeOn, whatsapp } from '@/lib/sharing';
import { formatHour, slotHours, weekDays } from '@/lib/schedule';
import { dayName } from '@/lib/dates';
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

  const open = (message: string) => {
    Linking.openURL(whatsapp(message, person.phone));
    successFeedback();
    setSent(true);
  };

  const freeHours = Math.round(shared.reduce((t, day) => t + day.free.reduce((h, slot) => h + slotHours(slot), 0), 0));
  const first = person.name.split(' ')[0];

  return (
    <Screen
      back="/friends"
      backLabel="Friends"
      footer={
        <Button
          label="💬 Text something"
          onPress={() => { tapFeedback(); router.push(`/message?kind=checkin&to=${person.id}` as Href); }}
        />
      }
    >
      <Stack gap={5} className="pt-2">
        {/* Their profile: a picture, their note in a bubble, three numbers. */}
        <View className="overflow-hidden rounded-xl px-5 pb-5 pt-6" style={{ backgroundColor: stale ? color.surface.sunken : color.band[band].wash }}>
          {/* A little confetti of stickers in the corners. Decoration only. */}
          <View pointerEvents="none" style={{ position: 'absolute', top: 12, left: 14, opacity: 0.55, transform: [{ rotate: '-12deg' }] }}>
            <Sticker name="heart" size={30} />
          </View>
          <View pointerEvents="none" style={{ position: 'absolute', top: 18, right: 16, opacity: 0.55, transform: [{ rotate: '10deg' }] }}>
            <Sticker name="sparkle" size={28} />
          </View>
          <View pointerEvents="none" style={{ position: 'absolute', bottom: 86, right: 22, opacity: 0.4 }}>
            <Sticker name="star" size={22} />
          </View>

          <Stack gap={3} align="center">
            {person.status ? (
              <View className="rounded-xl bg-raised px-4 py-2" style={{ maxWidth: '86%', borderWidth: 2, borderColor: color.line.hairline }}>
                <Text variant="callout" weight="semibold" className="text-center">“{person.status}”</Text>
              </View>
            ) : null}
            <Avatar initials={person.initials} band={stale ? undefined : band} stale={stale} size={104} charge={charge} pic={person.pic} mood={person.mood} />
            <Stack gap={1} align="center">
              <Text variant="title" accessibilityRole="header">{person.name}</Text>
              <View className="rounded-pill bg-raised px-3 py-1">
                <Text variant="micro" weight="bold" tone={stale ? 'subtle' : TONE[band]}>
                  {stale ? `Last checked in ${lastSeen(person)}` : BAND_WORD[band]}
                </Text>
              </View>
            </Stack>

            <Stack direction="row" gap={2} className="w-full pt-1">
              {[
                { value: `${charge}%`, label: 'battery', emoji: '🔋' },
                { value: anyShared ? `${freeHours}h` : '—', label: 'free this week', emoji: '🕒' },
                { value: lastSeen(person).replace(' ago', ''), label: 'last update', emoji: '👋' },
              ].map((stat) => (
                <Stack key={stat.label} gap={0} align="center" className="flex-1 rounded-lg bg-raised px-2 py-3">
                  <Text variant="caption">{stat.emoji}</Text>
                  <Text variant="heading" numberOfLines={1}>{stat.value}</Text>
                  <Text variant="micro" tone="subtle" numberOfLines={1}>{stat.label}</Text>
                </Stack>
              ))}
            </Stack>
          </Stack>
        </View>

        {/* The published week. Filled is theirs to give, empty is only "taken". */}
        <Section family="people" title={`When ${first}’s free`} sticker="calendar" meta={anyShared ? 'This week' : undefined}>
          {anyShared ? (
            <Stack gap={2}>
              {shared.map(({ date, free }) => (
                <Pressable
                  key={date}
                  accessibilityRole="button"
                  accessibilityLabel={
                    free.length
                      ? `${dayName(date)}, free ${free.map((slot) => `${formatHour(slot.start)} to ${formatHour(slot.end)}`).join(', ')}. Ask them`
                      : `${dayName(date)}, nothing shared`
                  }
                  disabled={!free.length}
                  onPress={() => {
                    tapFeedback();
                    open(PLAN_MESSAGE(`${dayName(date)} from ${formatHour(free[0].start)}`, [person.name]));
                  }}
                  className="rounded-lg bg-raised px-4 py-3 active:opacity-70"
                  style={{ opacity: free.length ? 1 : 0.55 }}
                >
                  <Stack gap={2}>
                    <Stack direction="row" gap={3} align="center">
                      <Text variant="caption" weight="bold" style={{ width: 52 }}>
                        {date === today ? 'Today' : dayName(date).slice(0, 3)}
                      </Text>
                      <Stack direction="row" gap={1} wrap className="flex-1">
                        {free.length ? free.map((slot) => (
                          <View key={slot.start} className="rounded-pill px-2 py-1" style={{ backgroundColor: color.band.recovery.wash }}>
                            <Text variant="micro" weight="bold" tone="recovery">{formatHour(slot.start)}–{formatHour(slot.end)}</Text>
                          </View>
                        )) : <Text variant="micro" tone="subtle">Nothing shared</Text>}
                      </Stack>
                      {free.length ? <Text variant="caption" weight="bold" tone="recovery">Ask ›</Text> : null}
                    </Stack>
                    {free.length ? (
                      // The day as one bar. No labels anywhere on it, ever.
                      <View className="flex-row overflow-hidden rounded-sm" style={{ height: BAR / 2 }}>
                        {merge(free, busyFrom(free)).map((block) => (
                          <View
                            key={`${block.start}-${block.end}-${block.free}`}
                            style={{ flex: block.end - block.start, backgroundColor: block.free ? color.band.recovery.fill : color.surface.sunken }}
                          />
                        ))}
                      </View>
                    ) : null}
                  </Stack>
                </Pressable>
              ))}
            </Stack>
          ) : (
            <Stack direction="row" gap={4} align="center" className="rounded-lg bg-raised px-4 py-4">
              <Sticker name="cloud" size={34} />
              <Text variant="callout" tone="muted" className="flex-1">{first} keeps their calendar private.</Text>
            </Stack>
          )}
        </Section>

        <Stack direction="row" gap={2} wrap>
          {sent ? <Chip label="✓ Opened in WhatsApp" tone="steady" readOnly /> : null}
          <Chip label="👥 Plan with others" onPress={() => { tapFeedback(); router.push('/plan-together'); }} />
        </Stack>

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
