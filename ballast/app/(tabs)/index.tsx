import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import {
  AreaTile, Battery, Button, Card, Divider, ItemRow, Screen, Stack, Text,
} from '@/components';
import { CalmMode } from '@/features/home/CalmMode';
import { CHARGE_LABEL, CHARGE_NOTE, chargeOf, drains } from '@/lib/battery';
import { BUCKETS, BUCKET_LABEL, bandFor, isCalm } from '@/lib/load';
import { itemsOnDay, useStore, weekReading } from '@/state/store';
import { WEEK_NUMBER, prescriptions, recoveryLedger } from '@/data/seed';

const TONE = { steady: 'steady', busy: 'busy', heavy: 'heavy' } as const;

const greeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

/**
 * Home — one battery, then the part of you that is empty.
 *
 * Answers "am I fine?" in under two seconds, and "which part of me isn't?"
 * immediately below. No streak, no score out of ten, no badge: a heavy week is
 * information, not a failure.
 */
export default function Home() {
  const router = useRouter();
  const { items, ceilings, today, showEverythingAnyway, setShowEverything, setMinimumViableWeek } = useStore();

  const { percents, overall } = weekReading(items, today, ceilings);
  const charge = chargeOf(overall);
  const band = bandFor(overall);
  const todayItems = itemsOnDay(items, today);
  const pulling = drains(percents).slice(0, 3);
  const suggestion = prescriptions.find((entry) => entry.best) ?? prescriptions[0];
  const restOwed = Math.abs(recoveryLedger.reduce((total, row) => total + (row.hours ?? 0), 0));

  if (isCalm(overall) && !showEverythingAnyway) {
    return (
      <CalmMode
        percent={overall}
        today={today}
        focus={todayItems[0] ?? items[0]}
        onHide={() => setMinimumViableWeek(true)}
        onShowEverything={() => setShowEverything(true)}
      />
    );
  }

  return (
    <Screen footer={<Button label="Add anything" onPress={() => router.push('/add')} />}>
      <Stack gap={6} className="pt-4">
        <Stack gap={1}>
          <Text variant="micro" tone="subtle">{greeting().toUpperCase()}, AMIRA</Text>
          <Text variant="title" accessibilityRole="header">Week {WEEK_NUMBER}</Text>
        </Stack>

        {/* The battery. Same number as the load model, friendlier end of it. */}
        <Card tone={band} gap={5}>
          <Stack direction="row" gap={5} align="center">
            <Battery
              charge={charge}
              loadPercent={overall}
              width={150}
              height={74}
              label={`${charge} percent charge. ${CHARGE_LABEL[band]}.`}
            />
            <Stack gap={1} grow>
              <Text variant="display" tone={TONE[band]}>{charge}%</Text>
              <Text variant="footnote" weight="semibold">{CHARGE_LABEL[band]}</Text>
            </Stack>
          </Stack>
          <Text variant="callout" tone="muted">{CHARGE_NOTE[band]}</Text>
        </Card>

        {/* Five areas, five batteries. Shape beats total. */}
        <Stack gap={3}>
          <Text variant="micro" tone="subtle">YOUR AREAS</Text>
          <Stack direction="row" gap={2}>
            {BUCKETS.map((bucket) => (
              <AreaTile
                key={bucket}
                bucket={bucket}
                percent={percents[bucket]}
                band={bandFor(percents[bucket])}
                hint=""
                onPress={() => router.push(`/areas/${bucket}`)}
              />
            ))}
          </Stack>
        </Stack>

        {/* What's pulling you down, ranked. */}
        {pulling.length > 0 ? (
          <Stack gap={3}>
            <Text variant="micro" tone="subtle">WHAT'S PULLING YOU DOWN</Text>
            <Card pad={0} gap={0} className="px-5">
              {pulling.map((row, index) => (
                <Stack key={row.bucket}>
                  {index > 0 ? <Divider /> : null}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${BUCKET_LABEL[row.bucket]}, ${row.cost}% of its ceiling`}
                    onPress={() => router.push(`/areas/${row.bucket}`)}
                    className="min-h-row flex-row items-center justify-between gap-4 py-4 active:opacity-70"
                  >
                    <Text variant="body" weight="semibold">{BUCKET_LABEL[row.bucket]}</Text>
                    <Text variant="body" weight="semibold" tone={TONE[bandFor(row.cost)]}>−{row.cost}%</Text>
                  </Pressable>
                </Stack>
              ))}
            </Card>
          </Stack>
        ) : null}

        {/* One thing, booked, with a time on it. */}
        <Card tone="recovery" gap={4}>
          <Text variant="micro" tone="recovery">SUGGESTED FOR YOU</Text>
          <Stack gap={2}>
            <Text variant="heading">{suggestion.title}</Text>
            <Text variant="footnote" tone="muted">{suggestion.detail}</Text>
          </Stack>
          <Button label="Start now" kind="primary" onPress={() => router.push('/prescription')} />
        </Card>

        <Stack gap={3}>
          <Stack direction="row" justify="between" align="center">
            <Text variant="micro" tone="subtle">TODAY</Text>
            <Text variant="micro" tone="subtle">{todayItems.length} THINGS</Text>
          </Stack>
          <Card pad={0} gap={0} className="px-5">
            {todayItems.map((item, index) => (
              <Stack key={item.id}>
                {index > 0 ? <Divider /> : null}
                <ItemRow item={item} onPress={() => router.push(`/decline/${item.id}`)} />
              </Stack>
            ))}
          </Card>
        </Stack>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${restOwed} hours of rest owed. Opens the recovery ledger.`}
          onPress={() => router.push('/recover')}
          className="active:opacity-70"
        >
          <Card tone="sunken" gap={2}>
            <Stack direction="row" justify="between" align="center">
              <Text variant="callout" weight="semibold">{restOwed}h of rest owed</Text>
              <Text variant="footnote" tone="subtle">Ledger →</Text>
            </Stack>
          </Card>
        </Pressable>

        <View className="h-4" />
      </Stack>
    </Screen>
  );
}
