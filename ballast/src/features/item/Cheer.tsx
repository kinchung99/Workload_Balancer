import { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Stack, Sticker, Text } from '@/components';
import { color, motion } from '@design/tokens';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { DECORATIVE } from '@/components/charts/decorative';
import { NATIVE_DRIVER } from '@/lib/nativeDriver';

const CONFETTI = [
  { x: 6, y: 6, fill: color.band.steady.fill, r: 3 },
  { x: 22, y: 2, fill: color.decor.lemon, r: 2.5 },
  { x: 38, y: 8, fill: color.band.recovery.fill, r: 3 },
  { x: 54, y: 3, fill: color.decor.blush, r: 2.5 },
  { x: 70, y: 7, fill: color.area.mental.ink, r: 3 },
];

/**
 * Something you did, said back to you.
 *
 * Booking three hours or logging one is the moment the bar moves, and it used
 * to move silently somewhere above the button. This pops in where your thumb
 * is, says what happened in a few words, and gets out of the way - it never
 * appears for anything that went wrong.
 */
export function Cheer({ title, sub }: { title: string; sub?: string }) {
  const reduceMotion = useReducedMotion();
  const pop = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;

  useEffect(() => {
    if (reduceMotion) { pop.setValue(1); return; }
    Animated.timing(pop, { toValue: 1, duration: motion.meter, easing: Easing.out(Easing.back(2)), useNativeDriver: NATIVE_DRIVER }).start();
  }, [reduceMotion, pop]);

  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      style={{ opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }] }}
    >
      <Stack direction="row" gap={3} align="center" className="rounded-lg border border-steady-fill bg-steady-wash px-4 py-3">
        <Sticker name="star" size={36} wiggle />
        <Stack gap={1} grow>
          <View {...DECORATIVE}>
            <Svg width={76} height={12} viewBox="0 0 76 12">
              {CONFETTI.map((piece) => (
                <Circle key={piece.x} cx={piece.x} cy={piece.y} r={piece.r} fill={piece.fill} />
              ))}
            </Svg>
          </View>
          <Text variant="body" weight="semibold" tone="steady">{title}</Text>
          {sub ? <Text variant="footnote" tone="muted">{sub}</Text> : null}
        </Stack>
      </Stack>
    </Animated.View>
  );
}
