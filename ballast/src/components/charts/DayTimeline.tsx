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
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { DAY_END, endHour, formatHour, freeSlots, slotHours, daySchedule } from '@/lib/schedule';
import { BUCKET_LABEL, bandFor, describeMix, loadOf, shortMix } from '@/lib/load';
import type { Item } from '@/lib/types';
import { FLAG_SHORT, isProtectedClass } from '@/lib/timetable';
import { color } from '@design/tokens';
import { AreaIcon } from '../primitives/AreaIcon';
import { Chip } from '../primitives/Chip';
import { DreadDots } from '../primitives/DreadDots';
import { Sticker, type StickerName } from '../primitives/Sticker';
import { Stack } from '../primitives/Stack';
import { Text } from '../primitives/Text';

const TONE = { steady: 'steady', busy: 'busy', heavy: 'heavy' } as const;

/**
 * A band across the top of each part of the day.
 *
 * The three sections here answer three different questions — when things are,
 * what is owing, and what has no time yet — and they used to be separated by a
 * single line of grey capitals, which read as a spreadsheet. Same drawing-on-a-
 * disc pattern the screens use, one size down.
 */
function SectionHeader({
  sticker, wash, title, meta,
}: {
  sticker: StickerName; wash: string; title: string; meta: string;
}) {
  return (
    <Stack
      direction="row"
      gap={3}
      align="center"
      className="rounded-pill py-2 pl-2 pr-4"
      style={{ backgroundColor: wash }}
      accessibilityRole="header"
    >
      <View className="items-center justify-center rounded-pill" style={{ width: 30, height: 30, backgroundColor: color.surface.page }}>
        <Sticker name={sticker} size={21} />
      </View>
      <Text variant="caption" weight="semibold" className="flex-1">{title}</Text>
      <Text variant="micro" tone="subtle">{meta}</Text>
    </Stack>
  );
}



const FILL = {
  steady: color.band.steady.fill,
  busy: color.band.busy.fill,
  heavy: color.band.heavy.fill,
} as const;

/** Width of the clock column. `w-14` was never in this theme's scale, so the
 *  times had been auto-sizing and no two rows lined up. */
const CLOCK_WIDTH = 46;

const EDGE = {
  steady: 'border-l-steady-fill bg-steady-wash',
  busy: 'border-l-busy-fill bg-busy-wash',
  heavy: 'border-l-heavy-fill bg-heavy-wash',
  recovery: 'border-l-recovery-fill bg-recovery-wash',
} as const;

/**
 * The rail — a dot on a line, down the left of everything with a time.
 *
 * This is the whole distinction the day was missing. Scheduled things are
 * anchored to a clock and read as a timeline; owing work and loose tasks are
 * not, and sat in an identically shaped row with a duration where the clock
 * should be, which made "20m" look like it meant twenty past.
 */
function Rail({ tone, hollow }: { tone: string; hollow?: boolean }) {
  return (
    <View className="items-center" style={{ width: 14 }}>
      <View
        style={{
          width: 12, height: 12, borderRadius: 999, marginTop: 5,
          backgroundColor: hollow ? color.surface.page : tone,
          borderWidth: 2, borderColor: tone,
        }}
      />
      <View style={{ width: 2, flex: 1, marginTop: 2, backgroundColor: color.line.hairline }} />
    </View>
  );
}



/** Load per hour, so a 6h shift at dread 2 does not out-shout a 1h crisis. */
const intensity = (item: Item) => bandFor((loadOf(item) / Math.max(item.hours, 0.5)) * 22);

