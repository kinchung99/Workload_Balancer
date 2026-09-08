/**
 * Data / Mascot — the battery, with a face.
 *
 * The brief's own literature review is two apps built on a character: Forest's
 * tree and Study Bunny's rabbit. Both work for the same reason — you can read
 * how you are doing before you read anything at all, and a drawing carries a
 * tone that a percentage cannot.
 *
 * The face is sympathetic, never disapproving. A heavy week is information, not
 * a failure, so at 8% this is a companion who is also tired — not a judge. That
 * distinction is the whole difference between encouraging and shaming, and it is
 * why there is no frown here at any level.
 */
import { useEffect, useRef, useState } from 'react';
import { Animated, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { color, motion, radius } from '@design/tokens';
import { bandFor } from '@/lib/load';
import { useReducedMotion } from '@/hooks/useReducedMotion';

export type Mood = 'great' | 'good' | 'tired' | 'spent';

export const moodFor = (charge: number): Mood =>
  charge >= 60 ? 'great' : charge >= 35 ? 'good' : charge >= 15 ? 'tired' : 'spent';

/** One word, chosen to be kind at every level. */
export const MOOD_WORD: Record<Mood, string> = {
  great: 'Full of it',
  good: 'Doing fine',
  tired: 'Running low',
  spent: 'Nearly empty',
};

const FILL: Record<Mood, string> = {
  great: color.band.steady.fill,
  good: color.band.steady.fill,
  tired: color.band.busy.fill,
  spent: color.band.heavy.fill,
};

export function Mascot({
  charge,
  loadPercent,
  size = 132,
}: {
  charge: number;
  loadPercent: number;
  size?: number;
}) {
  const mood = moodFor(charge);
  const reduceMotion = useReducedMotion();
  const progress = useRef(new Animated.Value(charge)).current;
  const [shown, setShown] = useState(charge);

  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(charge);
      setShown(charge);
      return;
    }
    const animation = Animated.timing(progress, { toValue: charge, duration: motion.meter, useNativeDriver: false });
    animation.start();
    const id = progress.addListener(({ value }) => setShown(value));
    return () => { animation.stop(); progress.removeListener(id); };
  }, [charge, reduceMotion, progress]);

  const w = size;
  const h = size * 1.18;
  const bodyTop = h * 0.12;
  const bodyH = h * 0.76;
  const inset = w * 0.09;
  const innerH = bodyH - inset * 2;
  const filled = Math.max(shown > 0 ? 6 : 0, (Math.max(0, Math.min(100, shown)) / 100) * innerH);
  const eyeY = bodyTop + bodyH * 0.42;
  const mouthY = bodyTop + bodyH * 0.62;
  const tint = FILL[mood];

  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        <Defs>
          <LinearGradient id="mascot-fill" x1="0" y1="1" x2="0" y2="0">
            <Stop offset="0" stopColor={tint} stopOpacity="1" />
            <Stop offset="1" stopColor={tint} stopOpacity="0.62" />
          </LinearGradient>
        </Defs>

        {/* The terminal on top, so it reads as a battery before anything else. */}
        <Rect x={w * 0.38} y={bodyTop - h * 0.055} width={w * 0.24} height={h * 0.06} rx={w * 0.03} fill={color.line.strong} />

        {/* Shell */}
        <Rect
          x={0} y={bodyTop} width={w} height={bodyH}
          rx={radius.xl} ry={radius.xl}
          fill={color.surface.sunken}
          stroke={color.ink.default}
          strokeWidth={3}
        />

        {/* Charge, rising from the bottom. */}
        <G>
          <Rect
            x={inset}
            y={bodyTop + inset + (innerH - filled)}
            width={w - inset * 2}
            height={filled}
            rx={radius.md}
            fill="url(#mascot-fill)"
          />
        </G>

        {/* Eyes. Open and bright when there is charge, heavy-lidded when there is not. */}
        {mood === 'spent' ? (
          <>
            <Path d={`M${w * 0.3} ${eyeY} q ${w * 0.07} ${h * 0.035} ${w * 0.14} 0`} stroke={color.ink.default} strokeWidth={3.4} strokeLinecap="round" fill="none" />
            <Path d={`M${w * 0.56} ${eyeY} q ${w * 0.07} ${h * 0.035} ${w * 0.14} 0`} stroke={color.ink.default} strokeWidth={3.4} strokeLinecap="round" fill="none" />
          </>
        ) : (
          <>
            <Ellipse cx={w * 0.37} cy={eyeY} rx={w * 0.052} ry={mood === 'tired' ? h * 0.022 : h * 0.042} fill={color.ink.default} />
            <Ellipse cx={w * 0.63} cy={eyeY} rx={w * 0.052} ry={mood === 'tired' ? h * 0.022 : h * 0.042} fill={color.ink.default} />
            {mood === 'great' ? (
              <>
                <Circle cx={w * 0.395} cy={eyeY - h * 0.014} r={w * 0.018} fill={color.surface.page} />
                <Circle cx={w * 0.655} cy={eyeY - h * 0.014} r={w * 0.018} fill={color.surface.page} />
              </>
            ) : null}
          </>
        )}

        {/* Mouth. A smile, a small line, or a soft open "oh" — never a frown. */}
        {mood === 'great' ? (
          <Path d={`M${w * 0.38} ${mouthY} q ${w * 0.12} ${h * 0.075} ${w * 0.24} 0`} stroke={color.ink.default} strokeWidth={3.4} strokeLinecap="round" fill="none" />
        ) : mood === 'good' ? (
          <Path d={`M${w * 0.41} ${mouthY} q ${w * 0.09} ${h * 0.04} ${w * 0.18} 0`} stroke={color.ink.default} strokeWidth={3.2} strokeLinecap="round" fill="none" />
        ) : mood === 'tired' ? (
          <Path d={`M${w * 0.43} ${mouthY} h ${w * 0.14}`} stroke={color.ink.default} strokeWidth={3.2} strokeLinecap="round" fill="none" />
        ) : (
          <Ellipse cx={w * 0.5} cy={mouthY + h * 0.006} rx={w * 0.055} ry={h * 0.028} fill={color.ink.default} />
        )}

        {/* Cheeks, when things are going well. */}
        {mood === 'great' ? (
          <>
            <Ellipse cx={w * 0.24} cy={mouthY - h * 0.02} rx={w * 0.05} ry={h * 0.022} fill={color.band.heavy.fill} opacity={0.28} />
            <Ellipse cx={w * 0.76} cy={mouthY - h * 0.02} rx={w * 0.05} ry={h * 0.022} fill={color.band.heavy.fill} opacity={0.28} />
          </>
        ) : null}
      </Svg>
    </View>
  );
}
