import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';
import {
  Button, Card, Chip, DayTimeline, ForecastStrip, PageHeader, Screen, Section,
  Sticker, Stack, Text, TodoList,
} from '@/components';
import { threshold } from '@design/tokens';
import { SCREEN } from '@design/screens';
import { buildForecast, findCollision, leadLabel, speakForecast } from '@/lib/forecast';
import { bandFor } from '@/lib/load';
import { chargeOf } from '@/lib/battery';
import { dayHours, endHour, formatHour, freeSlots, slotHours } from '@/lib/schedule';
import { addDays, formatLong, formatShort, daysBetween } from '@/lib/dates';
import { successFeedback } from '@/lib/haptics';
import { openPrep, remaining } from '@/lib/prep';
import { nextWeek, useStore, weekReading } from '@/state/store';
import { useItemsWithLogs, useReading } from '@/state/selectors';
import { WEEK_NUMBER } from '@/data/seed';
import { clockHour, toMark } from '@/lib/marking';
import { MarkSheet } from '@/features/marking/MarkSheet';

const TONE = { steady: 'steady', busy: 'busy', heavy: 'heavy' } as const;

/**
 * Plan — the fortnight, and then one day of it in full.
 *
 * The strip alone was a picture: a fresh reader saw coloured bars and could not
 * say what was in them. Now it is a control. Tap a day and the rest of the screen
 * is that day, hour by hour, with its gaps open for adding to. The forecast still
 * does the thing only a forecast can — find the collision eight days out — but
 * you can now walk into any day and see exactly what it holds.
 */
export default function Plan() {
  const router = useRouter();
  const { ceilings, today, customFlags } = useStore();
  const items = useItemsWithLogs();

  // Arriving from Home's week strip opens straight onto that day.
  const params = useLocalSearchParams<{ day?: string }>();
  const [selected, setSelected] = useState(params.day ?? today);

  const days = buildForecast(items, today, ceilings);
  const collision = findCollision(items, today);
  const thisWeek = useReading();
  const next = weekReading(items, nextWeek(today), ceilings);

  const cluster = new Set(
    collision ? days.filter((d) => d.date >= collision.from && d.date <= collision.to).map((d) => d.date) : [],
  );
  const marked = days.map((day) => ({ ...day, inCluster: cluster.has(day.date) }));

  const hours = dayHours(items, selected);
  const free = freeSlots(items, selected, 1);
  const freeHours = Math.round(free.reduce((total, slot) => total + slotHours(slot), 0) * 10) / 10;
  const owing = openPrep(items, selected);
  const owingMeta = `${owing.length} · ${Math.round(owing.reduce((total, item) => total + remaining(item), 0) * 10) / 10}h to go`;
  const inWall = cluster.has(selected);
  const hour = clockHour(today);
  const due = selected === today ? toMark(items, today, hour) : [];
  const [marking, setMarking] = useState<string | null>(null);
  const away = daysBetween(today, selected);

  return (
    <Screen
      footer={
        collision ? (
          <Button label="Rebalance next week" onPress={() => router.push('/rebalance')} />
        ) : (
          <Button label="Add something" onPress={() => router.push(`/add?date=${selected}`)} />
        )
      }
    >
      <Stack gap={5} className="pt-4">
        <PageHeader
          {...SCREEN.plan}
          eyebrow={`Week ${WEEK_NUMBER} to ${WEEK_NUMBER + 2}`}
          title={`Next ${threshold.forecastDays} days`}
        />

        {/* The fortnight is a picker: tap a day and the panel below becomes it.
            The one warning sits with the strip, next to the days it is about. */}
        <Section family="week" title="Pick a day">
          <Card gap={4}>
            <ForecastStrip
              days={marked}
              spoken={speakForecast(marked, collision)}
              selected={selected}
              onSelect={setSelected}
            />
            <Stack direction="row" justify="between">
              <Text variant="footnote" weight="semibold" tone={TONE[bandFor(thisWeek.overall)]}>This week {chargeOf(thisWeek.overall)}%</Text>
              <Text variant="footnote" weight="semibold" tone={TONE[bandFor(next.overall)]}>Next {chargeOf(next.overall)}%</Text>
            </Stack>
          </Card>
          {collision ? (
            <Stack direction="row" gap={3} align="center" className="rounded-lg bg-heavy-wash px-4 py-3">
              <Sticker name="wall" size={30} />
              <Text variant="footnote" weight="semibold" tone="heavy" className="flex-1">{collision.headline}</Text>
              <Text variant="micro" tone="heavy">{leadLabel(collision.leadDays)}</Text>
            </Stack>
          ) : null}
        </Section>

        {/* The selected day, in full: what is booked, what is free, what is owed. */}
        <Section
          family="week"
          sticker="clock"
          title={away === 0 ? 'Today' : away === 1 ? 'Tomorrow' : formatLong(selected)}
          meta={away === 0 || away === 1 ? formatShort(selected) : `in ${away} days`}
        >
          <Stack direction="row" gap={2} wrap>
            <Chip label={`${hours.committed}h booked`} readOnly />
            <Chip label={`${freeHours}h free`} tone={freeHours > 3 ? 'steady' : 'busy'} readOnly />
            {due.length ? <Chip label={`⏳ ${due.length} to mark`} tone="busy" readOnly /> : null}
          </Stack>
          <DayTimeline
            items={items}
            date={selected}
            customFlags={customFlags}
            onSelect={(item) => setMarking(item.id)}
            onAddAt={(date, startHour) => router.push(`/add?date=${date}&start=${startHour}`)}
            clock={{ today, hour }}
            todoMeta={owingMeta}
            todo={
              <TodoList
                todo={openPrep(items, selected)}
                items={items}
                today={today}
                date={selected}
                onOpen={(item) => router.push(`/item/${item.id}`)}
              />
            }
          />
        </Section>

        <View className="h-2" />
      </Stack>
      <MarkSheet itemId={marking} onClose={() => setMarking(null)} />
    </Screen>
  );
}
