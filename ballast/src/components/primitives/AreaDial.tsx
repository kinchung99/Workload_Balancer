/**
 * Control / Area dial — "how much of you does this take?", five times over.
 *
 * The model's oldest simplification was one bucket per task. A group
 * presentation is not "mental": it is heavy mental, real time, and a social
 * cost most people would never have thought to name. Filing it under one
 * heading is how a week reads sixty percent while the person is finished.
 *
 * So this asks five small questions instead of one big one, and answers them
 * with a face rather than a number — drag right and the little character on the
 * knob gets more overwhelmed. Nobody has to learn what "dread 4" means to know
 * what that face is doing.
 *
 * Colour discipline: the hue here is the AREA's identity, the same hue as its
 * icon and its tile, and it never appears on a reading. The load this produces
 * is still shown in band colour, which is the only colour in Ballast that
 * carries a value.
 */
import { useRef, useState } from 'react';
import { PanResponder, Pressable, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';
import { color, radius, target } from '@design/tokens';
import { BUCKET_LABEL, MIX_MAX, MIX_WORD, notchAt } from '@/lib/load';
import { tapFeedback } from '@/lib/haptics';
import type { BucketKey } from '@/lib/types';
import { AreaIcon } from './AreaIcon';
import { Stack } from './Stack';
import { Text } from './Text';

const INK = color.ink.default;

/** Knob diameter. The track's usable travel is the width minus this. */
const KNOB = 34;

/**
 * The knob's face, nought to five.
 *
 * Strained, never scolded: this is the face of the TASK, not of the student, so
 * "this one flattens me" is allowed to look flattened. There is nothing here
 * that reads as disapproval of the person holding the phone.
 */
export function DrainFace({ level, size = 26 }: { level: number; size?: number }) {
  const v = Math.max(0, Math.min(MIX_MAX, Math.round(level)));
  const line = { stroke: INK, strokeWidth: 1.7, strokeLinecap: 'round', fill: 'none' } as const;

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {/* Eyes */}
      {v === 0 ? (
        <G>
          <Path d="M7 11.5q1.8-2 3.6 0" {...line} />
          <Path d="M13.4 11.5q1.8-2 3.6 0" {...line} />
        </G>
      ) : v === MIX_MAX ? (
        <G>
          {/* Dizzy spirals, the cartoon shorthand for "that one finished me". */}
          <Path d="M10.6 11.2a1.9 1.9 0 1 0-1.9 1.9 1.3 1.3 0 0 0 1.3-1.3" {...line} strokeWidth={1.5} />
          <Path d="M17 11.2a1.9 1.9 0 1 0-1.9 1.9 1.3 1.3 0 0 0 1.3-1.3" {...line} strokeWidth={1.5} />
        </G>
      ) : (
        <G>
          <Ellipse cx={8.8} cy={11.2} rx={1.5} ry={v >= 4 ? 2.1 : 1.5} fill={INK} />
          <Ellipse cx={15.2} cy={11.2} rx={1.5} ry={v >= 4 ? 2.1 : 1.5} fill={INK} />
        </G>
      )}

      {/* Mouth */}
      {v <= 1 ? (
        <Path d="M9 16q3 2.6 6 0" {...line} />
      ) : v === 2 ? (
        <Path d="M9.8 16.4q2.2 1.5 4.4 0" {...line} />
      ) : v === 3 ? (
        <Path d="M9.8 16.6h4.4" {...line} />
      ) : (
        <Ellipse cx={12} cy={16.6} rx={2.1} ry={v === MIX_MAX ? 2.4 : 1.7} fill={INK} />
      )}

      {/* One bead of sweat once it starts to hurt. */}
      {v >= 4 ? (
        <Path d="M19 8.4c1.4 1.8 1.4 2.6.7 3.2-.7.6-1.7.2-1.9-.7-.1-.7.4-1.6 1.2-2.5z" fill={color.decor.sky} stroke={INK} strokeWidth={1.1} />
      ) : null}

      {/* Cheeks while it is still pleasant. */}
      {v <= 1 ? (
        <G>
          <Ellipse cx={5.6} cy={14.6} rx={1.8} ry={1.1} fill={color.decor.blush} opacity={0.8} />
          <Ellipse cx={18.4} cy={14.6} rx={1.8} ry={1.1} fill={color.decor.blush} opacity={0.8} />
        </G>
      ) : null}
    </Svg>
  );
}

