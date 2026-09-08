/**
 * Foundations / Burst — a small celebration.
 *
 * The app spends most of its time telling someone their week is heavy, which is
 * true and is also not much of a reason to open it again. When something goes the
 * other way — a good moment logged, a task finished — it should feel like
 * something happened.
 *
 * Deliberately short and deliberately quiet: it plays once, it blocks nothing,
 * and it never appears for a *failure*. There are no streaks and no scores here,
 * so this is the only reward mechanic in the app and it only ever fires for
 * something the student actually did.
 */
import { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { color, motion } from '@design/tokens';
import { useReducedMotion } from '@/hooks/useReducedMotion';

const CONFETTI = [
  { x: 10, y: 4, fill: color.band.steady.fill, r: 3 },
  { x: 32, y: -2, fill: color.band.busy.fill, r: 2.5 },
  { x: 54, y: 6, fill: color.band.recovery.fill, r: 3 },
  { x: 72, y: -1, fill: color.area.mental.ink, r: 2.5 },
  { x: 88, y: 5, fill: color.area.social.ink, r: 3 },
];

export function Burst({ show, label }: { show: boolean; label: string }) {
  const reduceMotion = useReducedMotion();
  const pop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!show) return;
    if (reduceMotion) {
      pop.setValue(1);
      return;
    }
    pop.setValue(0);
    Animated.sequence([
      Animated.timing(pop, { toValue: 1, duration: motion.meter, easing: Easing.out(Easing.back(2)), useNativeDriver: true }),
      Animated.delay(900),
      Animated.timing(pop, { toValue: 0, duration: motion.meter, useNativeDriver: true }),
    ]).start();
  }, [show, reduceMotion, pop]);

  if (!show) return null;

  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      accessibilityLabel={label}
      style={{ opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }] }}
      className="items-center gap-2 rounded-lg bg-steady-wash px-5 py-4"
    >
      <Svg width={100} height={16} viewBox="0 0 100 16">
        {CONFETTI.map((piece) => (
          <Circle key={piece.x} cx={piece.x} cy={8 + piece.y} r={piece.r} fill={piece.fill} />
        ))}
      </Svg>
      <View className="flex-row items-center gap-2">
        <Svg width={18} height={18} viewBox="0 0 18 18">
          <Circle cx={9} cy={9} r={8} fill={color.band.steady.fill} />
          <Path d="M5.5 9.2l2.4 2.4L12.8 6.6" stroke={color.ink.inverse} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </Svg>
      </View>
    </Animated.View>
  );
}
