/**
 * One thing the app marked by itself the morning after: what it said, and three
 * answers - keep it, say it did not happen, or open it to change it.
 */
import { Pressable } from 'react-native';
import { MarkBadge, Stack, Text } from '@/components';
import { formatHour } from '@/lib/schedule';
import { KIND, markKind, markStatus, outcomeWord } from '@/lib/marking';
import type { Item } from '@/lib/types';

export function AutoMarkedRow({ item, today, onKeep, onMissed, onOpen }: {
  item: Item;
  today: string;
  onKeep: () => void;
  onMissed: () => void;
  onOpen: () => void;
}) {
  const info = KIND[markKind(item)];
  return (
    <Stack gap={3} className="rounded-lg border border-line-hairline bg-raised px-4 py-3">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.title}, ${outcomeWord(item) ?? ''}. Change it`}
        onPress={onOpen}
        className="flex-row items-center gap-3 active:opacity-70"
      >
        <Text variant="title">{info.emoji}</Text>
        <Stack gap={1} grow>
          <Text variant="body" weight="semibold" numberOfLines={1}>{item.title}</Text>
          <Text variant="micro" tone="muted">
            {item.startHour !== undefined ? `${formatHour(item.startHour)}–${formatHour(item.startHour + item.hours)}` : 'Any time'}
          </Text>
        </Stack>
        <MarkBadge status={markStatus(item, today, 24)} word={outcomeWord(item)} auto />
      </Pressable>
      <Stack direction="row" gap={2}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Keep: ${item.title}`}
          onPress={onKeep}
          className="min-h-min flex-1 items-center justify-center rounded-pill bg-steady-fill py-2 active:opacity-70"
        >
          <Text variant="caption" weight="bold" tone="inverse">✓ Keep</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${info.missWord}: ${item.title}`}
          onPress={onMissed}
          className="min-h-min flex-1 items-center justify-center rounded-pill border-2 border-line-hairline bg-sunken py-2 active:opacity-70"
        >
          <Text variant="caption" weight="bold">✕ {info.missWord}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Change: ${item.title}`}
          onPress={onOpen}
          className="min-h-min items-center justify-center rounded-pill border-2 border-line-hairline px-4 py-2 active:opacity-70"
        >
          <Text variant="caption" weight="bold">Change</Text>
        </Pressable>
      </Stack>
    </Stack>
  );
}
