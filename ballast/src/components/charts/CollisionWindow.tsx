/**
 * Data / Collision window.
 *
 * The flag used to be a list of four rows, which reads as four ordinary tasks.
 * The whole point is that they are ordinary *and* they are inside seventy-two
 * hours of each other, and only a shape shows that. Three columns, one per day,
 * with what lands on each — so the pile-up is visible rather than described.
 */
import { Pressable, View } from 'react-native';
import { DAY_LETTER, dayIndex, parseISO } from '@/lib/dates';
import { isMovable, loadOf } from '@/lib/load';
import { endHour, formatHour } from '@/lib/schedule';
import type { Collision } from '@/lib/forecast';
import type { Item } from '@/lib/types';
import { Chip } from '../primitives/Chip';
import { Stack } from '../primitives/Stack';
import { Text } from '../primitives/Text';

const EDGE = {
  hard: 'border-l-heavy-fill bg-heavy-wash',
  movable: 'border-l-busy-fill bg-busy-wash',
} as const;

export function CollisionWindow({
  collision,
  days,
  onSelectItem,
}: {
  collision: Collision;
  /** The dates the window spans, in order. */
  days: string[];
  onSelectItem?: (item: Item) => void;
}) {
  const byDay = days.map((date) => ({
    date,
    items: collision.items.filter((item) => item.date === date).sort((a, b) => (a.startHour ?? 24) - (b.startHour ?? 24)),
  }));
  const heaviest = Math.max(...byDay.map((d) => d.items.reduce((t, i) => t + loadOf(i), 0)), 1);

  return (
    <Stack gap={4}>
      <Stack direction="row" gap={2} align="stretch">
        {byDay.map((day) => {
          const load = day.items.reduce((total, item) => total + loadOf(item), 0);
          return (
            <Stack key={day.date} gap={3} className="flex-1">
              {/* Day header, with the load as a filled proportion of the worst day. */}
              <Stack gap={2} align="center" className="rounded-sm bg-heavy-wash py-2">
                <Text variant="micro" weight="bold" tone="heavy">
                  {DAY_LETTER[dayIndex(day.date)]} {parseISO(day.date).getUTCDate()}
                </Text>
                <View className="h-1 w-10 overflow-hidden rounded-pill bg-track">
                  <View className="h-1 rounded-pill bg-heavy-fill" style={{ width: `${(load / heaviest) * 100}%` }} />
                </View>
                <Text variant="micro" tone="heavy">{load} load</Text>
              </Stack>

              <Stack gap={2}>
                {day.items.map((item) => {
                  const body = (
                    <Stack gap={1} className={`rounded-sm border-l-4 px-3 py-2 ${isMovable(item) ? EDGE.movable : EDGE.hard}`}>
                      <Text variant="micro" weight="semibold" numberOfLines={2}>{item.title}</Text>
                      <Text variant="micro" tone="subtle">
                        {item.startHour === undefined
                          ? 'no slot'
                          : `${formatHour(item.startHour)}–${formatHour(endHour(item))}`}
                      </Text>
                      <Text variant="micro" tone={isMovable(item) ? 'busy' : 'heavy'}>
                        {isMovable(item) ? 'Movable' : 'Hard'}
                      </Text>
                    </Stack>
                  );
                  if (!onSelectItem) return <View key={item.id}>{body}</View>;
                  return (
                    <Pressable
                      key={item.id}
                      accessibilityRole="button"
                      accessibilityLabel={`${item.title}, ${isMovable(item) ? 'movable' : 'hard deadline'}, ${loadOf(item)} load`}
                      onPress={() => onSelectItem(item)}
                      className="active:opacity-70"
                    >
                      {body}
                    </Pressable>
                  );
                })}
                {day.items.length === 0 ? (
                  <View className="rounded-sm border border-dashed border-line-hairline px-3 py-2">
                    <Text variant="micro" tone="subtle">clear</Text>
                  </View>
                ) : null}
              </Stack>
            </Stack>
          );
        })}
      </Stack>

      <Stack direction="row" gap={4} wrap>
        <Stack direction="row" gap={2} align="center">
          <View className="h-3 w-1 rounded-pill bg-heavy-fill" />
          <Text variant="micro" tone="subtle">Hard — never suggested for moving</Text>
        </Stack>
        <Stack direction="row" gap={2} align="center">
          <View className="h-3 w-1 rounded-pill bg-busy-fill" />
          <Text variant="micro" tone="subtle">Movable — the rebalance list works on these</Text>
        </Stack>
      </Stack>
    </Stack>
  );
}
