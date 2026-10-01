import { useRef, useState } from 'react';
import { PanResponder, View } from 'react-native';
import { color, radius } from '@design/tokens';
import { DAY_END, DAY_START, formatHour, type Slot } from '@/lib/schedule';
import { tapFeedback } from '@/lib/haptics';

const KNOB = 26;
const SPAN = DAY_END - DAY_START;
const MIN_SPAN = 1;

/**
 * Two thumbs on one day: from when, until when.
 *
 * Underneath, faintly, is the time that is actually free on that day this week;
 * where the chosen hours and the free time overlap is drawn solid - which is
 * exactly what a friend will see. Grab whichever thumb is nearer your finger.
 */
export function RangeBar({
  value,
  free,
  shown,
  onChange,
  label,
}: {
  value: { start: number; end: number };
  /** Free time on this weekday this week, for context. */
  free: Slot[];
  /** What would be published with this range. */
  shown: Slot[];
  onChange: (next: { start: number; end: number }) => void;
  label: string;
}) {
  const [width, setWidth] = useState(0);
  const widthRef = useRef(0);
  const live = useRef({ value, onChange });
  live.current = { value, onChange };
  const grabbed = useRef<'start' | 'end'>('start');

  const hourAt = (x: number) => {
    const travel = Math.max(1, widthRef.current - KNOB);
    const raw = DAY_START + ((x - KNOB / 2) / travel) * SPAN;
    return Math.max(DAY_START, Math.min(DAY_END, Math.round(raw * 2) / 2));
  };

  const move = (x: number) => {
    const { value: current, onChange: emit } = live.current;
    const hour = hourAt(x);
    const next = grabbed.current === 'start'
      ? { start: Math.min(hour, current.end - MIN_SPAN), end: current.end }
      : { start: current.start, end: Math.max(hour, current.start + MIN_SPAN) };
    if (next.start !== current.start || next.end !== current.end) {
      tapFeedback();
      emit(next);
    }
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (event) => {
        const hour = hourAt(event.nativeEvent.locationX);
        const { value: current } = live.current;
        grabbed.current = Math.abs(hour - current.start) <= Math.abs(hour - current.end) ? 'start' : 'end';
        move(event.nativeEvent.locationX);
      },
      onPanResponderMove: (event) => move(event.nativeEvent.locationX),
    }),
  ).current;

  const travel = Math.max(0, width - KNOB);
  const at = (hour: number) => KNOB / 2 + ((hour - DAY_START) / SPAN) * travel;

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: `${formatHour(value.start)} to ${formatHour(value.end)}` }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) => {
        // One hour longer or shorter, from the end.
        const end = event.nativeEvent.actionName === 'increment'
          ? Math.min(DAY_END, value.end + 1)
          : Math.max(value.start + MIN_SPAN, value.end - 1);
        onChange({ start: value.start, end });
      }}
      onLayout={(event) => {
        widthRef.current = event.nativeEvent.layout.width;
        setWidth(event.nativeEvent.layout.width);
      }}
      style={{ height: 40, justifyContent: 'center' }}
      {...pan.panHandlers}
    >
      <View style={{ height: 16, marginHorizontal: KNOB / 2, borderRadius: radius.pill, backgroundColor: color.surface.sunken, overflow: 'hidden' }}>
        {free.map((slot, i) => (
          <View
            key={`f${i}`}
            pointerEvents="none"
            style={{
              position: 'absolute', top: 0, bottom: 0,
              left: ((slot.start - DAY_START) / SPAN) * travel,
              width: ((slot.end - slot.start) / SPAN) * travel,
              // Free but outside the chosen hours: visible, clearly not shared.
              backgroundColor: color.band.recovery.fill,
              opacity: 0.25,
            }}
          />
        ))}
        {shown.map((slot, i) => (
          <View
            key={`s${i}`}
            pointerEvents="none"
            style={{
              position: 'absolute', top: 0, bottom: 0,
              left: ((slot.start - DAY_START) / SPAN) * travel,
              width: ((slot.end - slot.start) / SPAN) * travel,
              backgroundColor: color.band.recovery.fill,
            }}
          />
        ))}
      </View>
      {/* The chosen range, outlined over the top. */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute', height: 24, top: 8,
          left: at(value.start), width: Math.max(0, at(value.end) - at(value.start)),
          borderRadius: radius.pill, borderWidth: 2, borderColor: color.band.recovery.ink,
        }}
      />
      {(['start', 'end'] as const).map((which) => (
        <View
          key={which}
          pointerEvents="none"
          style={{
            position: 'absolute', top: 7, left: at(value[which]) - KNOB / 2,
            width: KNOB, height: KNOB, borderRadius: radius.pill,
            backgroundColor: color.control.knob, borderWidth: 3, borderColor: color.band.recovery.ink,
          }}
        />
      ))}
    </View>
  );
}
