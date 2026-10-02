/**
 * Data / Day timeline.
 *
 * A list of today's tasks tells you what. This tells you when, which is the
 * question people actually open a planner to answer.
 *
 * The blocks are the point of the screen, so they are drawn as cards worth
 * looking at: what kind of thing it is, where, how draining, and - once its time
 * has come - what happened. A green tick for done, a half-moon for partly done,
 * an amber clock for "over, and nobody has said". A line marks now.
 *
 * Under the clock, two folded trays: things for this day with no time yet, and
 * work owing before a deadline. Folded, each is one row with its count.
 */
import { useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { DAY_END, endHour, formatHour, freeSlots, slotHours, daySchedule } from '@/lib/schedule';
import { bandFor, describeMix, loadOf, shortMix } from '@/lib/load';
import { KIND, markKind, markStatus, outcomeWord, type MarkStatus } from '@/lib/marking';
import type { CustomFlag, Item } from '@/lib/types';
import { flagInfo } from '@/lib/timetable';
import { color, radius } from '@design/tokens';
import { AreaIcon } from '../primitives/AreaIcon';
import { Chip } from '../primitives/Chip';
import { DrainBadge } from '../primitives/DrainPicker';
import { MarkBadge } from '../primitives/MarkBadge';
import { Sticker, type StickerName } from '../primitives/Sticker';
import { Stack } from '../primitives/Stack';
import { Text } from '../primitives/Text';

const TONE = { steady: 'steady', busy: 'busy', heavy: 'heavy' } as const;

const FILL = {
  steady: color.band.steady.fill,
  busy: color.band.busy.fill,
  heavy: color.band.heavy.fill,
} as const;

/** Width of the clock column. */
const CLOCK_WIDTH = 46;

const CARD = {
  steady: 'border-steady-fill bg-steady-wash',
  busy: 'border-busy-fill bg-busy-wash',
  heavy: 'border-heavy-fill bg-heavy-wash',
  recovery: 'border-recovery-fill bg-recovery-wash',
} as const;

/** Load per hour, so a 6h shift at dread 2 does not out-shout a 1h crisis. */
const intensity = (item: Item) => bandFor((loadOf(item) / Math.max(item.hours, 0.5)) * 22);

/**
 * The rail — a dot on a line, down the left of everything with a time. The dot
 * turns into a tick once the thing is done, and into a hollow amber ring while
 * it waits to be marked.
 */
function Rail({ tone, status }: { tone: string; status?: MarkStatus }) {
  const done = status === 'done' || status === 'partial';
  const ring = status === 'due' ? color.band.busy.fill : done ? color.band.steady.fill : tone;
  return (
    <View className="items-center" style={{ width: 18 }}>
      <View
        className="items-center justify-center"
        style={{
          width: 18, height: 18, borderRadius: radius.pill, marginTop: 4,
          backgroundColor: done ? color.band.steady.fill : status === 'due' || status === 'missed' ? color.surface.page : tone,
          borderWidth: 2.5, borderColor: status === 'missed' ? color.line.strong : ring,
        }}
      >
        {done ? <Text variant="micro" weight="bold" tone="inverse">✓</Text> : null}
      </View>
      <View style={{ width: 2, flex: 1, marginTop: 2, backgroundColor: color.line.hairline }} />
    </View>
  );
}

/** One folded tray under the clock: a row with its count, its contents on a tap. */
function Tray({
  sticker, wash, title, meta, open, onToggle, children,
}: {
  sticker: StickerName; wash: string; title: string; meta: string; open: boolean; onToggle: () => void; children: ReactNode;
}) {
  return (
    <Stack gap={3}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${title}, ${meta}`}
        onPress={onToggle}
        className="min-h-min flex-row items-center gap-3 rounded-pill py-2 pl-2 pr-3 active:opacity-70"
        style={{ backgroundColor: wash }}
      >
        <View className="items-center justify-center rounded-pill" style={{ width: 32, height: 32, backgroundColor: color.surface.page }}>
          <Sticker name={sticker} size={22} />
        </View>
        <Text variant="callout" weight="semibold" className="flex-1">{title}</Text>
        <Text variant="micro" tone="muted">{meta}</Text>
        <View className="items-center justify-center rounded-pill" style={{ width: 26, height: 26, backgroundColor: open ? color.surface.inverse : color.surface.page }}>
          <Text variant="caption" weight="bold" tone={open ? 'inverse' : 'muted'}>{open ? '⌃' : '⌄'}</Text>
        </View>
      </Pressable>
      {open ? children : null}
    </Stack>
  );
}

export function DayTimeline({
  items,
  date,
  onSelect,
  onAddAt,
  todo,
  todoMeta,
  showGaps = true,
  customFlags = [],
  clock,
}: {
  /** The student's own flags, so a class wearing one can name it. */
  customFlags?: CustomFlag[];
  items: Item[];
  date: string;
  /** Opens the block: its question once its time has come, and its details. */
  onSelect?: (item: Item) => void;
  /** Tapping an empty stretch. This is how something gets added *at a time*. */
  onAddAt?: (date: string, startHour: number) => void;
  /** Work owing before a deadline. */
  todo?: ReactNode;
  /** What that work adds up to. The list itself is a node, so it cannot count itself. */
  todoMeta?: string;
  showGaps?: boolean;
  /** Today and the hour now. With it, blocks say what happened and a line marks now. */
  clock?: { today: string; hour: number };
}) {
  const [trays, setTrays] = useState({ day: false, owing: false });
  const { timed, anytime } = daySchedule(items, date);
  const gaps = showGaps ? freeSlots(items, date, 1) : [];
  const statusOf = (item: Item): MarkStatus | undefined => (clock ? markStatus(item, clock.today, clock.hour) : undefined);

  // Interleave gaps between blocks so free time occupies real space on screen.
  type Row = { kind: 'item'; item: Item; at: number } | { kind: 'gap'; start: number; end: number; at: number };
  const rows: Row[] = [];
  for (const item of timed) {
    const gap = gaps.find((slot) => Math.abs(slot.end - item.startHour!) < 0.01);
    if (gap && slotHours(gap) >= 1) rows.push({ kind: 'gap', start: gap.start, end: gap.end, at: gap.start });
    rows.push({ kind: 'item', item, at: item.startHour! });
  }
  const tail = gaps.find((slot) => slot.end >= DAY_END - 0.01 && slotHours(slot) >= 1);
  if (tail && timed.length) rows.push({ kind: 'gap', start: tail.start, end: tail.end, at: tail.start });

  // Where "now" falls: before the first row that has not started yet.
  const showNow = !!clock && clock.today === date && clock.hour > 0 && clock.hour < 24 && rows.length > 0;
  const nowIndex = showNow ? rows.findIndex((row) => row.at > clock!.hour) : -1;

  const nowLine = (
    <Stack key="now" direction="row" gap={2} align="center" accessibilityLabel={`Now, ${formatHour(clock?.hour ?? 0)}`}>
      <View className="items-end" style={{ width: CLOCK_WIDTH }}>
        <View className="rounded-pill bg-heavy-fill px-2 py-1">
          <Text variant="micro" weight="bold" tone="inverse">{formatHour(Math.floor((clock?.hour ?? 0) * 2) / 2)}</Text>
        </View>
      </View>
      <View style={{ width: 10, height: 10, borderRadius: radius.pill, backgroundColor: color.band.heavy.fill }} />
      <View className="flex-1" style={{ height: 2, backgroundColor: color.band.heavy.fill }} />
    </Stack>
  );

  const timedHours = Math.round(timed.reduce((total, item) => total + item.hours, 0) * 10) / 10;

  return (
    <Stack gap={3}>
      {timed.length ? (
        <Stack direction="row" align="center" justify="between" className="px-1">
          <Text variant="micro" tone="subtle">SCHEDULED</Text>
          <Text variant="micro" tone="subtle">{timed.length} · {timedHours}h</Text>
        </Stack>
      ) : null}

      {rows.map((row, index) => {
        const line = index === nowIndex ? nowLine : null;
        if (row.kind === 'gap') {
          return (
            <Stack key={`gap-${index}`} gap={3}>
              {line}
              <Stack direction="row" gap={3} align="stretch">
                <View className="items-end pt-2" style={{ width: CLOCK_WIDTH }}>
                  <Text variant="micro" tone="subtle">{formatHour(row.start)}</Text>
                </View>
                <View className="items-center" style={{ width: 18 }}>
                  <View style={{ width: 12, height: 12, borderRadius: radius.pill, marginTop: 6, borderWidth: 2, borderColor: color.line.strong, backgroundColor: color.surface.page }} />
                  <View style={{ width: 2, flex: 1, marginTop: 2, backgroundColor: color.line.hairline }} />
                </View>
                <Pressable
                  accessibilityRole={onAddAt ? 'button' : 'text'}
                  accessibilityLabel={
                    onAddAt
                      ? `${slotHours({ start: row.start, end: row.end })} hours free from ${formatHour(row.start)}. Add something here.`
                      : `${slotHours({ start: row.start, end: row.end })} hours free`
                  }
                  onPress={onAddAt ? () => onAddAt(date, Math.ceil(row.start)) : undefined}
                  className={`min-h-min flex-1 justify-center rounded-md border-2 border-dashed border-line-hairline px-4 py-2 ${
                    onAddAt ? 'active:opacity-60' : ''
                  }`}
                >
                  <Stack direction="row" gap={3} justify="between" align="center">
                    <Text variant="footnote" tone="subtle">{slotHours({ start: row.start, end: row.end })}h free</Text>
                    {onAddAt ? (
                      <View className="items-center justify-center rounded-pill" style={{ width: 24, height: 24, backgroundColor: color.decor.mint }}>
                        <Text variant="footnote" weight="bold">+</Text>
                      </View>
                    ) : null}
                  </Stack>
                </Pressable>
              </Stack>
            </Stack>
          );
        }

        const { item } = row;
        const status = statusOf(item);
        const kind = KIND[markKind(item)];
        const band = item.isRecovery ? 'recovery' : intensity(item);
        const quiet = status === 'missed';
        return (
          <Stack key={item.id} gap={3}>
            {line}
            <Stack direction="row" gap={3} align="stretch">
              <View className="items-end pt-2" style={{ width: CLOCK_WIDTH }}>
                <Text variant="caption" weight="bold">{formatHour(item.startHour!)}</Text>
                <Text variant="micro" tone="subtle">{formatHour(endHour(item))}</Text>
              </View>
              <Rail tone={item.isRecovery ? color.band.recovery.fill : FILL[intensity(item)]} status={status} />
              <Pressable
                accessibilityRole={onSelect ? 'button' : 'text'}
                accessibilityLabel={`${item.title}, ${formatHour(item.startHour!)} to ${formatHour(endHour(item))}, ${describeMix(item.mix, item.bucket)}, load ${loadOf(item)}${status && status !== 'later' ? `, ${outcomeWord(item) ?? (status === 'due' ? 'not marked yet' : 'now')}` : ''}`}
                onPress={onSelect ? () => onSelect(item) : undefined}
                className={`mb-1 flex-1 rounded-xl border-2 px-3 py-3 ${
                  status === 'due' ? 'border-dashed border-busy-fill bg-raised' : CARD[band]
                } ${onSelect ? 'active:opacity-70' : ''}`}
                style={{ opacity: quiet ? 0.6 : 1 }}
              >
                <Stack gap={2}>
                  <Stack direction="row" gap={2} align="center">
                    {/* What kind of thing it is, at a glance. */}
                    <View className="items-center justify-center rounded-pill bg-raised" style={{ width: 34, height: 34 }}>
                      <Text variant="callout">{kind.emoji}</Text>
                    </View>
                    <Text variant="heading" className={`flex-1 ${quiet ? 'line-through' : ''}`}>{item.title}</Text>
                  </Stack>
                  <Stack direction="row" gap={2} align="center">
                    <Text variant="micro" tone={item.isRecovery ? 'recovery' : 'muted'} className="flex-1">
                      {item.isRecovery
                        ? 'Protected'
                        : item.room
                          ? `📍 ${item.room}`
                          : shortMix(item.mix, item.bucket)}
                      {` · ${item.hours < 1 ? `${Math.round(item.hours * 60)}m` : `${item.hours}h`}`}
                    </Text>
                    {item.isRecovery ? null : <DrainBadge value={item.dread} />}
                  </Stack>

                  {/* The hour where the hints get given is worth saying out loud. */}
                  {item.flags?.length ? (
                    <Stack direction="row" gap={2} wrap>
                      {item.flags.map((flag) => {
                        const info = flagInfo(flag, customFlags);
                        return info ? <Chip key={flag} label={`${info.emoji} ${info.short}`} tone={flag === 'tips' ? 'heavy' : 'plain'} readOnly /> : null;
                      })}
                    </Stack>
                  ) : null}

                  {status && status !== 'later' ? (
                    <MarkBadge status={status} word={outcomeWord(item)} auto={item.autoMarked} />
                  ) : null}
                </Stack>
              </Pressable>
            </Stack>
          </Stack>
        );
      })}
      {nowIndex === -1 && showNow ? nowLine : null}

      {/* Everything with no time on it, in two folded trays below the clock. */}
      {todo || anytime.length > 0 ? (
        <Stack gap={3} className="mt-2 rounded-lg bg-sunken p-3">
          <Stack direction="row" gap={3} align="center">
            <View className="flex-1" style={{ height: 2, backgroundColor: color.line.hairline }} />
            <Text variant="micro" tone="subtle">NOT ON THE CLOCK</Text>
            <View className="flex-1" style={{ height: 2, backgroundColor: color.line.hairline }} />
          </Stack>

          {anytime.length > 0 ? (
            <Tray
              sticker="basket"
              wash={color.decor.lemon}
              title="This day"
              meta={`${anytime.length} · no time yet`}
              open={trays.day}
              onToggle={() => setTrays({ ...trays, day: !trays.day })}
            >
              {anytime.map((item) => {
                const status = statusOf(item);
                return (
                  <Pressable
                    key={item.id}
                    accessibilityRole={onSelect ? 'button' : 'text'}
                    accessibilityLabel={`${item.title}, unscheduled, ${item.hours} hours, ${describeMix(item.mix, item.bucket)}, load ${loadOf(item)}`}
                    onPress={onSelect ? () => onSelect(item) : undefined}
                    className={`min-h-min rounded-lg border-2 border-line-hairline bg-raised px-4 py-3 ${onSelect ? 'active:opacity-70' : ''}`}
                  >
                    <Stack direction="row" gap={3} align="center">
                      <View
                        className="items-center justify-center rounded-pill"
                        style={{ width: 36, height: 36, backgroundColor: color.area[item.bucket].wash }}
                      >
                        <AreaIcon area={item.bucket} size={20} />
                      </View>
                      <Stack gap={1} grow>
                        <Text variant="body" weight="semibold">{item.title}</Text>
                        <Text variant="micro" tone={TONE[intensity(item)]}>
                          {shortMix(item.mix, item.bucket)} · {loadOf(item)} · {item.hours < 1 ? `${Math.round(item.hours * 60)}m` : `${item.hours}h`}
                        </Text>
                      </Stack>
                      {status && status !== 'later' && status !== 'due' ? (
                        <MarkBadge status={status} word={outcomeWord(item)} auto={item.autoMarked} />
                      ) : onSelect ? (
                        <View className="rounded-pill bg-inverse px-3 py-1">
                          <Text variant="micro" weight="bold" tone="inverse">🕒 Plan</Text>
                        </View>
                      ) : (
                        <DrainBadge value={item.dread} />
                      )}
                    </Stack>
                  </Pressable>
                );
              })}
            </Tray>
          ) : null}

          {todo ? (
            <Tray
              sticker="assignment"
              wash={color.decor.candy}
              title="Owing"
              meta={todoMeta ?? 'before a deadline'}
              open={trays.owing}
              onToggle={() => setTrays({ ...trays, owing: !trays.owing })}
            >
              {todo}
            </Tray>
          ) : null}
        </Stack>
      ) : null}

      {rows.length === 0 && anytime.length === 0 && !todo ? (
        <Stack gap={3} align="center" className="rounded-lg border-2 border-dashed border-line-hairline px-5 py-8">
          <Sticker name="cloud" size={48} />
          <Text variant="callout" tone="subtle" className="text-center">Nothing scheduled.</Text>
        </Stack>
      ) : null}
    </Stack>
  );
}
