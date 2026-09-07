/**
 * Data / Week strip — the seven days you are actually in.
 *
 * Home used to show today and nothing else, so the rest of the week was
 * invisible until you went looking for it. This puts all seven in one glance:
 * how heavy each day is, how many things are on it, which one is today, and
 * which are part of a flagged collision. Tapping opens that day in full.
 */
import { Pressable, View } from 'react-native';
import { DAY_LETTER, dayIndex, parseISO } from '@/lib/dates';
import { bandFor, sumLoad } from '@/lib/load';
import { daySchedule, dayHours } from '@/lib/schedule';
import type { Item } from '@/lib/types';
import { Stack } from '../primitives/Stack';
import { Text } from '../primitives/Text';

const BAR = { steady: 'bg-steady-fill', busy: 'bg-busy-fill', heavy: 'bg-heavy-fill' } as const;
const TONE = { steady: 'steady', busy: 'busy', heavy: 'heavy' } as const;

const MAX_BAR = 54;

export function WeekStrip({
  items,
  days,
  today,
  cluster,
  onSelect,
}: {
  items: Item[];
  days: string[];
  today: string;
  /** Dates inside a flagged collision, marked so the wall is visible from Home. */
  cluster?: Set<string>;
  onSelect?: (date: string) => void;
}) {
  const loads = days.map((date) => {
    const { all } = daySchedule(items, date);
    return { date, load: Math.max(0, sumLoad(all)), count: all.length };
  });
  const peak = Math.max(...loads.map((d) => d.load), 1);

  const spoken = loads
    .map((d) => `${DAY_LETTER[dayIndex(d.date)]}, ${d.count} things, ${d.load} load`)
    .join('. ');

  return (
    <View accessible={!onSelect} accessibilityRole="image" accessibilityLabel={onSelect ? undefined : spoken}>
      <Stack direction="row" gap={2} align="end">
        {loads.map((day) => {
          const isToday = day.date === today;
          const inCluster = cluster?.has(day.date);
          const band = bandFor((day.load / peak) * 100);
          const height = Math.max(6, (day.load / peak) * MAX_BAR);
          const hours = dayHours(items, day.date);

          const column = (
            <Stack gap={2} align="center" className="w-full">
              {/* The bar. Height is this day against the heaviest day of the week. */}
              <View className="h-14 w-full justify-end">
                <View className={`w-full rounded-sm ${BAR[band]}`} style={{ height }} />
              </View>
              <Stack
                gap={1}
                align="center"
                className={`w-full rounded-sm py-1 ${isToday ? 'bg-inverse' : inCluster ? 'bg-heavy-wash' : ''}`}
              >
                <Text
                  variant="micro"
                  weight={isToday || inCluster ? 'bold' : 'semibold'}
                  tone={isToday ? 'inverse' : inCluster ? 'heavy' : 'subtle'}
                >
                  {DAY_LETTER[dayIndex(day.date)]}
                </Text>
                <Text variant="micro" tone={isToday ? 'inverse' : 'subtle'}>
                  {parseISO(day.date).getUTCDate()}
                </Text>
              </Stack>
              <Text variant="micro" tone={TONE[band]}>{hours.committed}h</Text>
            </Stack>
          );

          if (!onSelect) return <View key={day.date} className="flex-1">{column}</View>;
          return (
            <View key={day.date} className="flex-1">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${DAY_LETTER[dayIndex(day.date)]} ${parseISO(day.date).getUTCDate()}, ${day.count} things, ${hours.committed} hours committed${inCluster ? ', part of the wall' : ''}${isToday ? ', today' : ''}`}
                onPress={() => onSelect(day.date)}
                className="min-h-min w-full active:opacity-60"
              >
                {column}
              </Pressable>
            </View>
          );
        })}
      </Stack>
    </View>
  );
}
