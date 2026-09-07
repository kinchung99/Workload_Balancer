import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';
import {
  Button, Card, Chip, CollisionWindow, DayTimeline, Divider, ForecastStrip, Screen, Stack, Text, TodoList,
} from '@/components';
import { threshold } from '@design/tokens';
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
  const { ceilings, today, scheduleItem, scheduleSessions, moveItem, setProgressPercent, unscheduleSession,
    setSessionNote } = useStore();
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
        <Stack direction="row" justify="between" align="center">
          <Text variant="title" accessibilityRole="header">Next {threshold.forecastDays} days</Text>
          <Text variant="footnote" tone="subtle">Week {WEEK_NUMBER} to {WEEK_NUMBER + 2}</Text>
        </Stack>

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
          <Text variant="micro" tone="subtle">Tap any day to see it hour by hour.</Text>
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
              <Text variant="callout" weight="semibold" tone="heavy">This day is part of the wall.</Text>
              <Text variant="footnote" tone="muted">{collision?.detail}</Text>
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
                    moveItem(item.id, to);
                    successFeedback();
                  }}
                  onSetPercent={(item, percent) => {
                    setProgressPercent(item.id, percent);
                    successFeedback();
                  }}
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
          <Card gap={2}>
            <Text variant="heading">Nothing is colliding.</Text>
            <Text variant="callout" tone="muted">An ordinary two weeks.</Text>
          </Card>
        )}

        <Text variant="footnote" tone="subtle">
          One notification, eight days out. Nothing at 11pm.
        </Text>
        <View className="h-2" />
      </Stack>
    </Screen>
  );
}
