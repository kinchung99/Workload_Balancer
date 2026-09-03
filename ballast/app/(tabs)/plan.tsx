import { useRouter } from 'expo-router';
import { View } from 'react-native';
import {
  Button, Card, Chip, Divider, ForecastStrip, Screen, Stack, Text,
} from '@/components';
import { threshold } from '@design/tokens';
import { buildForecast, findCollision, leadLabel, speakForecast } from '@/lib/forecast';
import { isMovable, loadOf } from '@/lib/load';
import { chargeOf } from '@/lib/battery';
import { formatShort } from '@/lib/dates';
import { nextWeek, useStore, weekReading } from '@/state/store';
import { WEEK_NUMBER } from '@/data/seed';

/**
 * Screen 3 — The only screen that can prevent anything.
 *
 * Everything else in this app describes a week. This one arrives early enough to
 * change it.
 */
export default function Plan() {
  const router = useRouter();
  const { items, ceilings, today } = useStore();

  const days = buildForecast(items, today, ceilings);
  const collision = findCollision(items, today);
  const thisWeek = weekReading(items, today, ceilings);
  const next = weekReading(items, nextWeek(today), ceilings);

  const cluster = new Set(collision ? days.filter((d) => d.date >= collision.from && d.date <= collision.to).map((d) => d.date) : []);
  const marked = days.map((day) => ({ ...day, inCluster: cluster.has(day.date) }));

  return (
    <Screen
      footer={
        collision ? (
          <>
            {/* c. Eight days is an actionable warning. Long enough to email a tutor,
                swap a shift or move a self-imposed deadline. The push notification
                a student gets the night before is not a warning, it is a
                commiseration. */}
            <Button label="Rebalance next week" onPress={() => router.push('/rebalance')} />
            <Text variant="footnote" tone="subtle" className="text-center">
              {collision.leadDays} days to move something. That is enough.
            </Text>
          </>
        ) : null
      }
    >
      <Stack gap={5} className="pt-4">
        <Stack direction="row" justify="between" align="center">
          <Text variant="title" accessibilityRole="header">Next {threshold.forecastDays} days</Text>
          <Text variant="footnote" tone="subtle">Week {WEEK_NUMBER} to {WEEK_NUMBER + 2}</Text>
        </Stack>

        {/* a. Fourteen days, at a glance. Read as a weather strip rather than a
            calendar - a student does not need the detail to see that the middle
            of next week is a different colour from everything around it. */}
        <Card gap={5}>
          <ForecastStrip days={marked} spoken={speakForecast(marked, collision)} />
          <Divider />
          <Stack direction="row" justify="between">
            <Text variant="footnote" tone="muted">This week, {chargeOf(thisWeek.overall)}% left</Text>
            <Text variant="footnote" weight="semibold" tone="heavy">Next week, {chargeOf(next.overall)}%</Text>
          </Stack>
        </Card>

        {/* b. We flag clustering, not totals. */}
        {collision ? (
          <Card tone="heavy" gap={5}>
            <Stack gap={4} align="start">
              <Chip label={leadLabel(collision.leadDays)} tone="heavy" readOnly />
              <Text variant="heading">{collision.headline}</Text>
              <Text variant="callout" tone="muted">{collision.detail}</Text>
            </Stack>

            <Stack gap={0}>
              {collision.items.map((item, index) => (
                <Stack key={item.id}>
                  {index > 0 ? <Divider /> : null}
                  <Stack direction="row" gap={4} align="center" justify="between" className="min-h-row py-4">
                    <Stack gap={2} grow>
                      <Text variant="body" weight="semibold">{item.title}</Text>
                      <Text variant="footnote" tone="subtle">
                        {item.when ?? formatShort(item.date)}, {loadOf(item)} load
                      </Text>
                    </Stack>
                    {/* Hard deadlines are labelled as such everywhere, so the
                        student never has to check whether a suggestion is safe. */}
                    <Chip
                      label={isMovable(item) ? 'Movable' : 'Hard'}
                      tone={isMovable(item) ? 'steady' : 'plain'}
                      readOnly
                    />
                  </Stack>
                </Stack>
              ))}
            </Stack>
          </Card>
        ) : (
          <Card gap={2}>
            <Text variant="heading">Nothing is colliding.</Text>
            <Text variant="callout" tone="muted">An ordinary two weeks.</Text>
          </Card>
        )}

        <Text variant="footnote" tone="subtle">
          One notification, eight days out. Nothing at 11pm.
        </Text>
      </Stack>
    </Screen>
  );
}
