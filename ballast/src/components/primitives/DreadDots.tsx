/**
 * Data / Dread dots.
 *
 * Dread is visible on every row. Four dots next to the assignment and one next
 * to the library books is why the app knows a twenty-minute errand is not the
 * thing crushing you, even though both are "a task".
 *
 * Never colour alone: the dots are filled or hollow as well as tinted, and the
 * row carries a spoken label so a screen reader gets the number, not the picture.
 */
import { Pressable, View } from 'react-native';
import type { Dread } from '@/lib/types';
import { tapFeedback } from '@/lib/haptics';
import { Text } from './Text';
import { Stack } from './Stack';

const FILL = {
  1: 'bg-steady-fill border-steady-fill',
  2: 'bg-steady-fill border-steady-fill',
  3: 'bg-busy-fill border-busy-fill',
  4: 'bg-heavy-fill border-heavy-fill',
  5: 'bg-heavy-fill border-heavy-fill',
} as const;

export function DreadDots({ value, size = 'sm' }: { value: Dread; size?: 'sm' | 'lg' }) {
  const dot = size === 'lg' ? 'h-6 w-6' : 'h-2 w-2';
  return (
    <View
      className="flex-row items-center gap-2"
      accessibilityRole="image"
      accessibilityLabel={`Dread ${value} out of 5`}
    >
      {[1, 2, 3, 4, 5].map((step) => (
        <View
          key={step}
          className={`${dot} rounded-pill border ${step <= value ? FILL[value] : 'border-line-strong bg-transparent'}`}
        />
      ))}
    </View>
  );
}

/**
 * The capture-screen version. One tap, once per task, never asked again - and a
 * 44pt target on every dot, because that rule includes the dread dots.
 */
export function DreadPicker({ value, onChange }: { value: Dread; onChange: (d: Dread) => void }) {
  return (
    <Stack gap={3}>
      <Stack direction="row" gap={4} justify="between">
        {([1, 2, 3, 4, 5] as Dread[]).map((step) => (
          <Pressable
            key={step}
            accessibilityRole="radio"
            accessibilityState={{ selected: value === step }}
            accessibilityLabel={`Dread ${step} out of 5`}
            onPress={() => { tapFeedback(); onChange(step); }}
            className="min-h-min min-w-min items-center justify-center"
          >
            <View className={`h-7 w-7 rounded-pill border-2 ${value === step ? FILL[step] : 'border-line-strong bg-transparent'}`} />
          </Pressable>
        ))}
      </Stack>
      <Stack direction="row" justify="between">
        <Text variant="footnote" tone="subtle">Fine, honestly</Text>
        <Text variant="footnote" tone="subtle">Dreading it</Text>
      </Stack>
    </Stack>
  );
}
