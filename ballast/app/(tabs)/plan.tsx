import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';
import {
  Button, Card, Chip, CollisionWindow, DayTimeline, Divider, ForecastStrip, PageHeader, Reveal, Screen,
  Sticker, Stack, Text, TodoList,
} from '@/components';
import { threshold } from '@design/tokens';
import { SCREEN } from '@design/screens';
import { buildForecast, findCollision, leadLabel, speakForecast } from '@/lib/forecast';
import { isMovable, loadOf } from '@/lib/load';
import { chargeOf } from '@/lib/battery';
import { dayHours, endHour, formatHour, freeSlots, slotHours } from '@/lib/schedule';
import { addDays, formatLong, formatShort, daysBetween } from '@/lib/dates';
import { successFeedback } from '@/lib/haptics';
import { openPrep, remaining } from '@/lib/prep';
import { nextWeek, useStore, weekReading } from '@/state/store';
import { useItemsWithLogs, useReading } from '@/state/selectors';
import { WEEK_NUMBER } from '@/data/seed';

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
  const { ceilings, today, scheduleItem, scheduleSessions, pushSittings, completeSitting, logUnbookedHours,
    unscheduleSession, setSessionNote } = useStore();
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
  const away = daysBetween(today, selected);

  return (
    <Screen
      footer={
        collision ? (
          <>
            <Button label="Rebalance next week" onPress={() => router.push('/rebalance')} />
            <Text variant="footnote" tone="subtle" className="text-center">
              {collision.leadDays} days to move something. That is enough.
            </Text>
          </>
        ) : (
          <Button label="Add something" onPress={() => router.push(`/add?date=${selected}`)} />
        )
      }
    >
      <Stack gap={6} className="pt-4">
        <PageHeader
          {...SCREEN.plan}
          eyebrow={`Week ${WEEK_NUMBER} to ${WEEK_NUMBER + 2}`}
          title={`Next ${threshold.forecastDays} days`}
          sub="Tap any day to open it hour by hour."
        />

        <Card gap={5}>
          <ForecastStrip
            days={marked}
            spoken={speakForecast(marked, collision)}
            selected={selected}
            onSelect={setSelected}
          />
          <Divider />
          <Stack direction="row" justify="between">
            <Text variant="footnote" tone="muted">This week, {chargeOf(thisWeek.overall)}% left</Text>
            <Text variant="footnote" weight="semibold" tone="heavy">Next week, {chargeOf(next.overall)}%</Text>
          </Stack>
          <Text variant="micro" tone="subtle">Tap a day.</Text>
        </Card>

        {/* The selected day, in full. This is the part that was missing. */}
        <Stack gap={3}>
          <Stack direction="row" justify="between" align="center">
            <Stack gap={1}>
              <Text variant="heading" accessibilityRole="header">
                {away === 0 ? 'Today' : away === 1 ? 'Tomorrow' : formatLong(selected)}
              </Text>
              <Text variant="micro" tone="subtle">
                {away === 0 || away === 1 ? formatShort(selected) : `in ${away} days`}
              </Text>
            </Stack>
            <Stack direction="row" gap={2}>
              <Chip label={`${hours.committed}h booked`} readOnly />
              <Chip label={`${freeHours}h free`} tone={freeHours > 3 ? 'steady' : 'busy'} readOnly />
            </Stack>
          </Stack>

          {inWall ? (
            <Card tone="heavy" gap={2}>
              <Text variant="callout" weight="semibold" tone="heavy">Part of the wall.</Text>
            </Card>
          ) : null}

          <Card gap={4}>
            <DayTimeline
              items={items}
              date={selected}
              onSelect={(item) => router.push(`/decline/${item.id}`)}
              onSchedule={(item, startHour) => {
                scheduleItem(item.id, startHour);
                successFeedback();
              }}
              onAddAt={(date, startHour) => router.push(`/add?date=${date}&start=${startHour}`)}
              todoMeta={owingMeta}
              todo={
                <TodoList
                  todo={openPrep(items, selected)}
                  items={items}
                  today={today}
                  date={selected}
                  onSchedule={(item, startHour, hours, note) => {
                    scheduleSessions(item.id, [{ date: selected, startHour, hours, note }]);
                    successFeedback();
                  }}
                  onPlan={(item, sessions) => {
                    scheduleSessions(item.id, sessions, { replace: true });
                    successFeedback();
                  }}
                  onDefer={(item, to) => {
                    // The work moves; the deadline is not ours to move.
                    pushSittings(item.id, selected, to);
                    successFeedback();
                  }}
                  onDone={(sessionId) => { completeSitting(sessionId); successFeedback(); }}
                  onUnbooked={(item, hours) => { logUnbookedHours(item.id, hours); successFeedback(); }}
                  onUnschedule={(sessionId) => {
                    unscheduleSession(sessionId);
                    successFeedback();
                  }}
                  onNote={(sessionId, note) => setSessionNote(sessionId, note)}
                />
              }
            />
          </Card>
        </Stack>

        {/* Why this screen exists: clustering, found early enough to act on. */}
        {collision ? (
          <Stack gap={3}>
            <Text variant="micro" tone="subtle">THE COLLISION</Text>
            <Card tone="heavy" gap={5}>
              <Stack gap={3}>
                <Stack direction="row" gap={3} align="center" wrap>
                  <Chip label={leadLabel(collision.leadDays)} tone="heavy" readOnly />
                  <Chip label={`${collision.items.length} things`} tone="heavy" readOnly />
                  <Chip label="72 hours" tone="heavy" readOnly />
                </Stack>
                <Text variant="heading">{collision.headline}</Text>
                <Text variant="callout" tone="muted">{collision.detail}</Text>
              </Stack>

              <CollisionWindow
                collision={collision}
                days={[collision.from, addDays(collision.from, 1), collision.to]}
                onSelectItem={(item) => router.push(`/decline/${item.id}`)}
              />

              <Button label="Rebalance next week" onPress={() => router.push('/rebalance')} />
            </Card>
          </Stack>
        ) : (
          <Card gap={4}>
            <Stack direction="row" gap={4} align="center">
              <Sticker name="sun" size={48} />
              <Stack gap={1} grow>
                <Text variant="heading">Nothing is colliding.</Text>
                <Text variant="footnote" tone="muted">An ordinary two weeks.</Text>
              </Stack>
            </Stack>
          </Card>
        )}

        <Reveal label="When we notify you">
          <Text variant="footnote" tone="muted">
            One message, eight days out, only for a genuine collision. No daily digest, nothing at 11pm.
          </Text>
        </Reveal>
        <View className="h-2" />
      </Stack>
    </Screen>
  );
}
