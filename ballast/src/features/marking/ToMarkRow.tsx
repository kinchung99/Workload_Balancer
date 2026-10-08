/**
 * One class or task whose time has passed, unmarked: what it was and when,
 * and the two answers as buttons - done, or not. An errand's "not" is moving
 * it to tomorrow, because an errand that did not happen still needs doing.
 */
import { Pressable } from 'react-native';
import { Stack, Text } from '@/components';
import { addDays } from '@/lib/dates';
import { formatHour } from '@/lib/schedule';
import { KIND, markKind } from '@/lib/marking';
import { tapFeedback } from '@/lib/haptics';
import { useStore } from '@/state/store';
import type { Item } from '@/lib/types';

export function ToMarkRow({ item, today, onOpen }: { item: Item; today: string; onOpen: () => void }) {
  const { markItem, moveItem } = useStore();
  const info = KIND[markKind(item)];
  return (
    <Stack direction="row" gap={2} align="center" className="rounded-lg bg-raised py-2 pl-3 pr-2">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.title}. ${info.question}`}
        onPress={() => { tapFeedback(); onOpen(); }}
        className="min-h-min flex-1 flex-row items-center gap-3 active:opacity-70"
      >
        <Text variant="heading">{info.emoji}</Text>
        <Stack gap={1} grow>
          <Text variant="body" weight="semibold" numberOfLines={1}>{item.title}</Text>
          <Text variant="micro" tone="busy">
            ⏳ {item.startHour !== undefined ? `${formatHour(item.startHour)}–${formatHour(item.startHour + item.hours)}` : 'Earlier today'}
          </Text>
        </Stack>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${info.yes}: ${item.title}`}
        onPress={() => { markItem(item.id, 'done'); tapFeedback(); }}
        className="items-center justify-center rounded-pill bg-steady-fill active:opacity-70"
        style={{ width: 40, height: 40 }}
      >
        <Text variant="callout" weight="bold" tone="inverse">✓</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${info.answer === 'errand' ? 'Move to tomorrow' : info.no}: ${item.title}`}
        onPress={() => {
          if (info.answer === 'errand') moveItem(item.id, addDays(today, 1));
          else markItem(item.id, 'missed');
          tapFeedback();
        }}
        className="items-center justify-center rounded-pill border-2 border-line-hairline bg-sunken active:opacity-70"
        style={{ width: 40, height: 40 }}
      >
        <Text variant="callout" weight="bold" tone="muted">{info.answer === 'errand' ? '↪' : '✕'}</Text>
      </Pressable>
    </Stack>
  );
}