export function DayTimeline({
  items,
  date,
  onSelect,
  onAddAt,
  todo,
  todoMeta,
  showGaps = true,
}: {
  items: Item[];
  date: string;
  /** Opens the one screen where a thing can be changed. Rows are read-only. */
  onSelect?: (item: Item) => void;
  /** Tapping an empty stretch. This is how something gets added *at a time*. */
  onAddAt?: (date: string, startHour: number) => void;
  /** Work owing before a deadline, rendered above the plain unscheduled items. */
  todo?: ReactNode;
  /** What that work adds up to. The list itself is a node, so it cannot count itself. */
  todoMeta?: string;
  showGaps?: boolean;
}) {
  const { timed, anytime } = daySchedule(items, date);
  const gaps = showGaps ? freeSlots(items, date, 1) : [];

  // Interleave gaps between blocks so free time occupies real space on screen.
  const rows: Array<{ kind: 'item'; item: Item } | { kind: 'gap'; start: number; end: number }> = [];
  for (const item of timed) {
    const gap = gaps.find((slot) => Math.abs(slot.end - item.startHour!) < 0.01);
    if (gap && slotHours(gap) >= 1) rows.push({ kind: 'gap', start: gap.start, end: gap.end });
    rows.push({ kind: 'item', item });
  }
  const tail = gaps.find((slot) => slot.end >= DAY_END - 0.01 && slotHours(slot) >= 1);
  if (tail && timed.length) rows.push({ kind: 'gap', start: tail.start, end: tail.end });

  const timedHours = Math.round(timed.reduce((total, item) => total + item.hours, 0) * 10) / 10;

  return (
    <Stack gap={3}>
      {timed.length ? (
        <SectionHeader
          sticker="clock"
          wash={color.decor.sky}
          title="Scheduled"
          meta={`${timed.length} · ${timedHours}h`}
        />
      ) : null}
      {rows.map((row, index) =>
        row.kind === 'gap' ? (
          <Stack key={`gap-${index}`} direction="row" gap={3} align="stretch">
            <View className="items-end pt-2" style={{ width: CLOCK_WIDTH }}>
              <Text variant="micro" tone="subtle">{formatHour(row.start)}</Text>
            </View>
            <Rail tone={color.line.strong} hollow />
            <Pressable
              accessibilityRole={onAddAt ? 'button' : 'text'}
              accessibilityLabel={
                onAddAt
                  ? `${slotHours({ start: row.start, end: row.end })} hours free from ${formatHour(row.start)}. Add something here.`
                  : `${slotHours({ start: row.start, end: row.end })} hours free`
              }
              onPress={onAddAt ? () => onAddAt(date, Math.ceil(row.start)) : undefined}
              className={`min-h-min flex-1 justify-center rounded-md border-2 border-dashed border-line-hairline px-4 py-3 ${
                onAddAt ? 'active:opacity-60' : ''
              }`}
            >
              <Stack direction="row" gap={3} justify="between" align="center">
                <Text variant="footnote" tone="subtle">{slotHours({ start: row.start, end: row.end })}h free</Text>
                {onAddAt ? (
                  <View
                    className="items-center justify-center rounded-pill"
                    style={{ width: 24, height: 24, backgroundColor: color.decor.mint }}
                  >
                    <Text variant="footnote" weight="bold">+</Text>
                  </View>
                ) : null}
              </Stack>
            </Pressable>
          </Stack>
        ) : (
          <Stack key={row.item.id} direction="row" gap={3} align="stretch">
            <View className="items-end pt-2" style={{ width: CLOCK_WIDTH }}>
              <Text variant="micro" weight="semibold" tone="muted">{formatHour(row.item.startHour!)}</Text>
              <Text variant="micro" tone="subtle">{formatHour(endHour(row.item))}</Text>
            </View>
            <Rail tone={row.item.isRecovery ? color.band.recovery.fill : FILL[intensity(row.item)]} />
            <Pressable
              accessibilityRole={onSelect ? 'button' : 'text'}
              accessibilityLabel={`${row.item.title}, ${formatHour(row.item.startHour!)} to ${formatHour(endHour(row.item))}, ${describeMix(row.item.mix, row.item.bucket)}, load ${loadOf(row.item)}`}
              onPress={onSelect ? () => onSelect(row.item) : undefined}
              className={`min-h-min flex-1 rounded-md border-l-4 px-4 py-3 ${
                row.item.isRecovery ? EDGE.recovery : EDGE[intensity(row.item)]
              } ${onSelect ? 'active:opacity-70' : ''}`}
            >
              <Stack gap={2}>
                <Stack direction="row" gap={3} justify="between" align="start">
                  <Text variant="body" weight="semibold" className="flex-1">{row.item.title}</Text>
                  {row.item.isRecovery ? null : <DreadDots value={row.item.dread} />}
                </Stack>
                <Text variant="micro" tone={row.item.sessionDone ? 'steady' : row.item.isRecovery ? 'recovery' : 'subtle'}>
                  {row.item.sessionDone
                    ? `Done · ${row.item.hours}h`
                    : row.item.isRecovery
                    ? 'Protected'
                    : row.item.room
                      ? `${row.item.room} · ${loadOf(row.item)}`
                      : `${shortMix(row.item.mix, row.item.bucket)} · ${loadOf(row.item)}`}
                </Text>
                {/* The hour where the hints get given is worth saying out loud. */}
                {row.item.flags?.length ? (
                  <Stack direction="row" gap={2} wrap>
                    {row.item.flags.map((flag) => (
                      <Chip key={flag} label={FLAG_SHORT[flag]} tone={flag === 'tips' ? 'heavy' : 'plain'} readOnly />
                    ))}
                  </Stack>
                ) : null}
              </Stack>
            </Pressable>
          </Stack>
        ),
      )}

      {/* Everything with no time on it, in one tinted tray below the clock.
          Two kinds, because work owing before a deadline behaves nothing like a
          loose task for today — but both are "not scheduled", and putting them
          in rows shaped like the timeline above is what made the day unreadable. */}
      {todo || anytime.length > 0 ? (
      <Stack gap={5} className="mt-2 rounded-lg bg-sunken p-4">
        <Stack direction="row" gap={3} align="center">
          <View className="flex-1" style={{ height: 2, backgroundColor: color.line.hairline }} />
          <Text variant="micro" tone="subtle">NOT ON THE CLOCK</Text>
          <View className="flex-1" style={{ height: 2, backgroundColor: color.line.hairline }} />
        </Stack>

      {todo ? (
        <Stack gap={3}>
          <SectionHeader
            sticker="assignment"
            wash={color.decor.candy}
            title="Owing"
            meta={todoMeta ?? 'before a deadline'}
          />
          {todo}
        </Stack>
      ) : null}

      {anytime.length > 0 ? (
        <Stack gap={3}>
          <SectionHeader
            sticker="basket"
            wash={color.decor.lemon}
            title="This day"
            meta={`${anytime.length} thing${anytime.length === 1 ? '' : 's'} · no time yet`}
          />
          {anytime.map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole={onSelect ? 'button' : 'text'}
                accessibilityLabel={`${item.title}, unscheduled, ${item.hours} hours, ${describeMix(item.mix, item.bucket)}, load ${loadOf(item)}`}
                onPress={onSelect ? () => onSelect(item) : undefined}
                className={`min-h-min rounded-md border-2 border-line-hairline bg-raised px-4 py-3 ${onSelect ? 'active:opacity-70' : ''}`}
              >
                <Stack gap={3}>
                  <Stack direction="row" gap={3} align="center">
                    {/* The area it belongs to, in its own hue. Identity, not a reading. */}
                    <View
                      className="items-center justify-center rounded-pill"
                      style={{ width: 32, height: 32, backgroundColor: color.area[item.bucket].wash }}
                    >
                      <AreaIcon area={item.bucket} size={18} />
                    </View>
                    <Stack gap={1} grow>
                      <Text variant="body" weight="semibold">{item.title}</Text>
                      <Stack direction="row" gap={2} align="center">
                        <Text variant="micro" tone={TONE[intensity(item)]}>
                          {shortMix(item.mix, item.bucket)} · {loadOf(item)}
                        </Text>
                        <Text variant="micro" tone="subtle">
                          takes {item.hours < 1 ? `${Math.round(item.hours * 60)}m` : `${item.hours}h`}
                        </Text>
                      </Stack>
                    </Stack>
                    <DreadDots value={item.dread} />
                  </Stack>
                </Stack>
              </Pressable>
          ))}
        </Stack>
      ) : null}
      </Stack>
      ) : null}

      {rows.length === 0 && anytime.length === 0 && !todo ? (
        <Stack gap={3} align="center" className="rounded-lg border-2 border-dashed border-line-hairline px-5 py-8">
          <Sticker name="cloud" size={48} />
          <Text variant="callout" tone="subtle" className="text-center">Nothing scheduled. Genuinely.</Text>
        </Stack>
      ) : null}
    </Stack>
  );
}

