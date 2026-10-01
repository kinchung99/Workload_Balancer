import { View } from 'react-native';
import { Stack, Text } from '@/components';
import { color, radius } from '@design/tokens';
import { dayName } from '@/lib/dates';
import { DAY_END, DAY_START, formatHour, type Slot } from '@/lib/schedule';

const SPAN = DAY_END - DAY_START;

/**
 * A friend's view of your week: one bar per day, 7am to 11pm, with only the
 * windows they will be shown filled in. Unlabelled on purpose - this is the
 * whole privacy promise drawn out, and there is nothing to label it with.
 */
export function WeekPreview({ week, today }: { week: Array<{ date: string; free: Slot[] }>; today: string }) {
  return (
    <Stack gap={3}>
      {week.map(({ date, free }) => (
        <Stack key={date} gap={1}>
          <Stack direction="row" gap={3} align="center">
            <Text variant="caption" weight="semibold" style={{ width: 44 }}>
              {date === today ? 'Today' : dayName(date).slice(0, 3)}
            </Text>
            <View className="flex-1" style={{ height: 14, borderRadius: radius.pill, backgroundColor: color.surface.page, overflow: 'hidden' }}>
              {free.map((slot, i) => (
                <View
                  key={i}
                  style={{
                    position: 'absolute', top: 0, bottom: 0,
                    left: `${((slot.start - DAY_START) / SPAN) * 100}%`,
                    width: `${((slot.end - slot.start) / SPAN) * 100}%`,
                    backgroundColor: color.band.recovery.fill,
                    borderRadius: radius.pill,
                  }}
                />
              ))}
            </View>
          </Stack>
          <Text variant="micro" tone={free.length ? 'recovery' : 'subtle'} style={{ paddingLeft: 56 }}>
            {free.length ? free.map((slot) => `${formatHour(slot.start)}–${formatHour(slot.end)}`).join(' · ') : 'nothing'}
          </Text>
        </Stack>
      ))}
      <Stack direction="row" justify="between" style={{ paddingLeft: 56 }}>
        {[7, 11, 15, 19, 23].map((hour) => <Text key={hour} variant="micro" tone="subtle">{formatHour(hour)}</Text>)}
      </Stack>
    </Stack>
  );
}
