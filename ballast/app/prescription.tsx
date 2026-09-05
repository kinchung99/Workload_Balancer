import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Battery, Button, Card, Chip, Divider, Screen, Stack, Text } from '@/components';
import { BUCKETS, BUCKET_LABEL } from '@/lib/load';
import { chargeOf } from '@/lib/battery';
import { successFeedback } from '@/lib/haptics';
import { prescriptions } from '@/data/seed';
import { restOwedFrom, useStore, weekReading } from '@/state/store';

/**
 * Matched to the area that still has room.
 *
 * Social maxed gets solitary recovery; mental maxed gets physical and
 * non-cognitive. A student drowning in coursework being told to "reach out to a
 * friend" is why these features get ignored.
 *
 * Booking is a real write: it puts a protected block in the week and credits the
 * ledger. An unscheduled suggestion is a suggestion you ignore.
 */
export default function Prescription() {
  const router = useRouter();
  const { items, ceilings, today, booked, recovery, bookRecovery } = useStore();
  const { percents } = weekReading(items, today, ceilings);

  const fullest = BUCKETS.reduce((a, b) => (percents[a] >= percents[b] ? a : b));
  const emptiest = BUCKETS.reduce((a, b) => (percents[a] <= percents[b] ? a : b));

  // Anything already in the calendar stops being offered.
  const available = prescriptions.filter((entry) => !booked.includes(entry.id));
  const [index, setIndex] = useState(0);
  const [justBooked, setJustBooked] = useState<string | null>(null);

  const chosen = available[index % Math.max(1, available.length)];
  const rest = available.filter((entry) => entry.id !== chosen?.id);

  if (justBooked) {
    const entry = prescriptions.find((p) => p.id === justBooked)!;
    return (
      <Screen
        back="/recover"
        backLabel="Recovery"
        footer={
          <>
            <Button label="See the ledger" onPress={() => router.replace('/recover')} />
            {available.length > 0 ? (
              <Button
                label="Book something else"
                kind="secondary"
                onPress={() => {
                  setJustBooked(null);
                  setIndex(0);
                }}
              />
            ) : null}
          </>
        }
      >
        <Stack gap={6} className="pt-8">
          <Text variant="micro" tone="steady">BOOKED</Text>
          <Text variant="title" accessibilityRole="header" accessibilityLiveRegion="polite">
            {entry.title}, {entry.slot}.
          </Text>
          <Card tone="steady" gap={3}>
            <Text variant="callout">
              It is in your calendar and protected, like everything else in there. Rebalancing moves work around
              it, never through it.
            </Text>
            <Text variant="footnote" tone="muted">
              +{entry.credit}h credited. You are now {restOwedFrom(recovery)}h down instead.
            </Text>
          </Card>
        </Stack>
      </Screen>
    );
  }

  if (!chosen) {
    return (
      <Screen back="/recover" backLabel="Recovery" footer={<Button label="Back to the ledger" onPress={() => router.replace('/recover')} />}>
        <Stack gap={5} className="pt-8">
          <Text variant="title" accessibilityRole="header">Everything is booked.</Text>
          <Text variant="callout" tone="muted">
            All four blocks are in your week. Nothing left to schedule — go and do one.
          </Text>
        </Stack>
      </Screen>
    );
  }

  return (
    <Screen
      back="/recover"
      backLabel="Recovery"
      footer={
        <>
          <Button
            label={`Put it in ${chosen.slot}`}
            onPress={() => {
              bookRecovery(chosen, chosen.slot);
              successFeedback();
              setJustBooked(chosen.id);
            }}
          />
          {rest.length > 0 ? (
            <Button label="Show me something else" kind="secondary" onPress={() => setIndex((i) => i + 1)} />
          ) : null}
        </>
      }
    >
      <Stack gap={5} className="pt-4">
        <Text variant="title" accessibilityRole="header">What would actually help</Text>

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

        {rest.length > 0 ? (
          <Card pad={0} gap={0} className="px-5">
            {rest.map((option, position) => (
              <Stack key={option.id}>
                {position > 0 ? <Divider /> : null}
                <Stack
                  direction="row" gap={4} align="center" justify="between" className="min-h-row py-4"
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
        ) : null}

        {booked.length > 0 ? (
          <Text variant="footnote" tone="subtle">
            {booked.length} already booked this week.
          </Text>
        ) : null}
      </Stack>
    </Screen>
  );
}
