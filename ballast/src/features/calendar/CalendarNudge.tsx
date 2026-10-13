/**
 * Home's calendar card.
 *
 * Connected, with new events: it drops in at the top with the first few of
 * them and one button to set them up. Not connected yet: one quiet line that
 * says it can be. "Later" puts the first away until tomorrow; ✕ on the second
 * puts it away for good.
 */
import { useEffect, useRef } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Stack, Sticker, Text } from '@/components';
import { color } from '@design/tokens';
import { formatShort } from '@/lib/dates';
import { formatHour } from '@/lib/schedule';
import { tapFeedback } from '@/lib/haptics';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useStore } from '@/state/store';
import type { Detected } from '@/lib/gcal';
import { useCalendar } from './useCalendar';
import { KIND_STICKER, KIND_WASH } from './EventCard';
import { NATIVE_DRIVER } from '@/lib/nativeDriver';

const SHOWN = 3;

const DAY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** "Tue 6:30pm · weekly", "Fri 21 Nov". */
function shortWhen(d: Detected): string {
  const e = d.first;
  const day = d.repeat ? DAY[d.repeat.day] : formatShort(e.date);
  const time = e.allDay || e.startHour === undefined ? '' : ` ${formatHour(e.startHour)}`;
  return `${day}${time}${d.repeat ? ' · weekly' : ''}`;
}

export function CalendarNudge() {
  const router = useRouter();
  const { calendar, picture, expired } = useCalendar();
  const today = useStore((state) => state.today);
  const later = useStore((state) => state.calendarLater);
  const laterToday = useStore((state) => state.calendarLaterToday);
  const hidePromo = () => useStore.setState({ calendarLater: 'never' });
  const reduce = useReducedMotion();
  const drop = useRef(new Animated.Value(0)).current;

  const fresh = picture.fresh;
  const showFresh = !!calendar && (fresh.length > 0 || expired) && later !== today;
  const showPromo = !calendar && later !== 'never';

  useEffect(() => {
    if (!showFresh && !showPromo) return;
    if (reduce) { drop.setValue(1); return; }
    drop.setValue(0);
    Animated.spring(drop, { toValue: 1, friction: 7, tension: 80, useNativeDriver: NATIVE_DRIVER }).start();
  }, [showFresh, showPromo, reduce, drop]);

  if (!showFresh && !showPromo) return null;
  const motion = {
    opacity: drop,
    transform: [{ translateY: drop.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }],
  };
  const go = () => { tapFeedback(); router.push('/calendar' as Href); };

  if (showPromo) {
    return (
      <Animated.View style={motion}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Connect Google Calendar"
          onPress={go}
          className="flex-row items-center gap-3 rounded-xl border-2 border-dashed border-line-strong bg-raised px-4 py-3 active:opacity-70"
        >
          <View className="items-center justify-center rounded-pill" style={{ width: 40, height: 40, backgroundColor: color.decor.sky }}>
            <Sticker name="calendar" size={26} />
          </View>
          <Stack gap={0} grow>
            <Text variant="body" weight="semibold">Bring in Google Calendar</Text>
            <Text variant="micro" tone="subtle">Classes, shifts, deadlines</Text>
          </Stack>
          <Text variant="caption" weight="bold">Connect ›</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Not now" onPress={() => { tapFeedback(); hidePromo(); }} hitSlop={10} className="pl-1" style={{ minWidth: 28, minHeight: 28, alignItems: 'center', justifyContent: 'center' }}>
            <Text variant="caption" tone="subtle">✕</Text>
          </Pressable>
        </Pressable>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={motion}>
      <Stack gap={3} className="rounded-xl px-4 py-4" style={{ backgroundColor: color.decor.cream, borderWidth: 2, borderColor: color.surface.inverse }}>
        <Stack direction="row" gap={3} align="center">
          <View className="items-center justify-center rounded-pill" style={{ width: 44, height: 44, backgroundColor: color.decor.sky }}>
            <Sticker name="calendar" size={30} wiggle />
          </View>
          <Stack gap={0} grow>
            <Text variant="heading">{expired ? 'Reconnect Google Calendar' : `${fresh.length} new from Google Calendar`}</Text>
            <Text variant="micro" tone="subtle">{expired ? 'It stopped syncing' : 'Filled in for you'}</Text>
          </Stack>
          <Pressable accessibilityRole="button" accessibilityLabel="Later" onPress={() => { tapFeedback(); laterToday(); }} hitSlop={10}>
            <Text variant="caption" weight="semibold" tone="subtle">Later</Text>
          </Pressable>
        </Stack>

        {!expired ? (
          <Stack gap={2}>
            {fresh.slice(0, SHOWN).map((d) => (
              <Stack key={d.key} direction="row" gap={3} align="center" className="overflow-hidden rounded-lg bg-raised pr-3">
                <View style={{ width: 5, alignSelf: 'stretch', backgroundColor: d.first.color ?? color.line.strong }} />
                <View className="my-2 items-center justify-center rounded-md" style={{ width: 32, height: 32, backgroundColor: KIND_WASH[d.guess.kind] }}>
                  <Sticker name={KIND_STICKER[d.guess.kind]} size={22} />
                </View>
                <Text variant="callout" weight="semibold" numberOfLines={1} className="flex-1">{d.title}</Text>
                <Text variant="micro" tone="subtle">{shortWhen(d)}</Text>
              </Stack>
            ))}
            {fresh.length > SHOWN ? <Text variant="micro" tone="subtle">+{fresh.length - SHOWN} more</Text> : null}
          </Stack>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={expired ? 'Reconnect' : 'Set them up'}
          onPress={go}
          className="min-h-min items-center justify-center rounded-pill bg-inverse py-3 active:opacity-70"
        >
          <Text variant="callout" weight="bold" tone="inverse">{expired ? 'Reconnect ›' : 'Set them up ›'}</Text>
        </Pressable>
      </Stack>
    </Animated.View>
  );
}
