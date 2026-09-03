/**
 * Control / Mood grid.
 *
 * Energy on one axis, pleasantness on the other. Two taps and you have said
 * something a five-point "how was today" cannot: whether you are wired and
 * miserable or flat and content, which are entirely different weeks.
 */
import { Pressable, View } from 'react-native';
import type { MoodQuadrant } from '@/lib/types';
import { Stack } from './Stack';
import { Text } from './Text';

export const QUADRANTS: Array<{ id: MoodQuadrant; label: string; tone: keyof typeof TINT }> = [
  { id: 'high-unpleasant', label: 'High Energy · Unpleasant', tone: 'busy' },
  { id: 'high-pleasant',   label: 'High Energy · Pleasant',   tone: 'steady' },
  { id: 'low-unpleasant',  label: 'Low Energy · Unpleasant',  tone: 'heavy' },
  { id: 'low-pleasant',    label: 'Low Energy · Pleasant',    tone: 'recovery' },
];

const TINT = {
  busy:     { off: 'bg-busy-wash',     on: 'bg-busy-wash border-busy-fill',         dot: 'bg-busy-fill' },
  steady:   { off: 'bg-steady-wash',   on: 'bg-steady-wash border-steady-fill',     dot: 'bg-steady-fill' },
  heavy:    { off: 'bg-heavy-wash',    on: 'bg-heavy-wash border-heavy-fill',       dot: 'bg-heavy-fill' },
  recovery: { off: 'bg-recovery-wash', on: 'bg-recovery-wash border-recovery-fill', dot: 'bg-recovery-fill' },
} as const;

export function MoodGrid({
  value,
  onChange,
}: {
  value: MoodQuadrant | null;
  onChange: (quadrant: MoodQuadrant) => void;
}) {
  return (
    <Stack gap={3}>
      <Text variant="micro" tone="subtle" className="text-center">HIGH ENERGY</Text>
      <Stack direction="row" gap={3} align="center">
        <View className="w-6">
          <Text variant="micro" tone="subtle">UN&shy;PLEASANT</Text>
        </View>
        <Stack gap={3} grow>
          {[QUADRANTS.slice(0, 2), QUADRANTS.slice(2)].map((row, index) => (
            <Stack key={index} direction="row" gap={3}>
              {row.map((quadrant) => {
                const selected = value === quadrant.id;
                const tint = TINT[quadrant.tone];
                return (
                  <Pressable
                    key={quadrant.id}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={quadrant.label}
                    onPress={() => onChange(quadrant.id)}
                    className={`h-24 flex-1 items-center justify-center rounded-md border-2 ${
                      selected ? tint.on : `${tint.off} border-transparent`
                    }`}
                  >
                    <View className={`h-4 w-4 rounded-pill ${selected ? tint.dot : 'bg-transparent border border-line-strong'}`} />
                  </Pressable>
                );
              })}
            </Stack>
          ))}
        </Stack>
        <View className="w-6 items-end">
          <Text variant="micro" tone="subtle">PLEASANT</Text>
        </View>
      </Stack>
      <Text variant="micro" tone="subtle" className="text-center">LOW ENERGY</Text>
    </Stack>
  );
}

export const quadrantLabel = (quadrant: MoodQuadrant): string =>
  QUADRANTS.find((entry) => entry.id === quadrant)?.label ?? '';

export const quadrantTone = (quadrant: MoodQuadrant) =>
  QUADRANTS.find((entry) => entry.id === quadrant)?.tone ?? 'steady';
