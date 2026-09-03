/**
 * Data / Item row — one thing you are carrying.
 *
 * Dread is visible on every row, which is how the app knows a twenty-minute
 * errand is not the thing crushing you even though both are "a task". The row
 * announces itself to a screen reader as a sentence rather than as four
 * unconnected labels.
 */
import { Pressable, View } from 'react-native';
import { COMMITMENT_LABEL, loadOf } from '@/lib/load';
import type { Item } from '@/lib/types';
import { DreadDots } from './DreadDots';
import { Stack } from './Stack';
import { Text } from './Text';

function meta(item: Item): string {
  const hours = item.hours < 1 ? `${Math.round(item.hours * 60)}m` : `${item.hours}h`;
  return [hours, item.when ?? COMMITMENT_LABEL[item.commitment].toLowerCase()].join(', ');
}

export function ItemRow({ item, onPress }: { item: Item; onPress?: () => void }) {
  const body = (
    <Stack direction="row" gap={4} align="center" justify="between" className="min-h-row py-4">
      <Stack gap={2} grow>
        <Text variant="body" weight="semibold">{item.title}</Text>
        <Text variant="footnote" tone="subtle">{meta(item)}</Text>
      </Stack>
      <DreadDots value={item.dread} />
    </Stack>
  );

  const label = `${item.title}. ${meta(item)}. Dread ${item.dread} of 5. Load ${loadOf(item)}.`;

  if (!onPress) return <View accessible accessibilityLabel={label}>{body}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Opens this item to move, batch or decline it"
      onPress={onPress}
      className="active:opacity-70"
    >
      {body}
    </Pressable>
  );
}
