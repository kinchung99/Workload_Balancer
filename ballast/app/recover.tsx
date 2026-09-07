import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { Button, Card, Chip, Divider, Screen, Stack, Text } from '@/components';
import { DEFICIT_DAYS } from '@/data/seed';
import { restOwedFrom, useStore } from '@/state/store';

/**
 * Rest is a credit you are owed.
 *
 * The ledger was one flat list, so a debt and a credit looked identical and the
 * balance came from nowhere. It is split now: what you are down, what you have
 * banked, and the one line that tends to stop people. Every row carries a bar
 * scaled against the largest, so the shape of the debt is visible rather than
 * having to be read off four numbers.
 */
export default function Recover() {
  const router = useRouter();
  const { recovery, booked } = useStore();

  const balance = recovery.reduce((total, row) => total + (row.hours ?? 0), 0);
  const inDeficit = balance < 0;

  const owed = recovery.filter((row) => (row.hours ?? 0) < 0);
  const banked = recovery.filter((row) => (row.hours ?? 0) > 0);
  const notes = recovery.filter((row) => row.hours === null);
  const worst = Math.max(...recovery.map((row) => Math.abs(row.hours ?? 0)), 1);

  const section = (
    title: string,
    rows: typeof recovery,
    tone: 'heavy' | 'steady',
  ) =>
    rows.length ? (
      <Stack gap={3}>
        <Stack direction="row" justify="between" align="center">
          <Text variant="micro" tone="subtle">{title}</Text>
          <Text variant="micro" tone={tone}>
            {tone === 'heavy' ? '−' : '+'}
            {Math.abs(rows.reduce((t, r) => t + (r.hours ?? 0), 0))}h
          </Text>
        </Stack>
        <Card pad={0} gap={0} className="px-5">
          {rows.map((row, index) => (
            <Stack key={row.id}>
              {index > 0 ? <Divider /> : null}
              <Stack
                gap={3}
                className="py-4"
                accessible
                accessibilityLabel={`${row.label}. ${row.detail}. ${Math.abs(row.hours ?? 0)} hours ${tone === 'heavy' ? 'down' : 'banked'}.`}
              >
                <Stack direction="row" gap={4} align="center" justify="between">
                  <Stack gap={1} grow>
                    <Text variant="body" weight="semibold">{row.label}</Text>
                    <Text variant="footnote" tone="subtle">{row.detail}</Text>
                  </Stack>
                  <Text variant="heading" tone={tone}>
                    {tone === 'heavy' ? '−' : '+'}{Math.abs(row.hours ?? 0)}h
                  </Text>
                </Stack>
                {/* Each row against the biggest, so the shape is visible. */}
                <View className="h-2 w-full overflow-hidden rounded-pill bg-track">
                  <View
                    className={`h-2 rounded-pill ${tone === 'heavy' ? 'bg-heavy-fill' : 'bg-steady-fill'}`}
                    style={{ width: `${(Math.abs(row.hours ?? 0) / worst) * 100}%` }}
                  />
                </View>
              </Stack>
            </Stack>
          ))}
        </Card>
      </Stack>
    ) : null;

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
      <Stack gap={6} className="pt-4">
        <Text variant="title" accessibilityRole="header">Recovery</Text>

        <Card tone={inDeficit ? 'recovery' : 'steady'} gap={4}>
          <Stack direction="row" justify="between" align="center">
            <Text variant="micro" tone={inDeficit ? 'recovery' : 'steady'}>BALANCE, LAST 14 DAYS</Text>
            {booked.length > 0 ? <Chip label={`${booked.length} booked`} tone="steady" readOnly /> : null}
          </Stack>
          <Text
            variant="hero"
            tone="recovery"
            accessibilityLiveRegion="polite"
            accessibilityLabel={`${restOwedFrom(recovery)} hours ${inDeficit ? 'down' : 'up'}`}
          >
            {inDeficit ? '−' : '+'}{restOwedFrom(recovery)}h
          </Text>
          {/* Owed against banked, as one bar, so the balance is not just a number. */}
          <Stack gap={2}>
            <View className="h-3 w-full flex-row overflow-hidden rounded-pill bg-track">
              <View
                className="h-3 bg-heavy-fill"
                style={{ flexGrow: Math.abs(owed.reduce((t, r) => t + (r.hours ?? 0), 0)) || 1 }}
              />
              <View
                className="h-3 bg-steady-fill"
                style={{ flexGrow: banked.reduce((t, r) => t + (r.hours ?? 0), 0) || 0.001 }}
              />
            </View>
            <Stack direction="row" justify="between">
              <Text variant="micro" tone="heavy">owed</Text>
              <Text variant="micro" tone="steady">banked</Text>
            </Stack>
          </Stack>
          <Text variant="callout" tone="muted">
            {inDeficit
              ? `In deficit for ${DEFICIT_DAYS} days straight.`
              : 'Back in credit — the first time in three weeks.'}
          </Text>
        </Card>

        {section("WHAT YOU'RE DOWN", owed, 'heavy')}
        {section("WHAT YOU'VE BANKED", banked, 'steady')}

        {notes.map((row) => (
          <Card key={row.id} tone="sunken" gap={2}>
            <Text variant="micro" tone="subtle">{row.label.toUpperCase()}</Text>
            <Text variant="heading">{row.detail}</Text>
          </Card>
        ))}

        <Card tone="sunken" gap={2}>
          <Text variant="footnote" tone="muted">Sleep and step data stay on your phone.</Text>
          <Text variant="footnote" tone="subtle">A workload tool, not a clinical one. No diagnosis, no score.</Text>
        </Card>
      </Stack>
    </Screen>
  );
}
