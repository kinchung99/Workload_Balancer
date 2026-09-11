/**
 * Control / Step dots — where you are in a flow, and how much is left.
 *
 * Capture used to be one long scroll. Everything was on screen at once, which
 * sounds efficient and reads as homework: you cannot answer the first question
 * without seeing the other six waiting. Short pages ask one thing each, and this
 * is the promise that there are only so many.
 *
 * Two shapes, because two different things got split up. A *sequence* has an
 * order — you cannot pick a time before you have said what the thing is — so
 * only the pages behind you are tappable and the bar fills as you go. *Tabs* do
 * not: the timetable's week, modules and import are three views of one screen
 * and any of them can be first, so they are named and all reachable.
 */
import { Pressable, View } from 'react-native';
import { color, radius } from '@design/tokens';
import { tapFeedback } from '@/lib/haptics';
import { Stack } from './Stack';
import { Text } from './Text';

export function StepDots({
  labels,
  current,
  onJump,
  variant = 'steps',
}: {
  labels: string[];
  current: number;
  onJump?: (index: number) => void;
  variant?: 'steps' | 'tabs';
}) {
  if (variant === 'tabs') {
    return (
      <Stack direction="row" gap={2} accessibilityRole="tablist">
        {labels.map((label, index) => {
          const on = index === current;
          return (
            <Pressable
              key={label}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={label}
              onPress={() => { tapFeedback(); onJump?.(index); }}
              className={`min-h-min flex-1 items-center justify-center rounded-pill border-2 px-3 py-3 active:opacity-70 ${
                on ? 'border-inverse bg-inverse' : 'border-line-hairline bg-raised'
              }`}
            >
              <Text variant="caption" tone={on ? 'inverse' : 'muted'}>{label}</Text>
            </Pressable>
          );
        })}
      </Stack>
    );
  }

  return (
    <Stack gap={2} accessibilityLabel={`Step ${current + 1} of ${labels.length}, ${labels[current]}`}>
      <Stack direction="row" gap={2} align="center">
        {labels.map((label, index) => {
          const done = index < current;
          const now = index === current;
          const bar = (
            <View
              style={{
                height: 8,
                borderRadius: radius.pill,
                backgroundColor: now ? color.decor.lilac : done ? color.decor.mint : color.surface.track,
                borderWidth: now ? 1.5 : 0,
                borderColor: color.ink.default,
              }}
            />
          );
          if (!done || !onJump) {
            return <View key={label} style={{ flex: now ? 1.6 : 1 }}>{bar}</View>;
          }
          return (
            <Pressable
              key={label}
              accessibilityRole="button"
              accessibilityLabel={`Back to ${label}`}
              onPress={() => { tapFeedback(); onJump(index); }}
              className="py-3 active:opacity-60"
              style={{ flex: 1 }}
            >
              {bar}
            </Pressable>
          );
        })}
      </Stack>
      <Text variant="micro" tone="subtle">
        STEP {current + 1} OF {labels.length} · {labels[current].toUpperCase()}
      </Text>
    </Stack>
  );
}
