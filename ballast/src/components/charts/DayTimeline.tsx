/**
 * Data / Day timeline.
 *
 * A list of today's tasks tells you what. This tells you when, which is the
 * question people actually open a planner to answer.
 *
 * Three things it does that a flat list cannot: it orders by clock time, it
 * shows the gaps between things as real space you could use, and it separates
 * the fixed from the floating. Coursework with no slot is not "late", it is
 * unscheduled, and treating those the same is why a packed week reads as noise.
 */
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { DAY_END, endHour, formatHour, freeSlots, slotHours, daySchedule, startOptions } from '@/lib/schedule';
import { BUCKET_LABEL, bandFor, loadOf } from '@/lib/load';
import type { Item } from '@/lib/types';
import { tapFeedback } from '@/lib/haptics';
import { Chip } from '../primitives/Chip';
import { DreadDots } from '../primitives/DreadDots';
import { Stack } from '../primitives/Stack';
import { Text } from '../primitives/Text';

const TONE = { steady: 'steady', busy: 'busy', heavy: 'heavy' } as const;

const EDGE = {
  steady: 'border-l-steady-fill bg-steady-wash',
  busy: 'border-l-busy-fill bg-busy-wash',
  heavy: 'border-l-heavy-fill bg-heavy-wash',
  recovery: 'border-l-recovery-fill bg-recovery-wash',
} as const;

/** Load per hour, so a 6h shift at dread 2 does not out-shout a 1h crisis. */
const intensity = (item: Item) => bandFor((loadOf(item) / Math.max(item.hours, 0.5)) * 22);

