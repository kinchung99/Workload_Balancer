import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import {
  AreaTile, Battery, Button, Card, Chip, DayTimeline, Divider, Screen, Stack, Text, WeekStrip,
} from '@/components';
import { CalmMode } from '@/features/home/CalmMode';
import { CHARGE_LABEL, CHARGE_NOTE, chargeOf, drains } from '@/lib/battery';
import { BUCKETS, BUCKET_LABEL, bandFor, isCalm } from '@/lib/load';
import { itemsOnDay, liveCeiling, restOwedFrom, useStore, weekReading } from '@/state/store';
import { useReading } from '@/state/selectors';
import { dayHours, freeSlots, slotHours, weekDays } from '@/lib/schedule';
import { findCollision, leadLabel } from '@/lib/forecast';
import { successFeedback } from '@/lib/haptics';
import { formatShort } from '@/lib/dates';
import { WEEK_NUMBER, prescriptions } from '@/data/seed';
import { useHydrated } from '@/hooks/useHydrated';

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
  const { items, ceilings, today, onboarded, recovery, booked, dayReports, overallCeiling,
    minimumViableWeek, showEverythingAnyway, setShowEverything, setMinimumViableWeek,
    scheduleItem } = useStore();

  // First run goes to the intro. Deliberately an effect rather than a <Redirect>:
  // every route is prerendered in Node with `onboarded` still false, and a
  // redirect at render time would bake one into the static HTML for everyone.
  const hydrated = useHydrated();
  useEffect(() => {
    if (hydrated && !onboarded) router.replace('/welcome');
  }, [hydrated, onboarded, router]);

  const { percents, overall } = useReading();
  const charge = chargeOf(overall);
  const band = bandFor(overall);
  const allToday = itemsOnDay(items, today);
  // Minimum viable week: everything but the things that genuinely matter is out
  // of sight until Sunday. Nothing is deleted, and one tap brings it all back.
  const todayItems = minimumViableWeek
    ? [...allToday].sort((a, b) => (b.commitment === 'hard' ? 1 : 0) - (a.commitment === 'hard' ? 1 : 0)).slice(0, 2)
    : allToday;
  const hidden = allToday.length - todayItems.length;
  // Your ceiling moves: two hard days below your line and the line comes down.
  const ceiling = liveCeiling(overallCeiling, dayReports);
  const days = weekDays(today);
  const collision = findCollision(items, today);
  const cluster = new Set(
    collision ? days.filter((d) => d >= collision.from && d <= collision.to) : [],
  );
  const hoursToday = dayHours(items, today);
  const freeToday = Math.round(freeSlots(items, today, 1).reduce((t, slot) => t + slotHours(slot), 0) * 10) / 10;
  const pulling = drains(percents).slice(0, 3);
  const unbooked = prescriptions.filter((entry) => !booked.includes(entry.id));
  const suggestion = unbooked.find((entry) => entry.best) ?? unbooked[0];
  const restOwed = restOwedFrom(recovery);

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
              segments={BUCKETS.map((bucket) => ({
                key: bucket,
                charge: chargeOf(percents[bucket]),
                loadPercent: percents[bucket],
              }))}
              label={`${charge} percent overall. ${CHARGE_LABEL[band]}. Made of ${BUCKETS.map((b) => `${BUCKET_LABEL[b]} ${chargeOf(percents[b])}%`).join(', ')}.`}
            />
            <Stack gap={1} grow>
              <Text variant="display" tone={TONE[band]}>{charge}%</Text>
              <Text variant="footnote" weight="semibold">{CHARGE_LABEL[band]}</Text>
              <Text variant="micro" tone="subtle">of your week left</Text>
              <Text variant="micro" tone="subtle">your line sits at {ceiling}%</Text>
            </Stack>
          </Stack>
          <Text variant="callout" tone="muted">{CHARGE_NOTE[band]}</Text>
          {/* Say what the number is, since the cells above are now visibly parts. */}
          <Stack direction="row" gap={2} justify="between">
            {BUCKETS.map((bucket) => (
              <Stack key={bucket} gap={1} align="center" className="flex-1">
                <Text variant="micro" tone="subtle">{BUCKET_LABEL[bucket].slice(0, 3)}</Text>
                <Text variant="micro" weight="semibold" tone={TONE[bandFor(percents[bucket])]}>
                  {chargeOf(percents[bucket])}
                </Text>
              </Stack>
            ))}
          </Stack>
          <Text variant="micro" tone="subtle">
            Your five areas, blended — the emptiest one counts for half.
          </Text>
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
                    accessibilityLabel={`${BUCKET_LABEL[row.bucket]}, ${row.cost}% of its limit used`}
                    onPress={() => router.push(`/areas/${row.bucket}`)}
                    className="min-h-row flex-row items-center justify-between gap-4 py-4 active:opacity-70"
                  >
                    <Stack gap={1} grow>
                      <Text variant="body" weight="semibold">{BUCKET_LABEL[row.bucket]}</Text>
                      <Text variant="footnote" tone="subtle">
                        {row.cost > 100 ? `over its limit by ${row.cost - 100}%` : `${row.cost}% of its limit used`}
                      </Text>
                    </Stack>
                    <Text variant="body" weight="semibold" tone={TONE[bandFor(row.cost)]}>{row.cost}%</Text>
                  </Pressable>
                </Stack>
              ))}
            </Card>
          </Stack>
        ) : null}

        {/* One thing, booked, with a time on it. Disappears once it is in. */}
        {suggestion ? (
          <Card tone="recovery" gap={4}>
            <Text variant="micro" tone="recovery">SUGGESTED FOR YOU</Text>
            <Stack gap={2}>
              <Text variant="heading">{suggestion.title}</Text>
              <Text variant="footnote" tone="muted">{suggestion.detail}</Text>
            </Stack>
            <Button label={`Put it in ${suggestion.slot}`} onPress={() => router.push('/prescription')} />
          </Card>
        ) : (
          <Card tone="steady" gap={2}>
            <Text variant="micro" tone="steady">RECOVERY BOOKED</Text>
            <Text variant="callout">All four blocks are in your week. Nothing left to schedule.</Text>
          </Card>
        )}

        {/* The rest of the week, which used to be invisible from here. */}
        <Stack gap={3}>
          <Stack direction="row" justify="between" align="center">
            <Text variant="micro" tone="subtle">THIS WEEK</Text>
            <Text variant="micro" tone="subtle">TAP A DAY</Text>
          </Stack>
          <Card gap={4}>
            <WeekStrip
              items={items}
              days={days}
              today={today}
              cluster={cluster}
              onSelect={(date) => router.push(`/plan?day=${date}`)}
            />
            {collision ? (
              <Stack direction="row" gap={3} align="center" className="rounded-sm bg-heavy-wash px-4 py-3">
                <View className="h-2 w-2 rounded-pill bg-heavy-fill" />
                <Text variant="footnote" tone="heavy" className="flex-1">
                  {collision.headline} {leadLabel(collision.leadDays).toLowerCase()}.
                </Text>
              </Stack>
            ) : null}
          </Card>
        </Stack>

        {/* When, not just what. Ordered by the clock, with the gaps left visible. */}
        <Stack gap={3}>
          <Stack direction="row" justify="between" align="center">
            <Text variant="micro" tone="subtle">TODAY · {formatShort(today).toUpperCase()}</Text>
            <Stack direction="row" gap={2}>
              <Chip label={`${hoursToday.committed}h booked`} readOnly />
              <Chip label={`${freeToday}h free`} tone={freeToday > 3 ? 'steady' : 'busy'} readOnly />
            </Stack>
          </Stack>
          <Card gap={4}>
            <DayTimeline
              items={minimumViableWeek ? todayItems : items}
              date={today}
              onSelect={(item) => router.push(`/decline/${item.id}`)}
              onSchedule={(item, startHour) => {
                scheduleItem(item.id, startHour);
                successFeedback();
              }}
              onAddAt={(date, startHour) => router.push(`/add?date=${date}&start=${startHour}`)}
            />
          </Card>
        </Stack>

        {hidden > 0 ? (
          <Card tone="sunken" gap={3}>
            <Stack gap={1}>
              <Text variant="callout" weight="semibold">Minimum viable week is on.</Text>
              <Text variant="footnote" tone="muted">
                {hidden} thing{hidden === 1 ? '' : 's'} hidden until Sunday. Nothing was deleted.
              </Text>
            </Stack>
            <Button label="Show everything again" kind="secondary" onPress={() => setMinimumViableWeek(false)} />
          </Card>
        ) : null}

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
