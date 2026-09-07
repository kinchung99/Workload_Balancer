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
import { Pressable, View } from 'react-native';
import { bar as barToken, frame, space } from '@design/tokens';
import { DAY_LETTER, dayIndex, parseISO } from '@/lib/dates';
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

/**
 * Width to draw at before the first layout pass.
 *
 * SVG needs a number, and `onLayout` reports nothing during prerender - so
 * gating on a measured width meant the chart was simply absent from the served
 * HTML and only appeared once JavaScript had run. Starting from the artboard
 * width draws it immediately and the real measurement refines it.
 */
const fallbackColumn = (count: number) =>
  Math.max(6, (frame.width - space[5] * 2 - space[6] * 2 - space[1] * count) / count);

export function ForecastStrip({
  days,
  spoken,
  selected,
  onSelect,
}: {
  days: ForecastDay[];
  spoken: string;
  /** The day whose detail is shown below. Makes the strip a control, not a picture. */
  selected?: string;
  onSelect?: (date: string) => void;
}) {
  const [columnWidth, setColumnWidth] = useState(() => fallbackColumn(days.length));
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
          {days.map((day) => {
            const isSelected = day.date === selected;
            const label = (
              <Stack gap={1} align="center" className={`w-full rounded-sm py-1 ${isSelected ? 'bg-inverse' : ''}`}>
                <Text
                  variant="micro"
                  tone={isSelected ? 'inverse' : day.inCluster ? 'heavy' : 'subtle'}
                  weight={day.inCluster || isSelected ? 'bold' : 'semibold'}
                >
                  {DAY_LETTER[dayIndex(day.date)]}
                </Text>
                <Text variant="micro" tone={isSelected ? 'inverse' : 'subtle'}>
                  {parseISO(day.date).getUTCDate()}
                </Text>
              </Stack>
            );
            return (
              <View key={day.date} className="flex-1 items-center">
                {onSelect ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`${DAY_LETTER[dayIndex(day.date)]} ${parseISO(day.date).getUTCDate()}, ${day.percent} percent of a normal day`}
                    onPress={() => onSelect(day.date)}
                    className="min-h-min w-full items-center justify-end active:opacity-60"
                  >
                    {label}
                  </Pressable>
                ) : (
                  label
                )}
              </View>
            );
          })}
        </Stack>
      </Stack>
    </View>
  );
}
