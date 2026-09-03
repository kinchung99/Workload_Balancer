import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Button, Card, Chip, Divider, Screen, Stack, Text } from '@/components';
import { BUCKET_LABEL } from '@/lib/load';
import { prescriptions } from '@/data/seed';
import { useStore, weekReading } from '@/state/store';
import { BUCKETS } from '@/lib/load';

/**
 * Screen 6 — Matched to the bucket that is empty.
 *
 * Social maxed gets solitary recovery. Mental maxed gets physical and
 * non-cognitive. A student drowning in coursework being told to "reach out to a
 * friend" is why these features get ignored.
 *
 * The whole library is free, under ninety minutes and within walking distance of
 * campus. Anything that needs money or a car is not recovery for most students,
 * it is another thing to organise.
 */
export default function Prescription() {
  const router = useRouter();
  const { items, ceilings, today } = useStore();
  const { percents } = weekReading(items, today, ceilings);

  const fullest = BUCKETS.reduce((a, b) => (percents[a] >= percents[b] ? a : b));
  const emptiest = BUCKETS.reduce((a, b) => (percents[a] <= percents[b] ? a : b));

  const [chosen, setChosen] = useState(prescriptions.find((p) => p.best) ?? prescriptions[0]);
  const rest = prescriptions.filter((p) => p.id !== chosen.id);

  return (
    <Screen
      footer={
        <>
          {/* c. Booked, with a time on it. An unscheduled suggestion is a
              suggestion you ignore, so every recommendation lands in the calendar
              as a real block and is then protected like everything else in there. */}
          <Button label="Put it in Thursday, 5pm" onPress={() => router.replace('/recover')} />
          <Button
            label="Show me something else"
            kind="secondary"
            onPress={() => setChosen(rest[0] ?? chosen)}
          />
        </>
      }
    >
      <Stack gap={5} className="pt-4">
        <Text variant="title" accessibilityRole="header">What would actually help</Text>

        {/* b. Matched to the bucket that is empty, not the one that is full. */}
        <Text variant="callout" tone="muted">
          {BUCKET_LABEL[fullest]} is full, {BUCKET_LABEL[emptiest].toLowerCase()} has room. So: out of the
          building, not thinking.
        </Text>

        <Card tone="recovery" gap={4}>
          <Chip label="Best fit today" tone="recovery" readOnly />
          <Stack gap={2}>
            <Text variant="title">{chosen.title}</Text>
            <Text variant="callout" tone="muted">{chosen.detail}</Text>
          </Stack>
          {chosen.tags ? (
            <Stack direction="row" gap={3} wrap>
              {chosen.tags.map((tag) => <Chip key={tag} label={tag} readOnly />)}
            </Stack>
          ) : null}
        </Card>

        <Card pad={0} gap={0} className="px-5">
          {rest.map((option, index) => (
            <Stack key={option.id}>
              {index > 0 ? <Divider /> : null}
              <Stack
                direction="row"
                gap={4}
                align="center"
                justify="between"
                className="min-h-row py-4"
                accessible
                accessibilityLabel={`${option.title}. ${option.detail}. Worth ${option.credit} hours of credit.`}
              >
                <Stack gap={2} grow>
                  <Text variant="body" weight="semibold">{option.title}</Text>
                  <Text variant="footnote" tone="subtle">{option.detail}</Text>
                </Stack>
                <Chip label={`+${option.credit}h`} tone="recovery" readOnly />
              </Stack>
            </Stack>
          ))}
        </Card>
      </Stack>
    </Screen>
  );
}
