/**
 * Data / Week grid.
 *
 * Drawn from the same `items` as everything else — it used to render a separate
 * seeded block list, which meant the timetable on screen was not your week.
 *
 * Committed time carries its band colour so a heavy Wednesday looks heavy;
 * protected recovery is green and outlined. Anything without a slot is counted
 * under the day rather than invented onto the grid.
 */
import { Pressable, View } from 'react-native';
import { DAY_LETTER, dayIndex } from '@/lib/dates';
import { DAY_END, DAY_START, daySchedule, endHour, formatHour } from '@/lib/schedule';
import { bandFor, loadOf } from '@/lib/load';
import type { Item } from '@/lib/types';
import { Stack } from '../primitives/Stack';
import { Text } from '../primitives/Text';

const ROW = 15;

const FILL = {
  steady: 'bg-steady-wash border-l-steady-fill',
  busy: 'bg-busy-wash border-l-busy-fill',
  heavy: 'bg-heavy-wash border-l-heavy-fill',
} as const;

const intensity = (item: Item) => bandFor((loadOf(item) / Math.max(item.hours, 0.5)) * 22);

export function WeekGrid({
  items,
  days,
  todayDate,
  onSelectDay,
}: {
  items: Item[];
  days: string[];
  todayDate: string;
  onSelectDay?: (date: string) => void;
}) {
  const hours = Array.from({ length: DAY_END - DAY_START }, (_, i) => DAY_START + i);
  const scheduled = days.reduce((total, date) => total + daySchedule(items, date).timed.length, 0);
  const floating = days.reduce((total, date) => total + daySchedule(items, date).anytime.length, 0);

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Week grid. ${scheduled} scheduled blocks and ${floating} unscheduled tasks across seven days.`}
    >
      <Stack gap={3}>
        <Stack direction="row" gap={1}>
          <View className="w-9" />
          {days.map((date) => {
            const isToday = date === todayDate;
            const spare = daySchedule(items, date).anytime.length;
            const header = (
              <Stack gap={1} align="center">
                <Text variant="micro" tone={isToday ? 'default' : 'subtle'} weight={isToday ? 'bold' : 'semibold'}>
                  {DAY_LETTER[dayIndex(date)]}
                </Text>
                {spare > 0 ? <Text variant="micro" tone="subtle">+{spare}</Text> : <Text variant="micro" tone="subtle"> </Text>}
              </Stack>
            );
            return (
              <View key={date} className="flex-1">
                {onSelectDay ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${date}`}
                    onPress={() => onSelectDay(date)}
                    className="min-h-min items-center justify-center active:opacity-60"
                  >
                    {header}
                  </Pressable>
                ) : (
                  <View className="items-center">{header}</View>
                )}
              </View>
            );
          })}
        </Stack>

        <Stack direction="row" gap={1}>
          <Stack className="w-9">
            {hours.map((hour) => (
              <View key={hour} style={{ height: ROW }}>
                {hour % 3 === DAY_START % 3 ? (
                  <Text variant="micro" tone="subtle">{formatHour(hour)}</Text>
                ) : null}
              </View>
            ))}
          </Stack>

          {days.map((date) => (
            <View
              key={date}
              className={`flex-1 rounded-sm ${date === todayDate ? 'bg-sunken' : 'bg-page border border-line-hairline'}`}
              style={{ height: (DAY_END - DAY_START) * ROW }}
            >
              {daySchedule(items, date).timed.map((item) => (
                <View
                  key={item.id}
                  className={`absolute left-0 right-0 overflow-hidden rounded-sm border-l-2 ${
                    item.isRecovery ? 'bg-recovery-wash border-l-recovery-fill' : FILL[intensity(item)]
                  }`}
                  style={{
                    top: (item.startHour - DAY_START) * ROW,
                    height: Math.max(ROW, (Math.min(endHour(item), DAY_END) - item.startHour) * ROW - 1),
                  }}
                >
                  <Text variant="micro" tone="muted" numberOfLines={1} className="px-1">
                    {item.title.split(',')[0].split(' ').slice(0, 2).join(' ')}
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </Stack>
      </Stack>
    </View>
  );
}
