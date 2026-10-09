import { useRef, useState } from 'react';
import { PanResponder, Pressable, ScrollView, View } from 'react-native';
import { Stack, Text } from '@/components';
import { color, radius } from '@design/tokens';
import { DAY_LETTER, dayIndex, formatShort, parseISO, startOfWeek } from '@/lib/dates';
import { bestStart, bookingDays, loadOnDay, sittingStarts } from '@/lib/prep';
import { DAY_END, DAY_START, formatHour, freeSlots } from '@/lib/schedule';
import {
  dayRibbon, describeChange, durationLabel, hourAt, nearestStart, ribbonAt, sittingLoad, spanLabel,
  timeNote, type Draft,
} from '@/lib/sittings';
import { tapFeedback } from '@/lib/haptics';
import { capacityOf } from '@/lib/load';
import { useStore } from '@/state/store';
import type { Item } from '@/lib/types';

const LENGTHS = [0.5, 1, 1.5, 2, 2.5, 3];
const RIBBON_TICKS = [7, 11, 15, 19, 23];

/**
 * One sitting, adjustable three ways: which day, what time, how long.
 *
 * Every control only offers what is real. A day with no gap long enough is
 * shown and greyed rather than hidden, so "why not Monday?" answers itself; a
 * drag along the ribbon snaps to the nearest start that fits, so it can never
 * land on a lecture. Underneath, every change from the suggestion is listed
 * with what it cost.
 */
