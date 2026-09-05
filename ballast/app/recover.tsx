import { useRouter } from 'expo-router';
import { Button, Card, Chip, Divider, Screen, Stack, Text } from '@/components';
import { DEFICIT_DAYS } from '@/data/seed';
import { restOwedFrom, useStore } from '@/state/store';

/**
 * Screen 5 — Rest is a credit you are owed.
 *
 * Most apps treat rest as the absence of work, which is why their suggestions
 * read as permission slips. Ballast counts recovery in the same units as load
 * and carries the balance forward, so a student can see the debt rather than
 * just feel it.
 */
export default function Recover() {
  const router = useRouter();
  // The live ledger, not the seed constant: booking recovery writes into this.
  const { recovery, booked } = useStore();
  const balance = recovery.reduce((total, row) => total + (row.hours ?? 0), 0);
  const inDeficit = balance < 0;

  return (
    <Screen
      back="/"
      backLabel="Home"
      footer={
        <Button
          label={booked.length > 0 ? 'Book more recovery' : 'What would actually help'}
          onPress={() => router.push('/prescription')}
        />
      }
    >
      <Stack gap={5} className="pt-4">
        <Text variant="title" accessibilityRole="header">Recovery</Text>

        {/* a. A number for the thing nobody counts. "Last full day off, twenty-three
            days ago" is the line that tends to stop people. */}
        <Card tone="recovery" gap={3}>
          <Text variant="footnote" tone="recovery">Balance, last 14 days</Text>
          <Text
            variant="display"
            tone="recovery"
            accessibilityLiveRegion="polite"
            accessibilityLabel={`${restOwedFrom(recovery)} hours ${inDeficit ? 'down' : 'up'}`}
          >
            {inDeficit ? '−' : '+'}{restOwedFrom(recovery)}h
          </Text>
          <Text variant="callout" tone="muted">
            {inDeficit
              ? `You have been in deficit for ${DEFICIT_DAYS} days straight.`
              : 'You are back in credit. That is the first time in three weeks.'}
          </Text>
        </Card>

        <Card pad={0} gap={0} className="px-5">
          {recovery.map((row, index) => (
            <Stack key={row.id}>
              {index > 0 ? <Divider /> : null}
              <Stack
                direction="row"
                gap={4}
                align="center"
                justify="between"
                className="min-h-row py-4"
                accessible
                accessibilityLabel={`${row.label}. ${row.detail}. ${row.hours === null ? '' : `${row.hours} hours.`}`}
              >
                <Stack gap={2} grow>
                  <Text variant="body" weight="semibold">{row.label}</Text>
                  <Text variant="footnote" tone="subtle">{row.detail}</Text>
                </Stack>
                <Chip
                  label={row.hours === null ? '—' : `${row.hours > 0 ? '+' : '−'}${Math.abs(row.hours)}h`}
                  tone={row.hours === null ? 'plain' : row.hours > 0 ? 'steady' : 'heavy'}
                  readOnly
                />
              </Stack>
            </Stack>
          ))}
        </Card>

        {/* Passive signals, on device. Opt-in, and the data never leaves the phone. */}
        <Card tone="sunken" gap={2}>
          <Text variant="footnote" tone="muted">Sleep and step data stay on your phone.</Text>
          <Text variant="footnote" tone="subtle">
            A workload tool, not a clinical one. No diagnosis, no score.
          </Text>
        </Card>
      </Stack>
    </Screen>
  );
}