export function DayTimeline({
  items,
  date,
  onSelect,
  onSchedule,
  onAddAt,
  showGaps = true,
}: {
  items: Item[];
  date: string;
  onSelect?: (item: Item) => void;
  /** Give a floating task a slot, or pass undefined to take its slot away. */
  onSchedule?: (item: Item, startHour: number | undefined) => void;
  /** Tapping an empty stretch. This is how something gets added *at a time*. */
  onAddAt?: (date: string, startHour: number) => void;
  showGaps?: boolean;
}) {
  const { timed, anytime } = daySchedule(items, date);
  const gaps = showGaps ? freeSlots(items, date, 1) : [];
  const [scheduling, setScheduling] = useState<string | null>(null);

  const startsFor = (item: Item) => startOptions(items, date, item.hours);

  // Interleave gaps between blocks so free time occupies real space on screen.
  const rows: Array<{ kind: 'item'; item: Item } | { kind: 'gap'; start: number; end: number }> = [];
  for (const item of timed) {
    const gap = gaps.find((slot) => Math.abs(slot.end - item.startHour!) < 0.01);
    if (gap && slotHours(gap) >= 1) rows.push({ kind: 'gap', start: gap.start, end: gap.end });
    rows.push({ kind: 'item', item });
  }
  const tail = gaps.find((slot) => slot.end >= DAY_END - 0.01 && slotHours(slot) >= 1);
  if (tail && timed.length) rows.push({ kind: 'gap', start: tail.start, end: tail.end });

  return (
    <Stack gap={3}>
      {rows.map((row, index) =>
        row.kind === 'gap' ? (
          <Stack key={`gap-${index}`} direction="row" gap={4} align="center">
            <View className="w-14">
              <Text variant="micro" tone="subtle">{formatHour(row.start)}</Text>
            </View>
            <Pressable
              accessibilityRole={onAddAt ? 'button' : 'text'}
              accessibilityLabel={
                onAddAt
                  ? `${slotHours({ start: row.start, end: row.end })} hours free from ${formatHour(row.start)}. Add something here.`
                  : `${slotHours({ start: row.start, end: row.end })} hours free`
              }
              onPress={onAddAt ? () => onAddAt(date, Math.ceil(row.start)) : undefined}
              className={`min-h-min flex-1 justify-center rounded-sm border border-dashed border-line-hairline px-4 py-3 ${
                onAddAt ? 'active:opacity-60' : ''
              }`}
            >
              <Stack direction="row" gap={3} justify="between" align="center">
                <Text variant="footnote" tone="subtle">
                  {slotHours({ start: row.start, end: row.end })}h free
                </Text>
                {onAddAt ? <Text variant="footnote" tone="steady">+ Add here</Text> : null}
              </Stack>
            </Pressable>
          </Stack>
        ) : (
          <Stack key={row.item.id} direction="row" gap={4} align="start">
            <View className="w-14 pt-3">
              <Text variant="micro" weight="semibold" tone="muted">{formatHour(row.item.startHour!)}</Text>
              <Text variant="micro" tone="subtle">{formatHour(endHour(row.item))}</Text>
            </View>
            <Pressable
              accessibilityRole={onSelect ? 'button' : 'text'}
              accessibilityLabel={`${row.item.title}, ${formatHour(row.item.startHour!)} to ${formatHour(endHour(row.item))}, ${BUCKET_LABEL[row.item.bucket]}, load ${loadOf(row.item)}`}
              onPress={onSelect ? () => onSelect(row.item) : undefined}
              className={`min-h-min flex-1 rounded-sm border-l-4 px-4 py-3 ${
                row.item.isRecovery ? EDGE.recovery : EDGE[intensity(row.item)]
              } ${onSelect ? 'active:opacity-70' : ''}`}
            >
              <Stack gap={2}>
                <Stack direction="row" gap={3} justify="between" align="start">
                  <Text variant="body" weight="semibold" className="flex-1">{row.item.title}</Text>
                  {row.item.isRecovery ? null : <DreadDots value={row.item.dread} />}
                </Stack>
                <Text variant="micro" tone={row.item.isRecovery ? 'recovery' : 'subtle'}>
                  {row.item.isRecovery ? 'Protected recovery' : `${BUCKET_LABEL[row.item.bucket]} · ${loadOf(row.item)} load`}
                </Text>
                {onSchedule && !row.item.isRecovery && !row.item.repeats ? (
                  <Stack direction="row" gap={2} wrap>
                    <Chip
                      label={scheduling === row.item.id ? 'Close' : 'Move'}
                      onPress={() => {
                        tapFeedback();
                        setScheduling((id) => (id === row.item.id ? null : row.item.id));
                      }}
                    />
                    <Chip
                      label="Unschedule"
                      onPress={() => {
                        onSchedule(row.item, undefined);
                        setScheduling(null);
                      }}
                    />
                  </Stack>
                ) : null}
                {scheduling === row.item.id ? (
                  <SlotPicker
                    starts={startsFor(row.item)}
                    current={row.item.startHour}
                    onPick={(hour) => {
                      onSchedule?.(row.item, hour);
                      setScheduling(null);
                    }}
                  />
                ) : null}
              </Stack>
            </Pressable>
          </Stack>
        ),
      )}

      {anytime.length > 0 ? (
        <Stack gap={3} className="pt-2">
          <Text variant="micro" tone="subtle">ANYTIME TODAY · {anytime.length}</Text>
          {anytime.map((item) => (
            <Stack key={item.id} direction="row" gap={4} align="start">
              <View className="w-14 pt-3">
                <Text variant="micro" tone="subtle">
                  {item.hours < 1 ? `${Math.round(item.hours * 60)}m` : `${item.hours}h`}
                </Text>
              </View>
              <Pressable
                accessibilityRole={onSelect ? 'button' : 'text'}
                accessibilityLabel={`${item.title}, unscheduled, ${item.hours} hours, load ${loadOf(item)}`}
                onPress={onSelect ? () => onSelect(item) : undefined}
                className={`min-h-min flex-1 rounded-sm border border-line-hairline px-4 py-3 ${onSelect ? 'active:opacity-70' : ''}`}
              >
                <Stack gap={3}>
                  <Stack direction="row" gap={3} justify="between" align="start">
                    <Text variant="body" weight="semibold" className="flex-1">{item.title}</Text>
                    <DreadDots value={item.dread} />
                  </Stack>
                  <Text variant="micro" tone={TONE[intensity(item)]}>
                    {BUCKET_LABEL[item.bucket]} · {loadOf(item)} load · no slot yet
                  </Text>
                  {onSchedule ? (
                    <Stack gap={3}>
                      <Chip
                        label={scheduling === item.id ? 'Close' : 'Give it a time'}
                        tone={scheduling === item.id ? 'selected' : 'steady'}
                        onPress={() => {
                          tapFeedback();
                          setScheduling((id) => (id === item.id ? null : item.id));
                        }}
                      />
                      {scheduling === item.id ? (
                        <SlotPicker
                          starts={startsFor(item)}
                          onPick={(hour) => {
                            onSchedule(item, hour);
                            setScheduling(null);
                          }}
                        />
                      ) : null}
                    </Stack>
                  ) : null}
                </Stack>
              </Pressable>
            </Stack>
          ))}
        </Stack>
      ) : null}

      {rows.length === 0 && anytime.length === 0 ? (
        <View className="rounded-md border border-dashed border-line-hairline px-5 py-8">
          <Text variant="callout" tone="subtle" className="text-center">Nothing scheduled. Genuinely.</Text>
        </View>
      ) : null}
    </Stack>
  );
}

/** The gaps this task would fit into, as tappable times. */
function SlotPicker({
  starts,
  current,
  onPick,
}: {
  starts: number[];
  current?: number;
  onPick: (hour: number) => void;
}) {
  if (starts.length === 0) {
    return (
      <Text variant="micro" tone="heavy">
        Nothing free today is long enough. Move something else first.
      </Text>
    );
  }
  return (
    <Stack direction="row" gap={2} wrap>
      {starts.map((hour) => (
        <Chip
          key={hour}
          label={formatHour(hour)}
          tone={hour === current ? 'selected' : 'plain'}
          onPress={() => onPick(hour)}
        />
      ))}
    </Stack>
  );
}