export function AreaDial({
  area,
  value,
  onChange,
}: {
  area: BucketKey;
  value: number;
  onChange: (next: number) => void;
}) {
  const [width, setWidth] = useState(0);
  const widthRef = useRef(0);
  const lastRef = useRef(value);
  const hue = color.area[area];

  /**
   * The gesture is built once; the props are not.
   *
   * `PanResponder.create` runs on the first render only, so a handler that
   * closes over `onChange` keeps calling the FIRST render's version of it
   * forever. That callback still held the first render's copy of the mix, so
   * dragging any dial wrote `{...mixAsItWasAtMount, thisArea: value}` and reset
   * the other four to nought. Reading both through refs keeps one stable
   * gesture pointed at the current props.
   */
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const valueRef = useRef(value);
  valueRef.current = value;

  const emit = (next: number) => {
    if (next !== lastRef.current) {
      lastRef.current = next;
      tapFeedback();
    }
    return next;
  };

  const fromX = (x: number) => {
    if (widthRef.current <= 0) return valueRef.current;
    return emit(notchAt(x, widthRef.current, KNOB));
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => onChangeRef.current(fromX(event.nativeEvent.locationX)),
      onPanResponderMove: (event) => onChangeRef.current(fromX(event.nativeEvent.locationX)),
    }),
  ).current;

  const ratio = value / MIX_MAX;
  const knobSize = KNOB;
  const travel = Math.max(0, width - knobSize);
  const on = value > 0;

  return (
    <View className="rounded-md border border-line-hairline bg-raised p-4">
      <Stack gap={3}>
        <Stack direction="row" align="center" gap={3}>
          {/* Identity badge. Hue = which area, never how much. */}
          <View
            className="items-center justify-center rounded-pill"
            style={{ width: 34, height: 34, backgroundColor: hue.wash, borderWidth: on ? 2 : 1, borderColor: on ? hue.ink : color.line.hairline }}
          >
            <AreaIcon area={area} size={19} />
          </View>
          <Text variant="body" weight="semibold" className="flex-1">{BUCKET_LABEL[area]}</Text>
          <Text variant="caption" tone={on ? 'default' : 'subtle'}>{MIX_WORD[value]}</Text>
        </Stack>

        {/* The track. Drag it, or tap any point on it. */}
        <View
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={`${BUCKET_LABEL[area]}, how much this takes out of you`}
          accessibilityValue={{ text: `${MIX_WORD[value]}, ${value} of ${MIX_MAX}` }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(event) => {
            const step = (next: number) => Math.max(0, Math.min(MIX_MAX, next));
            if (event.nativeEvent.actionName === 'increment') onChange(step(value + 1));
            if (event.nativeEvent.actionName === 'decrement') onChange(step(value - 1));
          }}
          className="justify-center"
          style={{ height: target.min }}
          onLayout={(event) => {
            widthRef.current = event.nativeEvent.layout.width;
            setWidth(event.nativeEvent.layout.width);
          }}
          {...pan.panHandlers}
        >
          <View style={{ height: 12, borderRadius: radius.pill, backgroundColor: hue.wash }} />
          <View
            pointerEvents="none"
            style={{ position: 'absolute', height: 12, width: knobSize / 2 + ratio * travel, borderRadius: radius.pill, backgroundColor: hue.ink, opacity: on ? 1 : 0 }}
          />
          {/* Six notches, so the scale is visible before you touch it. */}
          {Array.from({ length: MIX_MAX + 1 }, (_, notch) => (
            <View
              key={notch}
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: knobSize / 2 - 2.5 + (notch / MIX_MAX) * travel,
                width: 5, height: 5, borderRadius: radius.pill,
                backgroundColor: notch <= value && on ? color.surface.page : hue.ink,
                opacity: notch <= value && on ? 0.75 : 0.3,
              }}
            />
          ))}
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: ratio * travel,
              width: knobSize, height: knobSize, borderRadius: radius.pill,
              alignItems: 'center', justifyContent: 'center',
              backgroundColor: color.control.knob,
              borderWidth: 2, borderColor: on ? hue.ink : color.line.strong,
            }}
          >
            <DrainFace level={value} />
          </View>
        </View>
      </Stack>
    </View>
  );
}

/** Tap targets for anyone who would rather not drag at all. */
export function DialStepper({ value, onChange }: { value: number; onChange: (next: number) => void }) {
  return (
    <Stack direction="row" gap={2}>
      {([-1, 1] as const).map((step) => (
        <Pressable
          key={step}
          accessibilityRole="button"
          accessibilityLabel={step === 1 ? 'More' : 'Less'}
          onPress={() => { tapFeedback(); onChange(Math.max(0, Math.min(MIX_MAX, value + step))); }}
          className="min-h-min min-w-min items-center justify-center rounded-pill border border-line-hairline bg-sunken"
        >
          <Text variant="body" weight="semibold">{step === 1 ? '+' : '−'}</Text>
        </Pressable>
      ))}
    </Stack>
  );
}