export function SittingEditor({
  item,
  busy,
  base,
  today,
  nowHour,
  value,
  origin,
  maxHours,
  onChange,
}: {
  item: Item;
  /** The week without this sitting, with every other draft laid in. */
  busy: Item[];
  /** The week as it stands, for the load readouts. */
  base: Item[];
  today: string;
  nowHour?: number;
  value: Draft;
  /** What it was before - the suggestion, or the booked slot. */
  origin?: Draft;
  /** The longest this sitting may be without planning more than is owed. */
  maxHours: number;
  onChange: (next: Draft) => void;
}) {
  const capacity = capacityOf(useStore((state) => state.ceilings));
  const days = bookingDays(today);
  const due = item.deadline ?? item.date;
  const nextMonday = startOfWeek(days[days.length - 1]);
  const weeks = [days.filter((d) => d < nextMonday), days.filter((d) => d >= nextMonday)].filter((w) => w.length);
  const notBefore = (date: string) => (date === today ? nowHour : undefined);
  const startsFor = (date: string, hours: number) => sittingStarts(busy, date, hours, notBefore(date));
  const options = startsFor(value.date, value.hours);
  const index = value.startHour === undefined ? -1 : options.indexOf(value.startHour);

  const adds = sittingLoad(item, value.hours);
  const gap = value.startHour === undefined
    ? undefined
    : freeSlots(busy, value.date, 0.5).find((slot) => slot.start <= value.startHour! && value.startHour! + value.hours <= slot.end);

  const pickDay = (date: string) => {
    tapFeedback();
    const fits = startsFor(date, value.hours);
    const keep = value.startHour !== undefined && fits.includes(value.startHour);
    onChange({ ...value, date, startHour: keep ? value.startHour : bestStart(busy, date, value.hours, notBefore(date)) });
  };

  const pickLength = (hours: number) => {
    tapFeedback();
    const fits = startsFor(value.date, hours);
    const keep = value.startHour !== undefined && fits.includes(value.startHour);
    onChange({ ...value, hours, startHour: keep ? value.startHour : nearestStart(fits, value.startHour ?? 9) });
  };

  const nudge = (direction: -1 | 1) => {
    const next = index === -1 ? options[0] : options[index + direction];
    if (next === undefined) return;
    tapFeedback();
    onChange({ ...value, startHour: next });
  };

  const changes = origin ? describeChange(item, base, origin, value, capacity) : [];
  const note = timeNote(value);
  const lengths = LENGTHS.filter((h) => h <= Math.max(maxHours, value.hours));

  return (
    <Stack gap={4} className="rounded-md border border-line-hairline bg-page p-4">
      {/* Which day: this week and next, one row each. Late days are marked, full days greyed. */}
      <Stack gap={2}>
        <Text variant="micro" tone="subtle">DAY · DUE {formatShort(due).toUpperCase()}</Text>
        {weeks.map((week, w) => (
          <Stack key={week[0]} gap={1}>
            <Text variant="micro" tone="subtle">{w === 0 && week[0] < nextMonday ? 'THIS WEEK' : 'NEXT WEEK'}</Text>
            <Stack direction="row" gap={1}>
              {week.map((date) => {
                const selected = date === value.date;
                const full = startsFor(date, value.hours).length === 0;
                const isDue = date === due;
                const late = date > due;
                const load = Math.round((loadOnDay(base, date) / capacity) * 100);
                return (
                  <Pressable
                    key={date}
                    accessibilityRole="radio"
                    accessibilityState={{ selected, disabled: full }}
                    accessibilityLabel={`${formatShort(date)}, uses ${load} percent${isDue ? ', due day' : late ? ', after it is due' : ''}${full ? ', no gap long enough' : ''}`}
                    disabled={full}
                    onPress={() => pickDay(date)}
                    className={`min-h-min flex-1 items-center gap-0 rounded-md py-2 ${selected ? 'bg-inverse' : full ? 'bg-sunken opacity-40' : 'bg-sunken active:opacity-70'}`}
                    style={{ borderWidth: isDue || late ? 1.5 : 0, borderColor: color.band.heavy.fill, borderStyle: late ? 'dashed' : 'solid' }}
                  >
                    <Text variant="micro" tone={selected ? 'inverse' : isDue || late ? 'heavy' : 'subtle'}>
                      {isDue ? 'DUE' : date === today ? 'NOW' : DAY_LETTER[dayIndex(date)]}
                    </Text>
                    <Text variant="callout" weight="bold" tone={selected ? 'inverse' : 'default'}>{parseISO(date).getUTCDate()}</Text>
                    <Text variant="micro" tone={selected ? 'inverse' : 'subtle'}>{full ? '–' : `${load}%`}</Text>
                  </Pressable>
                );
              })}
              {/* Keep the columns lined up when this week started mid-week. */}
              {Array.from({ length: 7 - week.length }, (_, i) => <View key={`pad-${i}`} className="flex-1" />)}
            </Stack>
          </Stack>
        ))}
        {value.date > due ? <Text variant="micro" tone="heavy">After it’s due · {formatShort(due)}</Text> : null}
      </Stack>

      {/* What time. Drag the block, or step through the starts that fit. */}
      <Stack gap={2}>
        <Stack direction="row" justify="between" align="center">
          <Text variant="micro" tone="subtle">TIME · DRAG TO MOVE</Text>
          {note ? <Text variant="micro" tone="busy">{note.toUpperCase()}</Text> : null}
        </Stack>
        <Stack direction="row" gap={2} align="center">
          <Nudge label="Earlier" glyph="‹" disabled={index <= 0} onPress={() => nudge(-1)} />
          <Stack grow align="center" gap={1}>
            <Text variant="heading" tone={value.startHour === undefined ? 'heavy' : 'default'}>{spanLabel(value)}</Text>
            <Text variant="micro" tone="subtle">
              {gap ? `GAP ${formatHour(gap.start)}–${formatHour(gap.end)}` : options.length ? 'PICK A TIME' : 'NO GAP THIS LONG'}
            </Text>
          </Stack>
          <Nudge label="Later" glyph="›" disabled={index === -1 ? !options.length : index >= options.length - 1} onPress={() => nudge(1)} />
        </Stack>
        <DayRibbon
          busy={busy}
          date={value.date}
          value={value}
          options={options}
          onPick={(startHour) => { tapFeedback(); onChange({ ...value, startHour }); }}
        />
      </Stack>

      {/* How long. Lengths that cannot fit on this day are shown, not offered. */}
      <Stack gap={2}>
        <Text variant="micro" tone="subtle">LENGTH</Text>
        <Stack direction="row" gap={2} wrap>
          {lengths.map((hours) => {
            const selected = hours === value.hours;
            const fits = startsFor(value.date, hours).length > 0;
            return (
              <Pressable
                key={hours}
                accessibilityRole="radio"
                accessibilityState={{ selected, disabled: !fits }}
                accessibilityLabel={durationLabel(hours)}
                disabled={!fits && !selected}
                onPress={() => pickLength(hours)}
                className={`min-h-min justify-center rounded-pill border px-4 ${
                  selected ? 'border-inverse bg-inverse' : fits ? 'border-line-hairline bg-sunken active:opacity-70' : 'border-line-hairline opacity-40'
                }`}
              >
                <Text variant="caption" tone={selected ? 'inverse' : 'muted'}>{durationLabel(hours)}</Text>
              </Pressable>
            );
          })}
        </Stack>
      </Stack>

      {/* The day after this lands on it. */}
      <Stack direction="row" gap={2} align="center" className="rounded-md bg-sunken px-3 py-3">
        <Text variant="footnote" weight="semibold" className="flex-1">{formatShort(value.date)}</Text>
        <Text variant="footnote" tone="muted">
          🔋 −{Math.round((loadOnDay(base, value.date) / capacity) * 100)}% → −{Math.round(((loadOnDay(base, value.date) + adds) / capacity) * 100)}%
        </Text>
      </Stack>

      {changes.length ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Undo changes"
          onPress={() => { tapFeedback(); onChange({ ...origin! }); }}
          className="min-h-min justify-center self-start active:opacity-60"
        >
          <Text variant="caption" tone="muted" className="underline">↺ Back to the suggestion</Text>
        </Pressable>
      ) : null}
    </Stack>
  );
}

