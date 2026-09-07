import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Bar, Screen, Stack, Text } from '@/components';
import { formatLong } from '@/lib/dates';
import { bandFor } from '@/lib/load';
import { CHARGE_LABEL, chargeOf } from '@/lib/battery';
import { itemsOnDay, liveCeiling, useStore, weekReading } from '@/state/store';
import { useReading } from '@/state/selectors';
import { WEEK_NUMBER } from '@/data/seed';
import { addDays } from '@/lib/dates';

const FELT = ['Fine', 'Meh', 'Hard'] as const;

/**
 * The widget, and the whole daily ask.
 *
 * The widget is the product on most days. A student glancing at their lock
 * screen gets the sanity check without opening anything. Load that requires
 * opening an app is load the app is adding.
 *
 * No streaks, ever. Streak mechanics punish exactly the weeks this app exists
 * for. Miss four days and you get a welcome back, not a broken chain and a guilt
 * notification.
 */
export default function Widget() {
  const { items, ceilings, today, reportDay, dayReports, overallCeiling } = useStore();
  const { overall } = useReading();
  const [answered, setAnswered] = useState<(typeof FELT)[number] | null>(null);
  const band = bandFor(overall);
  const tomorrow = addDays(today, 1);

  // The app has already made the call about what matters, so the student does
  // not have to. Highest dread first, then heaviest.
  const focus = [...itemsOnDay(items, tomorrow)].sort(
    (a, b) => b.dread - a.dread || b.hours * b.dread - a.hours * a.dread,
  )[0];

  return (
    <Screen surface="night" scroll={false} back="/foundations" backLabel="Back">
      <Stack gap={8} className="pt-8">
        <Stack gap={2} align="center">
          <Text variant="footnote" tone="nightMuted">{formatLong(tomorrow)}</Text>
          <Text variant="hero" tone="inverse">9:41</Text>
        </Stack>

        {/* b. The lock-screen widget. The same number as Home, so on most days a
            student never opens the app at all. */}
        <View className="rounded-lg bg-inverse p-5">
          <Stack gap={4}>
            <Stack direction="row" justify="between" align="center">
              <Text variant="caption" tone="nightMuted">Ballast</Text>
              <Text variant="caption" tone="nightMuted">week {WEEK_NUMBER}</Text>
            </Stack>
            <Stack direction="row" gap={4} align="center">
              <Text variant="display" tone="heavy">{chargeOf(overall)}%</Text>
              <Text variant="callout" tone="nightMuted">{CHARGE_LABEL[band]}</Text>
            </Stack>
            <Bar band={band} percent={overall} />
            <Text variant="footnote" tone="inverse">
              One thing today. The {focus ? focus.title.toLowerCase() : 'day is clear'}.
            </Text>
          </Stack>
        </View>

        {/* c. One tap is the whole daily ask. Four options, no text entry, and it
            feeds the ceiling calibration: report "hard" at 70% a few times and
            70% becomes your new red line. */}
        <View className="rounded-lg bg-inverse p-5">
          <Stack gap={5}>
            <Text variant="callout" tone="inverse">How was today?</Text>
            <Stack direction="row" gap={3} justify="between">
              {FELT.map((option) => (
                <Pressable
                  key={option}
                  accessibilityRole="button"
                  accessibilityLabel={`Today was ${option.toLowerCase()}`}
                  accessibilityState={{ selected: answered === option }}
                  onPress={() => {
                    setAnswered(option);
                    reportDay(option.toLowerCase() as 'fine' | 'meh' | 'hard', overall);
                  }}
                  className={`min-h-min flex-1 items-center justify-center rounded-pill border px-4 py-4 ${
                    answered === option ? 'border-heavy-fill bg-heavy-fill' : 'border-line-strong'
                  }`}
                >
                  <Text variant="caption" tone={answered === option ? 'inverse' : 'nightMuted'}>{option}</Text>
                </Pressable>
              ))}
              <View
                className={`min-h-min flex-1 items-center justify-center rounded-pill border px-4 py-4 ${
                  answered ? 'border-heavy-fill bg-heavy-fill' : 'border-line-strong'
                }`}
              >
                <Text variant="caption" tone={answered ? 'inverse' : 'nightMuted'}>Done</Text>
              </View>
            </Stack>
          </Stack>
        </View>

        {answered ? (
          <Text variant="footnote" tone="nightMuted" className="text-center" accessibilityLiveRegion="polite">
            {answered === 'Hard'
              ? `Noted. Your line is at ${liveCeiling(overallCeiling, dayReports)}% — report hard below it twice and it moves.`
              : 'Noted. That is the whole daily commitment.'}
          </Text>
        ) : (
          <Text variant="footnote" tone="nightMuted" className="text-center">
            That tap is the entire daily commitment.
          </Text>
        )}
      </Stack>
    </Screen>
  );
}
