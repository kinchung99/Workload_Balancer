/**
 * The recharge half of the check-in, as pictures with a price on each.
 *
 * Every tile shows what it does to the battery before it is tapped - green
 * when it gives charge back, red when it costs - so each answer has a visible
 * weight either way. The chosen one keeps its number with a tick. The battery
 * card at the top keeps the score: what this visit changed, and how much is
 * still there to collect.
 */
import { useEffect, useRef } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { Mascot, Stack, Text } from '@/components';
import { color, radius, space } from '@design/tokens';
import { gainLabel, signedLabel } from '@/lib/checkin';
import { tapFeedback } from '@/lib/haptics';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { BandName, MealStatus, MoodQuadrant } from '@/lib/types';
import { NATIVE_DRIVER } from '@/lib/nativeDriver';

/** Hours slept, as faces. */
export const SLEEP = [
  { id: 5, emoji: '🥱', text: '5h' },
  { id: 6, emoji: '😪', text: '6h' },
  { id: 7, emoji: '🙂', text: '7h' },
  { id: 8, emoji: '😴', text: '8h' },
  { id: 9, emoji: '💤', text: '9h+' },
];
/** How you ate today. */
export const ATE: Array<{ id: MealStatus; emoji: string; text: string }> = [
  { id: 'filling', emoji: '🍱', text: 'Properly' },
  { id: 'light', emoji: '🥪', text: 'A bit' },
  { id: 'skipped', emoji: '🚫', text: 'Skipped' },
];
export const QUADRANTS: MoodQuadrant[] = ['high-pleasant', 'low-pleasant', 'high-unpleasant', 'low-unpleasant'];

/** "+3%" in green, "−2%" in red, "±0%" in grey - filled, with a tick, once chosen. */
export function GainPill({ gain, done = false }: { gain: number; done?: boolean }) {
  const rounded = Math.round(gain);
  const band = rounded > 0 ? color.band.steady : rounded < 0 ? color.band.heavy : null;
  const tone = rounded > 0 ? 'steady' : rounded < 0 ? 'heavy' : 'subtle';
  return (
    <View
      className="items-center justify-center rounded-pill"
      style={{
        height: 22, paddingHorizontal: 8,
        backgroundColor: done ? (band?.fill ?? color.ink.subtle) : (band?.wash ?? color.surface.sunken),
      }}
    >
      <Text variant="micro" tone={done ? 'inverse' : tone} numberOfLines={1}>{done ? '✓ ' : ''}{signedLabel(gain)}</Text>
    </View>
  );
}

/** The score: the battery, what this visit added, and what is left to collect. */
export function BatteryCard({ charge, overall, added, left }: { charge: number; overall: number; added: number; left: number }) {
  return (
    <View className="overflow-hidden" style={{ borderRadius: radius.xl, backgroundColor: color.decor.mint }}>
      <Stack direction="row" gap={4} align="center" className="px-4 py-4">
        <Mascot charge={charge} loadPercent={overall} size={92} />
        <Stack gap={1} grow>
          <Text variant="micro" tone="steady">YOUR BATTERY</Text>
          <Stack direction="row" gap={2} align="center" wrap>
            <Text variant="display">{charge}%</Text>
            {Math.abs(added) >= 0.5 ? (
              <View className="rounded-pill px-3 py-1" style={{ backgroundColor: added > 0 ? color.band.steady.fill : color.band.heavy.fill }}>
                <Text variant="caption" weight="bold" tone="inverse">{added > 0 ? '⚡' : '🪫'}{signedLabel(added)}</Text>
              </View>
            ) : null}
          </Stack>
          {gainLabel(left) ? (
            <Text variant="footnote" weight="semibold">🎯 Up to {gainLabel(left)} to collect</Text>
          ) : (
            <Text variant="footnote" weight="semibold">✨ All collected</Text>
          )}
        </Stack>
      </Stack>
    </View>
  );
}

const MOODS: Array<{ id: MoodQuadrant; emoji: string; word: string; band: BandName }> = [
  { id: 'high-unpleasant', emoji: '😣', word: 'Stressed', band: 'busy' },
  { id: 'high-pleasant', emoji: '😄', word: 'Buzzing', band: 'steady' },
  { id: 'low-unpleasant', emoji: '😔', word: 'Drained', band: 'heavy' },
  { id: 'low-pleasant', emoji: '😌', word: 'Calm', band: 'recovery' },
];

/** Four faces in a square: energy up the side, pleasant to the right. */
export function MoodTiles({
  value, gains, onPick,
}: { value: MoodQuadrant | null; gains: Record<MoodQuadrant, number>; onPick: (quadrant: MoodQuadrant) => void }) {
  return (
    <Stack gap={2}>
      {[MOODS.slice(0, 2), MOODS.slice(2)].map((row, index) => (
        <Stack key={index} direction="row" gap={2}>
          {row.map((mood) => {
            const on = value === mood.id;
            const tint = color.band[mood.band];
            return (
              <Pressable
                key={mood.id}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={mood.word}
                onPress={() => { tapFeedback(); onPick(mood.id); }}
                className="flex-1 items-center justify-center gap-1 active:opacity-70"
                style={{
                  height: 112, borderRadius: radius.lg, backgroundColor: tint.wash,
                  borderWidth: 2, borderColor: on ? tint.fill : 'transparent',
                }}
              >
                <Text variant="display" style={{ transform: [{ scale: on ? 1.12 : 1 }] }}>{mood.emoji}</Text>
                <Text variant="caption" weight="bold" tone={mood.band}>{mood.word}</Text>
                <GainPill gain={gains[mood.id]} done={on} />
              </Pressable>
            );
          })}
        </Stack>
      ))}
    </Stack>
  );
}