function Nudge({ label, glyph, disabled, onPress }: { label: string; glyph: string; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      className={`min-h-min min-w-min items-center justify-center rounded-pill border border-line-hairline bg-sunken ${disabled ? 'opacity-30' : 'active:opacity-60'}`}
    >
      <Text variant="heading">{glyph}</Text>
    </Pressable>
  );
}

/**
 * The day from 7am to 11pm, with what is already in it.
 *
 * Grey blocks are taken; the blue one is this sitting. Touching anywhere moves
 * the sitting there - or as near as it can go without a clash.
 */
function DayRibbon({
  busy,
  date,
  value,
  options,
  onPick,
}: {
  busy: Item[];
  date: string;
  value: Draft;
  options: number[];
  onPick: (startHour: number) => void;
}) {
  const [width, setWidth] = useState(0);
  const widthRef = useRef(0);
  const ref = useRef({ options, value, onPick });
  ref.current = { options, value, onPick };

  const pickAt = (x: number) => {
    if (widthRef.current <= 0) return;
    const { options: opts, value: current, onPick: pick } = ref.current;
    const target = nearestStart(opts, hourAt(x / widthRef.current) - current.hours / 2);
    if (target !== undefined && target !== current.startHour) pick(target);
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (event) => pickAt(event.nativeEvent.locationX),
      onPanResponderMove: (event) => pickAt(event.nativeEvent.locationX),
    }),
  ).current;

  const blocks = dayRibbon(busy, date);
  const span = DAY_END - DAY_START;
  const at = value.startHour === undefined ? null : ribbonAt(value.startHour);

  return (
    <Stack gap={1}>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={`${formatShort(date)}, 7am to 11pm`}
        accessibilityValue={{ text: spanLabel(value) }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(event) => {
          const i = value.startHour === undefined ? -1 : options.indexOf(value.startHour);
          const next = options[event.nativeEvent.actionName === 'increment' ? i + 1 : Math.max(0, i - 1)];
          if (next !== undefined) onPick(next);
        }}
        onLayout={(event) => {
          widthRef.current = event.nativeEvent.layout.width;
          setWidth(event.nativeEvent.layout.width);
        }}
        style={{ height: 44, justifyContent: 'center' }}
        {...pan.panHandlers}
      >
        <View style={{ height: 30, borderRadius: radius.sm, backgroundColor: color.surface.sunken, overflow: 'hidden' }}>
          {blocks.map((block, i) => (
            <View
              key={i}
              pointerEvents="none"
              style={{
                position: 'absolute', top: 0, bottom: 0,
                left: block.left * width, width: Math.max(2, block.width * width - 1),
                backgroundColor: color.line.strong, opacity: 0.7,
              }}
            />
          ))}
        </View>
        {at !== null ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute', top: 2, height: 40,
              left: at * width, width: Math.max(10, (value.hours / span) * width),
              borderRadius: radius.sm, backgroundColor: color.band.recovery.fill,
              borderWidth: 2, borderColor: color.band.recovery.ink,
            }}
          />
        ) : null}
      </View>
      <Stack direction="row" justify="between">
        {RIBBON_TICKS.map((hour) => (
          <Text key={hour} variant="micro" tone="subtle">{formatHour(hour)}</Text>
        ))}
      </Stack>
    </Stack>
  );
}
