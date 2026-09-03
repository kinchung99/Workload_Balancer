/**
 * Data / Forecast strip.
 *
 * Fourteen days, read as a weather strip rather than a calendar. A student does
 * not need the detail to see that the middle of next week is a different colour
 * from everything around it.
 *
 * This only exists because dread and repeating load are already in the model. A
 * calendar could draw this strip, but every bar would be the same height.
 */
import { useState } from 'react';
import { View } from 'react-native';
import { bar as barToken } from '@design/tokens';
import { DAY_LETTER, dayIndex } from '@/lib/dates';
import { bandFor } from '@/lib/load';
import { Stack } from '../primitives/Stack';
import { Text } from '../primitives/Text';
import { PatternFill } from './BandPattern';

export interface ForecastDay {
  date: string;
  load: number;
  /** Percentage of a normal day's ceiling. */
  percent: number;
  /** Part of the flagged cluster. */
  inCluster?: boolean;
}

export function ForecastStrip({ days, spoken }: { days: ForecastDay[]; spoken: string }) {
  const [columnWidth, setColumnWidth] = useState(0);
  const tallest = Math.max(...days.map((d) => d.percent), 100);

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={spoken}>
      <Stack gap={3}>
        <Stack
          direction="row"
          gap={1}
          align="end"
          className="w-full"
          style={{ height: barToken.forecast }}
          onLayout={(event) =>
            setColumnWidth(Math.max(0, event.nativeEvent.layout.width / days.length - 2))
          }
        >
          {days.map((day) => {
            const band = bandFor(day.percent);
            const height = Math.max(6, (day.percent / tallest) * barToken.forecast);
            return (
              <View key={day.date} className="flex-1 items-center justify-end">
                {columnWidth > 0 ? (
                  <PatternFill band={band} width={columnWidth} height={height} radius={3} />
                ) : null}
              </View>
            );
          })}
        </Stack>

        <Stack direction="row" gap={1} className="w-full">
          {days.map((day) => (
            <View key={day.date} className="flex-1 items-center">
              <Text
                variant="micro"
                tone={day.inCluster ? 'heavy' : 'subtle'}
                weight={day.inCluster ? 'bold' : 'semibold'}
              >
                {DAY_LETTER[dayIndex(day.date)]}
              </Text>
            </View>
          ))}
        </Stack>
      </Stack>
    </View>
  );
}
