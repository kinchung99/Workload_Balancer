import { Pressable, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Bar, Card, Chip, Divider, Stack, Text } from '@/components';
import { color } from '@design/tokens';
import type { MealStatus } from '@/lib/types';
import { activity } from '@/data/seed';
import { useStore } from '@/state/store';

const NEXT: Record<MealStatus, MealStatus> = {
  pending: 'filling', filling: 'light', light: 'skipped', skipped: 'pending',
};

const STATUS_LABEL: Record<MealStatus, string> = {
  pending: 'Not yet', filling: 'Ate · Filling', light: 'Light snack', skipped: 'Skipped',
};

const STATUS_TONE = {
  pending: 'plain', filling: 'steady', light: 'busy', skipped: 'heavy',
} as const;

/** Physical — eating logged qualitatively, movement read passively. No calories. */
export function PhysicalArea() {
  const { meals, setMealStatus } = useStore();
  const stepRatio = Math.min(100, (activity.steps / activity.goal) * 100);

  return (
    <Stack gap={6}>
      <Card gap={4} align="center">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tap and describe what you ate"
          accessibilityHint="Dictates a meal instead of typing it"
          className="h-16 w-16 items-center justify-center rounded-pill bg-inverse active:opacity-80"
        >
          <Svg width={22} height={22} viewBox="0 0 22 22">
            <Path
              d="M11 3a2.5 2.5 0 0 1 2.5 2.5v5a2.5 2.5 0 0 1-5 0v-5A2.5 2.5 0 0 1 11 3zM5.5 10a5.5 5.5 0 0 0 11 0M11 15.5V19"
              stroke={color.ink.inverse} strokeWidth={1.8} fill="none" strokeLinecap="round"
            />
          </Svg>
        </Pressable>
        <Text variant="footnote" tone="subtle">Tap and describe what you ate</Text>
      </Card>

      <Stack gap={3}>
        <Text variant="micro" tone="subtle">TODAY'S MEALS</Text>
        <Card pad={0} gap={0} className="px-5">
          {meals.map((meal, index) => (
            <Stack key={meal.id}>
              {index > 0 ? <Divider /> : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${meal.label}, ${meal.at}, ${STATUS_LABEL[meal.status]}`}
                accessibilityHint="Cycles the status"
                onPress={() => setMealStatus(meal.id, NEXT[meal.status])}
                className="min-h-row flex-row items-center justify-between gap-4 py-4 active:opacity-70"
              >
                <Stack gap={1} grow>
                  <Text variant="body" weight="semibold">{meal.label}</Text>
                  <Text variant="footnote" tone="subtle">{meal.at}</Text>
                </Stack>
                <Chip label={STATUS_LABEL[meal.status]} tone={STATUS_TONE[meal.status]} readOnly />
              </Pressable>
            </Stack>
          ))}
        </Card>
      </Stack>

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
        Steps and sleep are read on-device, opt-in, and never leave the phone.
      </Text>
    </Stack>
  );
}
