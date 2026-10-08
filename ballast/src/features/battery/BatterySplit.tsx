/**
 * The week's battery as one bar: used so far, still to come, left.
 *
 * The question a new student actually has - "where did it go?" - answered in a
 * picture before a word: dark is gone, amber is booked, green is yours. What
 * sleep, food, mood and rest put back is already in the green, and says so.
 */
import { View } from 'react-native';
import { Stack, Text } from '@/components';
import { color, radius } from '@design/tokens';

const SPENT = color.ink.default;
const AHEAD = color.band.busy.fill;
const LEFT = color.band.steady.fill;

export function BatterySplit({
  spent, ahead, left, back = 0, height = 14, legend = true,
}: { spent: number; ahead: number; left: number; back?: number; height?: number; legend?: boolean }) {
  const parts = [
    { key: 'spent', value: spent, fill: SPENT, word: 'used' },
    { key: 'ahead', value: ahead, fill: AHEAD, word: 'to come' },
    { key: 'left', value: left, fill: LEFT, word: 'left' },
  ];
  return (
    <Stack gap={2} className="w-full">
      <View
        accessible
        accessibilityLabel={`${spent} percent used so far, ${ahead} percent still to come, ${left} percent left`}
        className="w-full flex-row overflow-hidden"
        style={{ height, borderRadius: radius.pill, backgroundColor: color.surface.track }}
      >
        {parts.map((part) => (part.value > 0 ? (
          <View key={part.key} style={{ flexGrow: part.value, backgroundColor: part.fill }} />
        ) : null))}
      </View>
      {legend ? (
        <Stack direction="row" justify="between" wrap>
          {parts.map((part) => (
            <Stack key={part.key} direction="row" gap={1} align="center">
              <View style={{ width: 10, height: 10, borderRadius: radius.pill, backgroundColor: part.fill }} />
              <Text variant="micro" weight="bold">{part.value}%</Text>
              <Text variant="micro" tone="muted">{part.word}</Text>
            </Stack>
          ))}
        </Stack>
      ) : null}
      {/* What sleep, food, mood and rest put back - already inside "left". */}
      {legend && back >= 1 ? (
        <View className="self-center rounded-pill px-3 py-1" style={{ backgroundColor: color.band.steady.wash }}>
          <Text variant="micro" weight="bold" tone="steady">⚡ +{back}% recharged</Text>
        </View>
      ) : null}
    </Stack>
  );
}
