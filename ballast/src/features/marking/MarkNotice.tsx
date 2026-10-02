/**
 * The notification that slides in when something is over and nobody has said
 * how it went.
 *
 * One thing at a time, answered in one tap, the way a phone notification is:
 * "Operating Systems lecture ended at 11am. Did you sign in?" - Signed in /
 * Didn't attend. Answer it and the next one slides in; "Later" puts them all
 * away until the app is next opened, and left alone it tucks itself away after
 * a few seconds - the same things wait in "To mark" below. Anything still
 * unanswered tomorrow is marked done for you, so ignoring this costs nothing.
 */
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { Sticker, Text } from '@/components';
import { color, radius } from '@design/tokens';
import { addDays } from '@/lib/dates';
import { formatHour } from '@/lib/schedule';
import { KIND, markKind } from '@/lib/marking';
import { successFeedback, tapFeedback } from '@/lib/haptics';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useStore } from '@/state/store';
import type { Item } from '@/lib/types';

export function MarkNotice({ due, onOpen }: { due: Item[]; onOpen: (item: Item) => void }) {
  const { markItem, moveItem, snoozeMarks, marksSnoozed, today } = useStore();
  const [tucked, setTucked] = useState<string | null>(null);
  const item = marksSnoozed ? undefined : due[0];
  const reduceMotion = useReducedMotion();
  const drop = useRef(new Animated.Value(-200)).current;

  // Slides in a beat after the screen settles, and again for each next one;
  // left alone, slides back up after a few seconds.
  useEffect(() => {
    if (!item) return;
    drop.setValue(reduceMotion ? 0 : -200);
    const show = setTimeout(() => {
      if (!reduceMotion) Animated.spring(drop, { toValue: 0, useNativeDriver: true, friction: 8, tension: 60 }).start();
    }, 600);
    const hide = setTimeout(() => {
      if (reduceMotion) { setTucked(item.id); return; }
      Animated.timing(drop, { toValue: -200, duration: 260, useNativeDriver: true }).start(() => setTucked(item.id));
    }, 9000);
    return () => { clearTimeout(show); clearTimeout(hide); };
  }, [item?.id, drop, reduceMotion]);

  if (!item || tucked === item.id) return null;
  const kind = markKind(item);
  const info = KIND[kind];
  const ended = item.startHour !== undefined ? formatHour(item.startHour + item.hours) : null;

  const answer = (run: () => void) => {
    run();
    successFeedback();
  };

  const actions: Array<{ label: string; tone: 'steady' | 'plain'; run: () => void }> =
    info.answer === 'progress'
      ? [
          { label: `✓ ${info.yes}`, tone: 'steady', run: () => answer(() => markItem(item.id, 'done')) },
          { label: '◐ Some', tone: 'plain', run: () => { tapFeedback(); onOpen(item); } },
        ]
      : info.answer === 'errand'
        ? [
            { label: `✓ ${info.yes}`, tone: 'steady', run: () => answer(() => markItem(item.id, 'done')) },
            { label: '↪ Tomorrow', tone: 'plain', run: () => answer(() => moveItem(item.id, addDays(today, 1))) },
          ]
        : [
            { label: `✓ ${info.yes}`, tone: 'steady', run: () => answer(() => markItem(item.id, 'done')) },
            { label: `✕ ${info.no}`, tone: 'plain', run: () => answer(() => markItem(item.id, 'missed')) },
          ];

  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      className="mx-3 self-stretch"
      style={{ transform: [{ translateY: drop }] }}
    >
      <View
        className="gap-3 border border-line-hairline bg-raised px-4 py-3"
        style={{
          borderRadius: radius.xl,
          shadowColor: color.ink.default, shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 8 },
          elevation: 8,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${item.title}${ended ? ` ended at ${ended}` : ''}. ${info.question}`}
          onPress={() => { tapFeedback(); onOpen(item); }}
          className="flex-row items-center gap-3 active:opacity-70"
        >
          {/* The app's own icon, the way a notification carries one. */}
          <View className="items-center justify-center" style={{ width: 40, height: 40, borderRadius: radius.md, backgroundColor: color.decor.mint }}>
            <Sticker name="battery" size={28} />
          </View>
          <View className="flex-1 gap-1">
            <View className="flex-row items-center justify-between">
              <Text variant="micro" tone="subtle">BALLAST · NOW</Text>
              {due.length > 1 ? <Text variant="micro" tone="subtle">1 of {due.length}</Text> : null}
            </View>
            <Text variant="callout" weight="semibold" numberOfLines={1}>
              {info.emoji} {item.title}{ended ? ` · ended ${ended}` : ''}
            </Text>
            <Text variant="footnote" tone="muted">{info.question}</Text>
          </View>
        </Pressable>

        <View className="flex-row gap-2">
          {actions.map((action) => (
            <Pressable
              key={action.label}
              accessibilityRole="button"
              accessibilityLabel={action.label.replace(/^[^\w]+/, '')}
              onPress={action.run}
              className={`min-h-min flex-1 items-center justify-center rounded-pill border-2 px-2 py-2 active:opacity-70 ${
                action.tone === 'steady' ? 'border-steady-fill bg-steady-fill' : 'border-line-hairline bg-sunken'
              }`}
            >
              <Text variant="caption" weight="bold" tone={action.tone === 'steady' ? 'inverse' : 'default'} numberOfLines={1}>
                {action.label}
              </Text>
            </Pressable>
          ))}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Later"
            onPress={() => { tapFeedback(); snoozeMarks(); }}
            className="min-h-min items-center justify-center rounded-pill px-3 py-2 active:opacity-60"
          >
            <Text variant="caption" weight="semibold" tone="subtle">Later</Text>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}
