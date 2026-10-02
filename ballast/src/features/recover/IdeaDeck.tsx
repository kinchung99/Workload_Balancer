import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, PanResponder, View } from 'react-native';
import { Button, Chip, Stack, Text } from '@/components';
import { color, radius } from '@design/tokens';
import { GIVES_BACK } from '@/lib/rest';
import { tapFeedback } from '@/lib/haptics';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { Prescription } from '@/lib/types';

/** Far enough that a swipe was meant, not a scroll that wandered. */
const THRESHOLD = 90;

/**
 * What might help, one card at a time.
 *
 * A list of four suggestions gets read once and ignored; a card you can swipe
 * past gets a second and a third look, which is how somebody tired finds the
 * one they would actually do. Swipe left (or tap "Another idea") for the next,
 * right to take this one. Two cards peek out behind, so it is obvious there is
 * always another.
 */
export function IdeaDeck({
  entry,
  label,
  loading,
  onNext,
  onPick,
}: {
  entry: Prescription | null;
  /** "BEST FIT", "IDEA 2 OF 5" - where in the deck this one sits. */
  label: string;
  loading: boolean;
  onNext: () => void;
  onPick: () => void;
}) {
  const reduce = useReducedMotion();
  const x = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;
  const live = useRef({ onNext, onPick });
  live.current = { onNext, onPick };
  const [height, setHeight] = useState(0);

  /** Slide the card off one side, then hand over to whoever decides what comes next. */
  const leave = (direction: -1 | 1, then: () => void) => {
    tapFeedback();
    if (reduce) { then(); return; }
    Animated.parallel([
      Animated.timing(x, { toValue: direction * 420, duration: 200, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      Animated.timing(fade, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      then();
      if (direction === 1) {
        // Picked: bring it straight back, it is still the one on screen.
        x.setValue(0);
        fade.setValue(1);
      }
    });
  };

  // A new card arrives from the right.
  useEffect(() => {
    if (!entry) return;
    if (reduce) { x.setValue(0); fade.setValue(1); return; }
    x.setValue(60);
    fade.setValue(0);
    Animated.parallel([
      Animated.spring(x, { toValue: 0, friction: 7, tension: 90, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
  }, [entry?.id, reduce, x, fade]);

  const pan = useRef(
    PanResponder.create({
      // Only a sideways drag is a swipe; up and down still scroll the page.
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderMove: (_e, g) => x.setValue(g.dx),
      onPanResponderRelease: (_e, g) => {
        if (g.dx < -THRESHOLD) leave(-1, () => live.current.onNext());
        else if (g.dx > THRESHOLD) leave(1, () => live.current.onPick());
        else Animated.spring(x, { toValue: 0, friction: 6, useNativeDriver: true }).start();
      },
      onPanResponderTerminate: () => Animated.spring(x, { toValue: 0, useNativeDriver: true }).start(),
    }),
  ).current;

  const tilt = x.interpolate({ inputRange: [-300, 0, 300], outputRange: ['-12deg', '0deg', '12deg'] });
  const nope = x.interpolate({ inputRange: [-120, -30, 0], outputRange: [1, 0, 0], extrapolate: 'clamp' });
  const yes = x.interpolate({ inputRange: [0, 30, 120], outputRange: [0, 0, 1], extrapolate: 'clamp' });

  return (
    <Stack gap={4}>
      {/* Room underneath for the two cards behind to show. */}
      <View style={{ minHeight: (height || 280) + 20 }}>
        {/* The deck behind: decoration, so it is plain that there is always another. */}
        {height ? (
          <>
            <View
              pointerEvents="none"
              style={{
                position: 'absolute', top: 18, left: 18, right: 18, height,
                borderRadius: radius.xl, backgroundColor: color.decor.lilac, opacity: 0.55,
                transform: [{ rotate: '4deg' }],
              }}
            />
            <View
              pointerEvents="none"
              style={{
                position: 'absolute', top: 9, left: 9, right: 9, height,
                borderRadius: radius.xl, backgroundColor: color.decor.mint, opacity: 0.7,
                transform: [{ rotate: '-3deg' }],
              }}
            />
          </>
        ) : null}

        {loading || !entry ? (
          <Skeleton />
        ) : (
          <Animated.View
            {...pan.panHandlers}
            onLayout={(event) => setHeight(event.nativeEvent.layout.height)}
            accessible
            accessibilityRole="summary"
            accessibilityLabel={`${label}. ${entry.title}. ${entry.detail}`}
            style={{ opacity: fade, transform: [{ translateX: x }, { rotate: tilt }] }}
          >
            <View className="gap-4 rounded-xl border-2 p-5" style={{ backgroundColor: color.band.recovery.wash, borderColor: color.band.recovery.fill }}>
              <Stack direction="row" justify="between" align="center">
                <Text variant="micro" tone="recovery">{label}</Text>
                <View className="rounded-pill bg-raised px-3 py-1">
                  <Text variant="micro" tone="recovery">{GIVES_BACK[entry.refills]}</Text>
                </View>
              </Stack>
              <Stack direction="row" gap={4} align="center">
                <View className="items-center justify-center rounded-pill bg-raised" style={{ width: 72, height: 72 }}>
                  <Text variant="display">{entry.emoji ?? '🌿'}</Text>
                </View>
                <Text variant="title" className="flex-1">{entry.title}</Text>
              </Stack>
              <Text variant="callout" tone="muted">{entry.detail}</Text>
              {entry.tags?.length ? (
                <Stack direction="row" gap={2} wrap>
                  {entry.tags.map((tag) => <Chip key={tag} label={tag} readOnly />)}
                </Stack>
              ) : null}
            </View>
            {/* What a swipe means, shown while you make it. */}
            <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 16, right: 16, opacity: nope }}>
              <View className="rounded-pill px-3 py-1" style={{ backgroundColor: color.surface.inverse }}>
                <Text variant="micro" tone="inverse">ANOTHER ↻</Text>
              </View>
            </Animated.View>
            <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 16, left: 16, opacity: yes }}>
              <View className="rounded-pill px-3 py-1" style={{ backgroundColor: color.band.steady.fill }}>
                <Text variant="micro" tone="inverse">THIS ONE ✓</Text>
              </View>
            </Animated.View>
          </Animated.View>
        )}
      </View>

      <Stack direction="row" gap={3} align="center">
        <Button
          label="↻ Another idea"
          kind="secondary"
          className="flex-1"
          disabled={loading || !entry}
          onPress={() => leave(-1, onNext)}
        />
      </Stack>
    </Stack>
  );
}

function Skeleton() {
  const pulse = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0.5, duration: 600, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <Animated.View
      accessibilityLabel="Finding ideas"
      accessibilityLiveRegion="polite"
      className="gap-4 rounded-xl p-5"
      style={{ minHeight: 260, opacity: pulse, backgroundColor: color.band.recovery.wash }}
    >
      <View className="rounded-pill" style={{ width: 72, height: 72, backgroundColor: color.surface.page }} />
      <View className="rounded-pill" style={{ width: '70%', height: 18, backgroundColor: color.surface.page }} />
      <View className="rounded-pill" style={{ width: '90%', height: 12, backgroundColor: color.surface.page }} />
      <View className="rounded-pill" style={{ width: '60%', height: 12, backgroundColor: color.surface.page }} />
      <Text variant="footnote" tone="muted">Claude is thinking about what would help…</Text>
    </Animated.View>
  );
}
