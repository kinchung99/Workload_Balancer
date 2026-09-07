import { Pressable, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Bar, Battery, Card, Chip, Divider, Stack, Text } from '@/components';
import { color } from '@design/tokens';
import { SLEEP_TARGET, logItems } from '@/lib/logs';
import { chargeOf } from '@/lib/battery';
import { bandFor } from '@/lib/load';
import { successFeedback } from '@/lib/haptics';
import type { MealStatus } from '@/lib/types';
import { activity } from '@/data/seed';
import { useStore } from '@/state/store';
import { readingFrom, useReading } from '@/state/selectors';

const SLEEP_OPTIONS = [4, 5, 6, 7, 8, 9];

const NEXT: Record<MealStatus, MealStatus> = {
  pending: 'filling', filling: 'light', light: 'skipped', skipped: 'pending',
};
const STATUS_LABEL: Record<MealStatus, string> = {
  pending: 'Not yet', filling: 'Ate · Filling', light: 'Light snack', skipped: 'Skipped',
};
const STATUS_TONE = { pending: 'plain', filling: 'steady', light: 'busy', skipped: 'heavy' } as const;
const TONE = { steady: 'steady', busy: 'busy', heavy: 'heavy' } as const;

/**
 * Physical — logged on waking and after eating, and the battery moves as you do
 * it. Nothing here is a calorie or a diagnosis: a night and a meal are recorded
 * qualitatively, and what they cost or return shows immediately.
 */
export function PhysicalArea() {
  const { items, ceilings, today, meals, moods, sleepHours, setMealStatus, logSleep } = useStore();
  const reading = useReading();

  /** What the battery would read if this were logged. Shown before you tap. */
  const preview = (next: { sleepHours?: number; meals?: typeof meals }) =>
    readingFrom(
      [...items, ...logItems({
        today,
        sleepHours: next.sleepHours ?? sleepHours,
        meals: next.meals ?? meals,
        moods,
      })],
      today,
      ceilings,
    ).charge;

  const stepRatio = Math.min(100, (activity.steps / activity.goal) * 100);

  return (
    <Stack gap={6}>
      {/* Waking up: one tap, and the number in front of you changes. */}
      <Stack gap={3}>
        <Text variant="micro" tone="subtle">HOW DID YOU SLEEP?</Text>
        <Card gap={5}>
          <Stack direction="row" gap={3} wrap>
            {SLEEP_OPTIONS.map((hours) => {
              const after = preview({ sleepHours: hours });
              const move = after - reading.charge;
              return (
                <Pressable
                  key={hours}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: sleepHours === hours }}
                  accessibilityLabel={`${hours} hours of sleep. Would put you at ${after} percent.`}
                  onPress={() => {
                    logSleep(hours);
                    successFeedback();
                  }}
                  className={`min-h-min flex-1 items-center justify-center gap-1 rounded-md border px-3 py-4 ${
                    sleepHours === hours ? 'border-steady-fill bg-steady-wash' : 'border-line-hairline'
                  }`}
                >
                  <Text variant="body" weight="semibold">{hours}h</Text>
                  <Text variant="micro" tone={move > 0 ? 'steady' : move < 0 ? 'heavy' : 'subtle'}>
                    {move > 0 ? `+${move}` : move < 0 ? move : '—'}
                  </Text>
                </Pressable>
              );
            })}
          </Stack>

          {sleepHours !== null ? (
            <Stack direction="row" gap={4} align="center" accessibilityLiveRegion="polite">
              <Battery
                charge={reading.charge}
                loadPercent={reading.overall}
                width={90}
                height={44}
                label={`Now at ${reading.charge} percent`}
              />
              <Stack gap={1} grow>
                <Text variant="heading" tone={TONE[bandFor(reading.overall)]}>{reading.charge}%</Text>
                <Text variant="micro" tone="subtle">
                  {sleepHours >= SLEEP_TARGET
                    ? `${sleepHours}h — that is a full night`
                    : `${sleepHours}h — ${Math.round((SLEEP_TARGET - sleepHours) * 10) / 10}h under your target`}
                </Text>
              </Stack>
            </Stack>
          ) : (
            <Text variant="footnote" tone="subtle">
              Nothing is assumed until you tap. Each option shows what it would do first.
            </Text>
          )}
        </Card>
      </Stack>

      {/* Eating: same idea, one tap per meal, cycling through four states. */}
      <Stack gap={3}>
        <Text variant="micro" tone="subtle">TODAY'S MEALS</Text>
        <Card pad={0} gap={0} className="px-5">
          {meals.map((meal, index) => {
            const nextStatus = NEXT[meal.status];
            const after = preview({ meals: meals.map((m) => (m.id === meal.id ? { ...m, status: nextStatus } : m)) });
            const move = after - reading.charge;
            return (
              <Stack key={meal.id}>
                {index > 0 ? <Divider /> : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${meal.label}, ${meal.at}, ${STATUS_LABEL[meal.status]}. Tap for ${STATUS_LABEL[nextStatus]}.`}
                  onPress={() => {
                    setMealStatus(meal.id, nextStatus);
                    successFeedback();
                  }}
                  className="min-h-row flex-row items-center justify-between gap-4 py-4 active:opacity-70"
                >
                  <Stack gap={1} grow>
                    <Text variant="body" weight="semibold">{meal.label}</Text>
                    <Text variant="footnote" tone="subtle">
                      {meal.at}
                      {move !== 0 ? ` · tap for ${move > 0 ? '+' : ''}${move}%` : ''}
                    </Text>
                  </Stack>
                  <Chip label={STATUS_LABEL[meal.status]} tone={STATUS_TONE[meal.status]} readOnly />
                </Pressable>
              </Stack>
            );
          })}
        </Card>
      </Stack>

      <Card gap={4} align="center">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tap and describe what you ate"
          className="h-14 w-14 items-center justify-center rounded-pill bg-inverse active:opacity-80"
        >
          <Svg width={20} height={20} viewBox="0 0 22 22">
            <Path
              d="M11 3a2.5 2.5 0 0 1 2.5 2.5v5a2.5 2.5 0 0 1-5 0v-5A2.5 2.5 0 0 1 11 3zM5.5 10a5.5 5.5 0 0 0 11 0M11 15.5V19"
              stroke={color.ink.inverse} strokeWidth={1.8} fill="none" strokeLinecap="round"
            />
          </Svg>
        </Pressable>
        <Text variant="footnote" tone="subtle">Or describe it out loud</Text>
      </Card>

      <Stack gap={3}>
        <Text variant="micro" tone="subtle">ACTIVITY TODAY</Text>
        <Card gap={4}>
          <Stack direction="row" justify="between" align="end">
            <Text variant="title">{activity.steps.toLocaleString()}</Text>
            <Text variant="footnote" tone="steady">{activity.activeMinutes} active min</Text>
          </Stack>
          <Bar band="steady" percent={stepRatio} />
          <Stack direction="row" justify="between">
            <Text variant="micro" tone="subtle">steps today</Text>
            <Text variant="micro" tone="subtle">goal {activity.goal.toLocaleString()}</Text>
          </Stack>
        </Card>
      </Stack>

      <Text variant="footnote" tone="subtle">
        Steps are read on-device, opt-in, and never leave the phone.
      </Text>
    </Stack>
  );
}
