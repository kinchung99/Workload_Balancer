import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Battery, Button, Card, Chip, DayTimeline, Divider, Screen, Stack, Text,
} from '@/components';
import { BUCKETS, BUCKET_LABEL, bandFor } from '@/lib/load';
import { formatHour, freeSlots, placeIn, startOptions } from '@/lib/schedule';
import { addDays, formatShort } from '@/lib/dates';
import { successFeedback } from '@/lib/haptics';
import type { Item } from '@/lib/types';
import { prescriptions } from '@/data/seed';
import { restOwedFrom, useStore } from '@/state/store';
import { readingFrom, useItemsWithLogs, useReading } from '@/state/selectors';

const DURATIONS = [0.5, 0.75, 1, 1.5];
const TONE = { steady: 'steady', busy: 'busy', heavy: 'heavy' } as const;

/**
 * Matched to the area that still has room — and bookable at a time you choose.
 *
 * The previous version offered one fixed slot and told you nothing until after
 * you committed. This shows the free time you actually have, lets you pick the
 * length, and puts the resulting battery and the day itself in front of you
 * before anything is written.
 */
export default function Prescription() {
  const router = useRouter();
  const { ceilings, today, booked, recovery, bookRecovery } = useStore();
  const items = useItemsWithLogs();
  const reading = useReading();

  const fullest = BUCKETS.reduce((a, b) => (reading.percents[a] >= reading.percents[b] ? a : b));
  const emptiest = BUCKETS.reduce((a, b) => (reading.percents[a] <= reading.percents[b] ? a : b));

  const available = prescriptions.filter((entry) => !booked.includes(entry.id));
  const [index, setIndex] = useState(0);
  const [hours, setHours] = useState(1);
  const [day, setDay] = useState(today);
  const [start, setStart] = useState<number | null>(null);
  const dayOptions = Array.from({ length: 5 }, (_, offset) => addDays(today, offset));
  const [justBooked, setJustBooked] = useState<string | null>(null);

  const chosen = available[index % Math.max(1, available.length)];

  // Real gaps in today, long enough for the length currently selected.
  const gaps = useMemo(() => freeSlots(items, day, hours), [items, day, hours]);
  const starts = useMemo(() => startOptions(items, day, hours), [items, day, hours]);
  // Defaults into the window the activity belongs in - a nap at 7am is not a nap.
  const slot = start ?? (chosen ? placeIn(items, day, hours, chosen.preferred) ?? null : null);

  /** The week as it would be with this block in it. Nothing is written yet. */
  const preview = useMemo(() => {
    if (!chosen || slot === null) return null;
    const candidate: Item = {
      id: 'preview-recovery',
      title: chosen.title,
      bucket: chosen.refills,
      hours,
      dread: 1,
      commitment: 'self',
      date: day,
      startHour: slot,
      isRecovery: true,
    };
    return { reading: readingFrom([...items, candidate], today, ceilings), candidate };
  }, [chosen, slot, hours, day, items, today, ceilings]);

  if (justBooked) {
    const entry = prescriptions.find((p) => p.id === justBooked)!;
    return (
      <Screen
        back="/recover"
        backLabel="Recovery"
        footer={
          <>
            <Button label="See the ledger" onPress={() => router.replace('/recover')} />
            {available.length > 0 ? (
              <Button label="Book something else" kind="secondary" onPress={() => { setJustBooked(null); setStart(null); setIndex(0); }} />
            ) : null}
          </>
        }
      >
        <Stack gap={6} className="pt-6">
          <Text variant="micro" tone="steady">BOOKED</Text>
          <Text variant="title" accessibilityRole="header" accessibilityLiveRegion="polite">
            {entry.title}, {slot !== null ? formatHour(slot) : entry.slot}.
          </Text>
          <Card tone="steady" gap={4}>
            <Stack direction="row" gap={5} align="center">
              <Battery charge={reading.charge} loadPercent={reading.overall} width={110} height={54} label={`Now at ${reading.charge} percent`} />
              <Stack gap={1} grow>
                <Text variant="display" tone="steady">{reading.charge}%</Text>
                <Text variant="micro" tone="subtle">of your week left</Text>
              </Stack>
            </Stack>
            <Text variant="footnote" tone="muted">
              It is protected time. You are now {restOwedFrom(recovery)}h down instead.
            </Text>
          </Card>
          <Card gap={4}>
            <Text variant="micro" tone="subtle">TODAY, UPDATED</Text>
            <DayTimeline items={items} date={day} showGaps={false} />
          </Card>
        </Stack>
      </Screen>
    );
  }

  if (!chosen) {
    return (
      <Screen back="/recover" backLabel="Recovery" footer={<Button label="Back to the ledger" onPress={() => router.replace('/recover')} />}>
        <Stack gap={5} className="pt-8">
          <Text variant="title" accessibilityRole="header">Everything is booked.</Text>
          <Text variant="callout" tone="muted">All four blocks are in your week. Go and do one.</Text>
        </Stack>
      </Screen>
    );
  }

  const move = preview ? preview.reading.charge - reading.charge : 0;

  return (
    <Screen
      back="/recover"
      backLabel="Recovery"
      footer={
        <>
          <Button
            label={
              slot === null
                ? `Nothing free on ${formatShort(day)}`
                : `Book ${dayLabel(day, today)} at ${formatHour(slot)}`
            }
            onPress={() => {
              if (slot === null) return;
              bookRecovery(chosen, slot, hours, day);
              successFeedback();
              setJustBooked(chosen.id);
            }}
          />
          {available.length > 1 ? (
            <Button label="Show me something else" kind="secondary" onPress={() => { setIndex((i) => i + 1); setStart(null); }} />
          ) : null}
        </>
      }
    >
      <Stack gap={6} className="pt-4">
        <Stack gap={2}>
          <Text variant="title" accessibilityRole="header">What would actually help</Text>
          <Text variant="callout" tone="muted">
            {BUCKET_LABEL[fullest]} is full, {BUCKET_LABEL[emptiest].toLowerCase()} has room.
          </Text>
        </Stack>

        <Card tone="recovery" gap={4}>
          <Chip label="Best fit today" tone="recovery" readOnly />
          <Stack gap={2}>
            <Text variant="title">{chosen.title}</Text>
            <Text variant="callout" tone="muted">{chosen.detail}</Text>
          </Stack>
          {chosen.tags ? (
            <Stack direction="row" gap={3} wrap>
              {chosen.tags.map((tag) => <Chip key={tag} label={tag} readOnly />)}
            </Stack>
          ) : null}
        </Card>

        <Stack gap={3}>
          <Text variant="micro" tone="subtle">WHICH DAY</Text>
          <Stack direction="row" gap={3} wrap>
            {dayOptions.map((option) => (
              <Chip
                key={option}
                label={dayLabel(option, today)}
                tone={option === day ? 'selected' : 'plain'}
                onPress={() => { setDay(option); setStart(null); }}
              />
            ))}
          </Stack>
        </Stack>

        <Stack gap={3}>
          <Text variant="micro" tone="subtle">HOW LONG</Text>
          <Stack direction="row" gap={3} wrap>
            {DURATIONS.map((option) => (
              <Chip
                key={option}
                label={option < 1 ? `${option * 60}m` : `${option}h`}
                tone={option === hours ? 'selected' : 'plain'}
                onPress={() => { setHours(option); setStart(null); }}
              />
            ))}
          </Stack>
        </Stack>

        <Stack gap={3}>
          <Text variant="micro" tone="subtle">
            WHAT TIME · {gaps.length} GAP{gaps.length === 1 ? '' : 'S'} ON {dayLabel(day, today).toUpperCase()}
          </Text>
          {starts.length ? (
            <Stack direction="row" gap={3} wrap>
              {starts.map((option) => (
                <Chip
                  key={option}
                  label={formatHour(option)}
                  tone={option === slot ? 'selected' : 'plain'}
                  onPress={() => setStart(option)}
                />
              ))}
            </Stack>
          ) : (
            <Text variant="footnote" tone="heavy">
              No gap on {formatShort(day)} is {hours < 1 ? `${hours * 60} minutes` : `${hours} hours`} long. Try a
              shorter block, or another day.
            </Text>
          )}
        </Stack>

        {/* The answer to "what does this cost me", before anything is written. */}
        {preview ? (
          <Card gap={4}>
            <Text variant="micro" tone="subtle">IF YOU BOOK IT</Text>
            <Stack direction="row" gap={5} align="center">
              <Battery
                charge={preview.reading.charge}
                loadPercent={preview.reading.overall}
                width={110}
                height={54}
                label={`Would read ${preview.reading.charge} percent`}
              />
              <Stack gap={1} grow>
                <Stack direction="row" gap={3} align="center">
                  <Text variant="heading" tone="subtle">{reading.charge}%</Text>
                  <Text variant="heading" tone="subtle">→</Text>
                  <Text variant="display" tone={TONE[bandFor(preview.reading.overall)]}>{preview.reading.charge}%</Text>
                </Stack>
                <Text variant="micro" tone={move > 0 ? 'steady' : 'subtle'} accessibilityLiveRegion="polite">
                  {move > 0 ? `+${move}% battery` : 'No change'} · {dayLabel(day, today)}{' '}
                  {formatHour(slot!)}–{formatHour(slot! + hours)}
                </Text>
              </Stack>
            </Stack>
          </Card>
        ) : null}

        <Stack gap={3}>
          <Text variant="micro" tone="subtle">WHERE IT LANDS</Text>
          <Card gap={4}>
            <DayTimeline items={preview ? [...items, preview.candidate] : items} date={day} />
          </Card>
        </Stack>

        <View className="h-2" />
      </Stack>
    </Screen>
  );
}

/** "Today" and "Tomorrow" beat a date on the two days people actually mean. */
function dayLabel(date: string, today: string): string {
  if (date === today) return 'Today';
  if (date === addDays(today, 1)) return 'Tomorrow';
  return formatShort(date);
}
