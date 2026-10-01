/**
 * Control / Dread slider — the dread dots, as something you can feel.
 *
 * Five hollow circles asked a question nobody finds interesting, on the one
 * number the app cannot work out for itself. This asks it with a face instead:
 * drag right and the knob gets more overwhelmed, the word under it changes, and
 * the face on the left takes a small bounce on every notch so the change lands.
 *
 * Colour is band colour, because dread is a reading - one and two are steady,
 * three is busy, four and five are heavy, exactly as the dots on every row.
 * Tap anywhere on the track, drag, or use the adjustable actions.
 */
import { useEffect, useRef, useState } from 'react';
import { Animated, PanResponder, View } from 'react-native';
import { color, radius, target } from '@design/tokens';
import { tapFeedback } from '@/lib/haptics';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { Dread } from '@/lib/types';
import { DrainFace } from './AreaDial';
import { Stack } from './Stack';
import { Text } from './Text';

/** One word per notch. The face does most of the talking. */
export const DREAD_WORD: Record<Dread, string> = {
  1: 'Fine, honestly',
  2: 'Bit meh',
  3: 'Not keen',
  4: 'Dreading it',
  5: 'Can’t face it',
};

const BAND = (value: Dread) => (value <= 2 ? color.band.steady : value === 3 ? color.band.busy : color.band.heavy);
const TONE = (value: Dread): 'steady' | 'busy' | 'heavy' => (value <= 2 ? 'steady' : value === 3 ? 'busy' : 'heavy');

const KNOB = 40;
const STEPS: Dread[] = [1, 2, 3, 4, 5];

export function DreadSlider({ value, onChange }: { value: Dread; onChange: (next: Dread) => void }) {
  const [width, setWidth] = useState(0);
  const widthRef = useRef(0);
  const reduceMotion = useReducedMotion();
  const pop = useRef(new Animated.Value(1)).current;

  // Same trap as every other gesture here: built once, so read props by ref.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const lastRef = useRef(value);

  const mounted = useRef(false);
  useEffect(() => {
    // Bounce on a change, not on arrival.
    if (!mounted.current) { mounted.current = true; return; }
    if (reduceMotion) return;
    pop.setValue(0.82);
    Animated.spring(pop, { toValue: 1, friction: 4, tension: 160, useNativeDriver: true }).start();
  }, [value, reduceMotion, pop]);

  const fromX = (x: number): Dread => {
    const travel = Math.max(1, widthRef.current - KNOB);
    const raw = Math.round(((x - KNOB / 2) / travel) * 4) + 1;
    return Math.max(1, Math.min(5, raw)) as Dread;
  };

  const emit = (x: number) => {
    const next = fromX(x);
    if (next !== lastRef.current) {
      lastRef.current = next;
      tapFeedback();
      onChangeRef.current(next);
    }
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => emit(event.nativeEvent.locationX),
      onPanResponderMove: (event) => emit(event.nativeEvent.locationX),
    }),
  ).current;

  lastRef.current = value;
  const band = BAND(value);
  const travel = Math.max(0, width - KNOB);
  const ratio = (value - 1) / 4;

  return (
    <Stack gap={4}>
      <Stack direction="row" gap={4} align="center">
        <Animated.View
          style={{
            width: 64, height: 64, borderRadius: radius.pill,
            alignItems: 'center', justifyContent: 'center',
            backgroundColor: band.wash, borderWidth: 2, borderColor: band.fill,
            transform: [{ scale: pop }],
          }}
        >
          <DrainFace level={value} size={44} />
        </Animated.View>
        <Stack gap={1} grow>
          <Text variant="title" tone={TONE(value)} accessibilityLiveRegion="polite">{DREAD_WORD[value]}</Text>
          <Text variant="micro" tone="subtle">DREAD {value} OF 5</Text>
        </Stack>
      </Stack>

      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="How much you are dreading it"
        accessibilityValue={{ text: `${DREAD_WORD[value]}, ${value} of 5` }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'increment' && value < 5) onChange((value + 1) as Dread);
          if (event.nativeEvent.actionName === 'decrement' && value > 1) onChange((value - 1) as Dread);
        }}
        className="justify-center"
        style={{ height: target.min + 4 }}
        onLayout={(event) => {
          widthRef.current = event.nativeEvent.layout.width;
          setWidth(event.nativeEvent.layout.width);
        }}
        {...pan.panHandlers}
      >
        {/* The track, tinted in five steps so the scale is readable before you touch it. */}
        <View style={{ flexDirection: 'row', height: 14, borderRadius: radius.pill, overflow: 'hidden' }}>
          {STEPS.map((step) => (
            <View
              key={step}
              style={{ flex: 1, backgroundColor: step <= value ? BAND(step).fill : BAND(step).wash }}
            />
          ))}
        </View>
        {STEPS.map((step) => (
          <View
            key={step}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: KNOB / 2 - 3 + ((step - 1) / 4) * travel,
              width: 6, height: 6, borderRadius: radius.pill,
              backgroundColor: color.surface.page, opacity: 0.85,
            }}
          />
        ))}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: ratio * travel,
            width: KNOB, height: KNOB, borderRadius: radius.pill,
            alignItems: 'center', justifyContent: 'center',
            backgroundColor: color.control.knob,
            borderWidth: 3, borderColor: band.fill,
          }}
        >
          <DrainFace level={value} size={28} />
        </View>
      </View>

      <Stack direction="row" justify="between">
        <Text variant="footnote" tone="subtle">Fine, honestly</Text>
        <Text variant="footnote" tone="subtle">Can’t face it</Text>
      </Stack>
    </Stack>
  );
}
