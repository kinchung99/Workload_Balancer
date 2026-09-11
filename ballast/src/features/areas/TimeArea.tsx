import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, Chip, DayTimeline, Reveal, Stack, Text, WeekGrid } from '@/components';
import { color } from '@design/tokens';
import { DAY_LETTER, dayIndex, formatShort } from '@/lib/dates';
import { dayHours, freeSlots, slotHours, weekDays } from '@/lib/schedule';
import { successFeedback } from '@/lib/haptics';
import { useStore } from '@/state/store';

/** Time — where the hours actually go, and what is left between them. */
export function TimeArea() {
  const router = useRouter();
  const { items, today, scheduleItem } = useStore();
  const days = weekDays(today);
  const [selected, setSelected] = useState(today);

  const week = days.reduce(
    (total, date) => {
      const day = dayHours(items, date);
      return { committed: total.committed + day.committed, recovery: total.recovery + day.recovery };
    },
    { committed: 0, recovery: 0 },
  );
  const day = dayHours(items, selected);
  const free = freeSlots(items, selected, 1);
  const freeHours = Math.round(free.reduce((total, slot) => total + slotHours(slot), 0) * 10) / 10;

  return (
    <Stack gap={6}>
      <Button label="Your timetable" onPress={() => router.push('/timetable')} />

      <Card gap={4}>
        <Text variant="micro" tone="subtle">THIS WEEK</Text>
        <Stack direction="row" gap={5}>
          <Stack gap={1} grow>
            <Text variant="title">{Math.round(week.committed)}</Text>
            <Text variant="micro" tone="subtle">HRS COMMITTED</Text>
          </Stack>
          <View className="w-px bg-line-hairline" />
          <Stack gap={1} grow>
            <Text variant="title" tone="steady">{week.recovery}</Text>
            <Text variant="micro" tone="subtle">HRS RECOVERY</Text>
          </Stack>
        </Stack>
      </Card>

      <Card gap={5}>
        <WeekGrid items={items} days={days} todayDate={today} onSelectDay={setSelected} />
        <Stack direction="row" gap={4} wrap>
          <Stack direction="row" gap={2} align="center">
            <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: color.band.busy.wash, borderWidth: 1, borderColor: color.band.busy.fill }} />
            <Text variant="micro" tone="subtle">Committed</Text>
          </Stack>
          <Stack direction="row" gap={2} align="center">
            <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: color.band.steady.wash, borderWidth: 1, borderColor: color.band.steady.fill }} />
            <Text variant="micro" tone="subtle">Protected recovery</Text>
          </Stack>

        </Stack>
      </Card>

      {/* Tap a day letter above; this is that day, hour by hour. */}
      <Stack gap={3}>
        <Stack direction="row" justify="between" align="center">
          <Text variant="micro" tone="subtle">{formatShort(selected).toUpperCase()}</Text>
          <Stack direction="row" gap={2}>
            <Chip label={`${day.committed}h committed`} readOnly />
            <Chip label={`${freeHours}h free`} tone={freeHours > 3 ? 'steady' : 'busy'} readOnly />
          </Stack>
        </Stack>
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
          />
        </Card>
      </Stack>

      <Reveal label="What protected means">
        <Text variant="footnote" tone="muted">Rebalancing moves work around these blocks, never through them.</Text>
      </Reveal>
    </Stack>
  );
}