/** A row of picture tiles - hours slept, how you ate. */
export function TileRow<T extends string | number>({
  label, options, value, gains, onPick,
}: {
  label: string;
  options: Array<{ id: T; emoji: string; text: string }>;
  value: T | null;
  gains: Record<string, number>;
  onPick: (id: T) => void;
}) {
  return (
    <Stack gap={2} className="rounded-lg bg-raised px-3 py-3">
      <Text variant="caption" weight="semibold">{label}</Text>
      <Stack direction="row" gap={2}>
        {options.map((option) => {
          const on = value === option.id;
          return (
            <Pressable
              key={String(option.id)}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${label} ${option.text}`}
              onPress={() => { tapFeedback(); onPick(option.id); }}
              className="flex-1 items-center gap-1 py-2 active:opacity-70"
              style={{
                borderRadius: radius.md,
                backgroundColor: on ? color.decor.cream : color.surface.sunken,
                borderWidth: 2, borderColor: on ? color.ink.default : 'transparent',
              }}
            >
              <Text variant="title">{option.emoji}</Text>
              <Text variant="caption" weight="bold" numberOfLines={1}>{option.text}</Text>
              <GainPill gain={gains[String(option.id)] ?? 0} done={on} />
            </Pressable>
          );
        })}
      </Stack>
    </Stack>
  );
}

/** Good moments, two to a row; each can be tapped again, worth a little less each time. */
export function MomentGrid({
  kinds, counts, gains, onTap,
}: {
  kinds: Array<{ id: string; emoji: string; label: string }>;
  counts: Record<string, number>;
  gains: Record<string, number>;
  onTap: (id: string) => void;
}) {
  const rows: Array<typeof kinds> = [];
  for (let i = 0; i < kinds.length; i += 2) rows.push(kinds.slice(i, i + 2));
  return (
    <Stack gap={2}>
      {rows.map((row) => (
        <Stack key={row[0].id} direction="row" gap={2}>
          {row.map((kind) => {
            const count = counts[kind.id] ?? 0;
            return (
              <Pressable
                key={kind.id}
                accessibilityRole="button"
                accessibilityLabel={kind.label}
                onPress={() => { tapFeedback(); onTap(kind.id); }}
                className="flex-1 flex-row items-center gap-2 px-3 py-3 active:opacity-70"
                style={{
                  borderRadius: radius.lg, backgroundColor: color.surface.raised,
                  borderWidth: 2, borderColor: count ? color.band.steady.fill : color.line.hairline,
                }}
              >
                <View>
                  <View className="items-center justify-center rounded-pill" style={{ width: 42, height: 42, backgroundColor: color.decor.cream }}>
                    <Text variant="title">{kind.emoji}</Text>
                  </View>
                  {count ? (
                    <View
                      className="absolute items-center justify-center rounded-pill"
                      style={{ top: -4, left: -6, minWidth: 20, height: 20, paddingHorizontal: 4, backgroundColor: color.band.steady.fill }}
                    >
                      <Text variant="micro" tone="inverse">×{count}</Text>
                    </View>
                  ) : null}
                </View>
                <Stack gap={1} grow>
                  <Text variant="caption" weight="semibold" numberOfLines={2}>{kind.label}</Text>
                  <View className="self-start"><GainPill gain={gains[kind.id] ?? 0} /></View>
                </Stack>
              </Pressable>
            );
          })}
          {row.length === 1 ? <View className="flex-1" /> : null}
        </Stack>
      ))}
    </Stack>
  );
}

/** "+3% ⚡" popping up over the Done button, then away. */
export function GainToast({ text, stamp, down = false }: { text: string | null; stamp: number; down?: boolean }) {
  const reduce = useReducedMotion();
  const pop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!text) return;
    if (reduce) { pop.setValue(1); return; }
    pop.setValue(0);
    Animated.sequence([
      Animated.spring(pop, { toValue: 1, friction: 5, tension: 160, useNativeDriver: NATIVE_DRIVER }),
      Animated.delay(1100),
      Animated.timing(pop, { toValue: 0, duration: 220, useNativeDriver: NATIVE_DRIVER }),
    ]).start();
  }, [text, stamp, reduce, pop]);

  if (!text) return null;
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      accessibilityLabel={text}
      // Styles, not classes: an Animated.View is not one NativeWind dresses.
      style={{
        position: 'absolute', top: -60, alignSelf: 'center',
        borderRadius: radius.pill, paddingHorizontal: space[6], paddingVertical: space[3],
        backgroundColor: down ? color.band.heavy.fill : color.band.steady.fill, opacity: pop,
        transform: [{ translateY: pop.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }, { scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }],
      }}
    >
      <Text variant="callout" weight="bold" tone="inverse">{text}</Text>
    </Animated.View>
  );
}
