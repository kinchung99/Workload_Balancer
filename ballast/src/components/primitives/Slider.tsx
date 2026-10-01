/**
 * Control / Slider.
 *
 * Built rather than installed: it needs to be draggable *and* tappable *and*
 * usable by a screen reader, and it needs to look like the rest of the system.
 * Sixty lines is cheaper than a dependency that does two of those three.
 */
import { useRef, useState } from 'react';
import { PanResponder, Pressable, View } from 'react-native';
import { color, target } from '@design/tokens';
import { tapFeedback } from '@/lib/haptics';

export interface SliderProps {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  /** Colours the filled portion. Recovery reads blue, cost reads red. */
  tone?: 'steady' | 'heavy' | 'neutral';
  label: string;
  readout: string;
}

const KNOB = 28;

const TRACK_FILL = {
  steady: color.band.steady.fill,
  heavy: color.band.heavy.fill,
  neutral: color.ink.muted,
} as const;

export function Slider({ value, min, max, step, onChange, tone = 'neutral', label, readout }: SliderProps) {
  const [width, setWidth] = useState(0);
  const widthRef = useRef(0);

  const quantise = (raw: number) => {
    const clamped = Math.max(min, Math.min(max, raw));
    return Math.round(clamped / step) * step;
  };

  const lastRef = useRef(value);
  // Same trap as the area dial: the gesture is created once, so it must read
  // the current props through a ref rather than closing over the first ones.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const valueRef = useRef(value);
  valueRef.current = value;
  /** Ticks once per notch crossed, not once per pixel of drag. */
  const emit = (next: number) => {
    if (next !== lastRef.current) {
      lastRef.current = next;
      tapFeedback();
    }
    return next;
  };

  /**
   * The knob is 28pt wide and stays inside the track, so its centre travels
   * width - 28. Mapping `x / width` instead left the top notch half a knob past
   * the right edge.
   */
  const fromX = (x: number) => {
    if (widthRef.current <= 0) return valueRef.current;
    const travel = Math.max(1, widthRef.current - KNOB);
    return emit(quantise(min + ((x - KNOB / 2) / travel) * (max - min)));
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => onChangeRef.current(fromX(event.nativeEvent.locationX)),
      onPanResponderMove: (event) => onChangeRef.current(fromX(event.nativeEvent.locationX)),
    }),
  ).current;

  const ratio = max === min ? 0 : (value - min) / (max - min);
  const travel = Math.max(0, width - KNOB);

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: readout }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'increment') onChange(quantise(value + step));
        if (event.nativeEvent.actionName === 'decrement') onChange(quantise(value - step));
      }}
      // 44pt of grabbable height around a 6pt track.
      className="justify-center"
      style={{ height: target.min }}
      onLayout={(event) => {
        widthRef.current = event.nativeEvent.layout.width;
        setWidth(event.nativeEvent.layout.width);
      }}
      {...pan.panHandlers}
    >
      <View className="h-2 w-full rounded-pill bg-track" />
      <View
        pointerEvents="none"
        style={{ position: 'absolute', height: 8, width: ratio * travel + KNOB / 2, backgroundColor: TRACK_FILL[tone], borderRadius: 999 }}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: ratio * travel,
          height: KNOB, width: KNOB, borderRadius: 999,
          backgroundColor: color.control.knob,
          borderWidth: 2, borderColor: TRACK_FILL[tone],
        }}
      />
    </View>
  );
}

/** Tap targets either side, for anyone who would rather not drag. */
export function SliderStepper({ onStep }: { onStep: (direction: -1 | 1) => void }) {
  return (
    <View className="flex-row gap-2">
      {([-1, 1] as const).map((direction) => (
        <Pressable
          key={direction}
          accessibilityRole="button"
          accessibilityLabel={direction === 1 ? 'Increase' : 'Decrease'}
          onPress={() => onStep(direction)}
          className="min-h-min min-w-min items-center justify-center rounded-pill border border-line-hairline"
        />
      ))}
    </View>
  );
}
