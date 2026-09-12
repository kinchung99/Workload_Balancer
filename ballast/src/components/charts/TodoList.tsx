/**
 * Data / Owing list — work that is owing, not work that is today.
 *
 * A deadline is not a task. An assignment due Thursday is hours spread across
 * the days before Thursday, so it sits on every day's list until it is done.
 *
 * The bar tracks three things, because they are genuinely different states:
 * done, booked into a day, and neither. Booking a sitting takes work out of the
 * unplanned part even though none of it is finished yet, and giving the sitting
 * back puts it straight in again.
 *
 * **Read-only by design.** Every card used to carry Plan it, Progress, Book
 * sittings and Push, which meant three pieces of work put a dozen buttons on a
 * screen whose job was to show you your day. Tapping a card opens `/item/[id]`,
 * where all of that lives with room to breathe.
 */
import { Pressable, View } from 'react-native';
import { composition, daysLeft, isAtRisk, percentUndone, percentUnplanned, remaining, scheduledHours, sittingsOf, unplanned } from '@/lib/prep';
import { color } from '@design/tokens';
import type { Item } from '@/lib/types';
import { Sticker } from '../primitives/Sticker';
import { Stack } from '../primitives/Stack';
import { Text } from '../primitives/Text';

export interface TodoListProps {
  todo: Item[];
  items: Item[];
  today: string;
  date: string;
  /** Opens the one screen where this thing can be changed. */
  onOpen: (item: Item) => void;
}

export function TodoList({ todo, items, today, date, onOpen }: TodoListProps) {
  if (todo.length === 0) return null;

  return (
    <Stack gap={3}>
      {todo.map((item) => {
        const left = remaining(item);
        const loose = unplanned(item, items);
        const booked = scheduledHours(item, items);
        const parts = composition(item, items);
        const due = daysLeft(item, date);
        const risk = isAtRisk(item, items, date);
        const sittings = sittingsOf(item, items);
        const ticked = sittings.filter((session) => session.sessionDone).length;

        return (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityLabel={`${item.title}. ${due === 0 ? 'Due today' : due === 1 ? 'Due tomorrow' : `${due} days left`}. ${left} hours to go, ${100 - percentUndone(item)} percent done.`}
            onPress={() => onOpen(item)}
            className={`rounded-lg border-2 px-4 py-4 active:opacity-70 ${risk ? 'border-heavy-fill bg-heavy-wash' : 'border-line-hairline bg-raised'}`}
          >
            <Stack gap={4}>
              <Stack direction="row" gap={3} align="center">
                <View
                  className="items-center justify-center rounded-pill"
                  style={{ width: 40, height: 40, backgroundColor: risk ? color.decor.blush : color.decor.candy }}
                >
                  <Sticker name={risk ? 'wall' : 'assignment'} size={27} />
                </View>
                <Stack gap={1} grow>
                  <Text variant="body" weight="semibold">{item.title}</Text>
                  <Text variant="micro" tone={due <= 1 ? 'heavy' : 'subtle'}>
                    {due === 0 ? 'Due today' : due === 1 ? 'Due tomorrow' : `${due} days left`} · {left}h to go
                  </Text>
                </Stack>
                <Stack gap={1} align="end">
                  <Text variant="heading" tone={risk ? 'heavy' : loose > 0 ? 'busy' : 'steady'}>
                    {percentUnplanned(item, items)}%
                  </Text>
                  <Text variant="micro" tone="subtle">unplanned</Text>
                </Stack>
              </Stack>

              <Stack gap={3}>
                <View className="h-4 w-full flex-row overflow-hidden rounded-pill bg-track">
                  <View style={{ flexGrow: parts.done || 0.0001, backgroundColor: color.band.steady.fill }} />
                  <View style={{ flexGrow: parts.scheduled || 0.0001, backgroundColor: color.band.recovery.fill }} />
                  <View style={{ flexGrow: parts.unplanned || 0.0001, backgroundColor: color.surface.track }} />
                </View>
                <Stack direction="row" gap={4} wrap>
                  {([
                    [color.band.steady.fill, `${item.prepDone ?? 0}h done`, 'steady'],
                    [color.band.recovery.fill, `${booked}h booked`, 'recovery'],
                    [color.surface.track, `${loose}h loose`, 'subtle'],
                  ] as const).map(([dot, label, tone]) => (
                    <Stack key={label} direction="row" gap={2} align="center">
                      <View style={{ width: 9, height: 9, borderRadius: 999, backgroundColor: dot }} />
                      <Text variant="micro" tone={tone}>{label}</Text>
                    </Stack>
                  ))}
                </Stack>
              </Stack>

              <Text variant="micro" tone="subtle">
                {sittings.length ? `${ticked}/${sittings.length} sittings done · tap to change` : 'Tap to plan it'}
              </Text>
            </Stack>
          </Pressable>
        );
      })}
    </Stack>
  );
}
