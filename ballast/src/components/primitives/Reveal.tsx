/**
 * Control / Reveal — the explanation, one tap away.
 *
 * Most of the words on these screens were justifying a design decision to
 * someone reading it for the first time. That is worth saying once and then
 * never again, so it lives behind a tap: the screen shows the number and the
 * control, and anyone who wants the reasoning asks for it.
 */
import { useState, type ReactNode } from 'react';
import { Pressable } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { color } from '@design/tokens';
import { tapFeedback } from '@/lib/haptics';
import { Stack } from './Stack';
import { Text } from './Text';

export function Reveal({
  label = 'How this works',
  children,
  tone = 'subtle',
}: {
  label?: string;
  children: ReactNode;
  tone?: 'subtle' | 'muted';
}) {
  const [open, setOpen] = useState(false);

  return (
    <Stack gap={3}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={label}
        onPress={() => { tapFeedback(); setOpen(!open); }}
        className="min-h-min flex-row items-center gap-2 self-start active:opacity-60"
      >
        <Text variant="micro" tone={tone}>{label.toUpperCase()}</Text>
        <Svg width={12} height={12} viewBox="0 0 12 12">
          <Path
            d={open ? 'M2.5 7.5 6 4l3.5 3.5' : 'M2.5 4.5 6 8l3.5-3.5'}
            stroke={color.ink.subtle}
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
      </Pressable>
      {open ? <Stack gap={2}>{children}</Stack> : null}
    </Stack>
  );
}
