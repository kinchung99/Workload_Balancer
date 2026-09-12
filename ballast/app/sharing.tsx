import { View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Battery, Card, PageHeader, Screen, Stack, Sticker, Text,
} from '@/components';
import { Pressable } from 'react-native';
import { color } from '@design/tokens';
import { SCREEN } from '@design/screens';
import { VISIBILITY, published } from '@/lib/sharing';
import { formatHour, weekDays } from '@/lib/schedule';
import { dayName } from '@/lib/dates';
import { tapFeedback } from '@/lib/haptics';
import { useStore } from '@/state/store';
import { useItemsWithLogs, useReading } from '@/state/selectors';

/**
 * What your circle sees — shown, not described.
 *
 * Privacy settings normally fail in the same way: three options explained in
 * prose, no way to check what you just agreed to, so people pick one at random
 * and never trust it again. This screen answers the only question that matters —
 * *what does Ravi actually see when he taps my name?* — by showing him his own
 * view of your week, live, as you change the setting.
 *
 * Nothing on it is a dark pattern. `Nothing` is genuinely nothing, it is one tap
 * from here, and choosing it does not disable the rest of the app.
 */
export default function Sharing() {
  const router = useRouter();
  const { circle, sharing, setSharing, today } = useStore();
  const items = useItemsWithLogs();
  const reading = useReading();
  const days = weekDays(today);

  /** Exactly what a friend would be shown, computed by the same function they read. */
  const preview = days.map((date) => ({ date, free: published(items, date, sharing) }));
  const windows = preview.reduce((sum, day) => sum + day.free.length, 0);
  /** Named, because "what your friends see" is abstract and "what Ravi sees" is not. */
  const someone = circle.find((person) => !person.isYou);

  return (
    <Screen back="/friends" backLabel="Friends">
      <Stack gap={5} className="pt-2">
        <PageHeader
          {...SCREEN.sharing}
          eyebrow="Your privacy"
          title="What they see"
        />

        {/* Always shared, and worth saying plainly rather than hiding in prose. */}
        <Card tone="steady" gap={4}>
          <Stack direction="row" gap={4} align="center">
            <Battery charge={reading.charge} loadPercent={reading.overall} width={64} height={32} label={`${reading.charge} percent`} />
            <Stack gap={1} grow>
              <Text variant="body" weight="semibold">Your battery · {reading.charge}%</Text>
              <Text variant="micro" tone="subtle">Always shared. It is how they know to check on you.</Text>
            </Stack>
          </Stack>
        </Card>

        <Stack gap={3}>
          <Text variant="micro" tone="subtle">YOUR CALENDAR</Text>
          {VISIBILITY.map((option) => {
            const picked = sharing === option.value;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityState={{ checked: picked }}
                accessibilityLabel={`${option.word}. ${option.note}`}
                onPress={() => { tapFeedback(); setSharing(option.value); }}
                className={`min-h-row flex-row items-center gap-4 rounded-lg border-2 px-4 py-4 active:opacity-70 ${
                  picked ? 'border-inverse bg-decor-cream' : 'border-line-hairline bg-raised'
                }`}
              >
                <View
                  className="items-center justify-center rounded-pill"
                  style={{ width: 26, height: 26, borderWidth: 2.5, borderColor: picked ? color.ink.default : color.line.strong }}
                >
                  {picked ? <View className="rounded-pill" style={{ width: 12, height: 12, backgroundColor: color.ink.default }} /> : null}
                </View>
                <Stack gap={1} grow>
                  <Text variant="body" weight="semibold">{option.word}</Text>
                  <Text variant="micro" tone="muted">{option.note}</Text>
                </Stack>
              </Pressable>
            );
          })}
        </Stack>

        {/* Their view of you, live. The whole reason this screen is trustworthy. */}
        <Stack gap={3}>
          <Text variant="micro" tone="subtle">
            {someone ? `${someone.name.split(' ')[0].toUpperCase()}'S VIEW OF YOUR WEEK` : 'WHAT A FRIEND WOULD SEE'}
          </Text>
          <Card tone={windows ? 'recovery' : 'sunken'} gap={3}>
            {windows ? (
              preview.map(({ date, free }) => (
                <Stack key={date} direction="row" gap={3} align="center">
                  <Text variant="caption" weight="semibold" style={{ width: 62 }}>
                    {date === today ? 'Today' : dayName(date).slice(0, 3)}
                  </Text>
                  <Text variant="micro" tone={free.length ? 'recovery' : 'subtle'} className="flex-1">
                    {free.length
                      ? free.map((slot) => `${formatHour(slot.start)}–${formatHour(slot.end)}`).join(' · ')
                      : 'nothing'}
                  </Text>
                </Stack>
              ))
            ) : (
              <Stack direction="row" gap={4} align="center">
                <Sticker name="cloud" size={34} />
                <Text variant="callout" tone="muted" className="flex-1">
                  Nothing. Your calendar is private.
                </Text>
              </Stack>
            )}
          </Card>
          <Text variant="footnote" tone="subtle">
            Never a title, a deadline or who you are with. There is no field for it.
          </Text>
        </Stack>

        <View className="h-2" />
      </Stack>
    </Screen>
  );
}
