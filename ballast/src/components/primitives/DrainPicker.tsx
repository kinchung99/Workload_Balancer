/**
 * Control / Drain picker — "how draining is it?", asked the same way everywhere.
 *
 * The app's one subjective number used to be four different controls in four
 * places, and a new student skipped all of them: five dots that changed nothing
 * they could see is homework. This is one control with three jobs, in order of
 * what makes people actually answer it:
 *
 *   1. Five faces with plain words, from Easy to Exhausting.
 *   2. Under every face, what that answer costs this student's own battery -
 *      so the choice has a visible price before it is made.
 *   3. One line that says the whole model as a picture: 3h x Draining = -6%.
 *
 * No explainer: the faces, the prices and the sum already say it.
 *
 * Colour is band colour, because drain is a reading: one and two are steady,
 * three busy, four and five heavy - the same as the face on every row.
 */
import { useEffect, useRef } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { color, radius } from '@design/tokens';
import { DRAIN, LEVELS, costLabel, drainTone } from '@/lib/drain';
import { tapFeedback } from '@/lib/haptics';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { Dread } from '@/lib/types';
import { DECORATIVE } from '../charts/decorative';
import { DrainFace } from './AreaDial';
import { Stack } from './Stack';
import { Text } from './Text';
import { NATIVE_DRIVER } from '@/lib/nativeDriver';

const BAND = { steady: color.band.steady, busy: color.band.busy, heavy: color.band.heavy } as const;

export interface DrainPickerProps {
  value: Dread;
  onChange: (next: Dread) => void;
  /** Battery points this would cost at each level, printed under each face. */
  costs?: Record<Dread, number>;
  /** Hours, for the "3h x Draining = -6%" line. */
  hours?: number;
  /** The level it had before, marked under that face so a change reads as one. */
  was?: Dread;
  question?: string;
  /** What the costs are a share of. */
  costOf?: string;
  /** Smaller, with no question heading. For side-by-side demos. */
  compact?: boolean;
}

export function DrainPicker({
  value,
  onChange,
  costs,
  hours,
  was,
  question = 'How draining is it?',
  costOf = 'of your week',
  compact = false,
}: DrainPickerProps) {
  const reduce = useReducedMotion();
  const pop = useRef(new Animated.Value(1)).current;
  const first = useRef(true);

  useEffect(() => {
    // A small bounce on the face you picked - on a change, not on arrival.
    if (first.current) { first.current = false; return; }
    if (reduce) return;
    pop.setValue(0.8);
    Animated.spring(pop, { toValue: 1, friction: 4, tension: 170, useNativeDriver: NATIVE_DRIVER }).start();
  }, [value, reduce, pop]);

  const face = compact ? 40 : 50;

  return (
    <Stack gap={compact ? 3 : 4}>
      {!compact ? <Text variant="heading">{question}</Text> : null}

      {/* Five faces. Tap one; the price of each is printed underneath. */}
      <View accessibilityRole="radiogroup" accessibilityLabel={question} className="flex-row justify-between">
        {LEVELS.map((level) => {
          const on = level === value;
          const tone = BAND[drainTone(level)];
          return (
            <Pressable
              key={level}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${DRAIN[level].word}, ${DRAIN[level].like}${costs ? `. Costs ${costLabel(costs[level])} ${costOf}` : ''}`}
              onPress={() => { tapFeedback(); onChange(level); }}
              className="min-h-min items-center gap-1 active:opacity-70"
              style={{ width: '19%' }}
            >
              <Animated.View
                style={{
                  width: face, height: face, borderRadius: radius.pill,
                  alignItems: 'center', justifyContent: 'center',
                  backgroundColor: on ? tone.wash : color.surface.sunken,
                  borderWidth: on ? 3 : 1,
                  borderColor: on ? tone.fill : color.line.hairline,
                  transform: [{ scale: on ? pop : 0.9 }],
                }}
              >
                <DrainFace level={level} size={on ? face * 0.66 : face * 0.56} />
              </Animated.View>
              <Text variant="micro" weight={on ? 'bold' : 'semibold'} tone={on ? drainTone(level) : 'subtle'} className="text-center">
                {DRAIN[level].word}
              </Text>
              {costs ? (
                <Text variant="micro" weight={on ? 'bold' : 'semibold'} tone={on ? 'default' : 'subtle'}>{costLabel(costs[level])}</Text>
              ) : null}
              {was !== undefined && was === level && !on ? (
                <View className="rounded-pill bg-sunken px-2">
                  <Text variant="micro" tone="subtle">was</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {/* The scale, filled to the level picked, so five faces read as one dial. */}
      <View {...DECORATIVE} className="flex-row gap-1">
        {LEVELS.map((level) => (
          <View
            key={level}
            style={{
              flex: 1, height: 6, borderRadius: radius.pill,
              backgroundColor: level <= value ? BAND[drainTone(level)].fill : color.surface.track,
            }}
          />
        ))}
      </View>

      {hours !== undefined && costs ? (
        <Equation hours={hours} level={value} cost={costs[value]} costOf={costOf} before={was !== undefined && was !== value ? costs[was] : undefined} />
      ) : null}
    </Stack>
  );
}

/**
 * The whole model in one line: hours, times how draining, equals battery.
 * It is the sentence the app runs on, and it is never otherwise said.
 */
function Equation({
  hours, level, cost, costOf, before,
}: { hours: number; level: Dread; cost: number; costOf: string; before?: number }) {
  const tone = BAND[drainTone(level)];
  const h = hours < 1 ? `${Math.round(hours * 60)}m` : `${Math.round(hours * 10) / 10}h`;
  return (
    <Stack gap={1}>
      <Stack
        direction="row"
        gap={2}
        align="center"
        wrap
        accessible
        accessibilityLabel={`${h} times ${DRAIN[level].word} costs ${costLabel(cost)} ${costOf}`}
      >
        <View className="rounded-pill bg-sunken px-3 py-2">
          <Text variant="caption" weight="semibold">⏱ {h}</Text>
        </View>
        <Text variant="heading" tone="subtle">×</Text>
        <View className="flex-row items-center gap-1 rounded-pill px-3 py-1" style={{ backgroundColor: tone.wash }}>
          <DrainFace level={level} size={20} />
          <Text variant="caption" weight="semibold" tone={drainTone(level)}>{DRAIN[level].word}</Text>
        </View>
        <Text variant="heading" tone="subtle">=</Text>
        <View className="rounded-pill bg-inverse px-3 py-2">
          <Text variant="caption" weight="bold" tone="inverse">🔋 {costLabel(cost)}</Text>
        </View>
      </Stack>
      <Text variant="micro" tone="subtle">
        {costOf}{before !== undefined ? ` · was ${costLabel(before)}` : ''}
      </Text>
    </Stack>
  );
}

/**
 * Data / Drain badge — the same face, small, on every row.
 *
 * Rows used to carry five tiny dots, a different picture from the one you set
 * it with. Now the row shows the face you picked, so the two read as one thing.
 */
export function DrainBadge({ value, word = false }: { value: Dread; word?: boolean }) {
  const tone = BAND[drainTone(value)];
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${DRAIN[value].word}, drain ${value} of 5`}
      className="flex-row items-center gap-1 rounded-pill px-2 py-1"
      style={{ backgroundColor: tone.wash, borderWidth: 1, borderColor: tone.fill }}
    >
      <DrainFace level={value} size={16} />
      {word ? <Text variant="micro" tone={drainTone(value)}>{DRAIN[value].word}</Text> : null}
    </View>
  );
}
