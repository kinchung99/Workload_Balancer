import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { AreaIcon, Button, PageHeader, Screen, Stack, StepDots, Text } from '@/components';
import { color } from '@design/tokens';
import { dayIndex, formatShort } from '@/lib/dates';
import { sittingsOf } from '@/lib/prep';
import type { Item } from '@/lib/types';
import { formatHour } from '@/lib/schedule';
import { batteryCost } from '@/lib/drain';
import { prioritise, startLabel, type Ranked } from '@/lib/priority';
import { clockHour } from '@/lib/marking';
import { weightsFrom } from '@/lib/review';
import { successFeedback, tapFeedback } from '@/lib/haptics';
import { useStore } from '@/state/store';
import { useItemsWithLogs } from '@/state/selectors';
import { MoveItem } from '@/features/item/MoveItem';
import { CancelTask } from '@/features/item/CancelTask';
import { Cheer } from '@/features/item/Cheer';

/** A block from the sample week that can be swapped, so the page is prerendered. */
export async function generateStaticParams() {
  return [{ id: 'revision' }];
}

const STEPS = ['Pick', 'Plan', 'Move'];
const WEEKDAY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const span = (start: number, hours: number) => `${formatHour(start)}–${formatHour(start + hours)}`;
const hoursWord = (h: number) => (h < 1 ? `${Math.round(h * 60)}m` : `${Math.round(h * 10) / 10}h`);

/**
 * Making room: give a block you could move to something that matters more.
 *
 * Three steps, one decision each. Pick what this time should go to, from the
 * same list as "what to do first". See it land in the slot. Then give the block
 * that was there a new time - or let it go. Nothing is changed until the second
 * step says so, and nothing is left without a place at the end.
 */
export default function Swap() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { today, dayReports, ceilings, scheduleSessions, updateSession, moveItem, scheduleItem } = useStore();
  const items = useItemsWithLogs();
  const block = items.find((candidate) => candidate.id === id);
  const weights = useMemo(() => weightsFrom(dayReports), [dayReports]);
  const { first } = useMemo(() => prioritise(items, today, 7, weights, clockHour(today)), [items, today, weights]);

  const [step, setStep] = useState(0);
  const [chosen, setChosen] = useState<Ranked | null>(null);
  const [planned, setPlanned] = useState<string | null>(null);
  const [moved, setMoved] = useState<string | null>(null);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/priority' as Href));

  if (!block || block.startHour === undefined) {
    return (
      <Screen back="/priority" backLabel="What first">
        <Stack gap={4} className="pt-6">
          <PageHeader sticker="scales" wash={color.decor.lemon} title="Already sorted" sub="That block has moved or gone." />
        </Stack>
      </Screen>
    );
  }

  const slot = { date: block.date, startHour: block.startHour, hours: block.hours };
  /** How much of this slot a task would get - or why it does not fit. */
  const give = (row: Ranked): { hours: number; fits: boolean; label: string; sitting?: Item } => {
    if (row.kind === 'owing') {
      if ((row.need ?? 0) > 0) {
        const hours = Math.min(slot.hours, Math.max(0.5, row.need ?? 0));
        return { hours, fits: true, label: `gets ${hoursWord(hours)}` };
      }
      // All of it is booked: bring its next sitting into this time instead.
      const sitting = sittingsOf(row.item, items)
        .filter((x) => !x.sessionDone && x.startHour !== undefined && x.date >= today && !(x.date === slot.date && x.startHour === slot.startHour))
        .sort((a, b) => a.date.localeCompare(b.date) || a.startHour! - b.startHour!)[0];
      if (!sitting) return { hours: 0, fits: false, label: 'all done' };
      const hours = Math.min(slot.hours, sitting.hours);
      return { hours, fits: true, label: `moves its ${WEEKDAY[dayIndex(sitting.date)]} sitting`, sitting };
    }
    return { hours: row.item.hours, fits: row.item.hours <= slot.hours + 0.01, label: row.item.hours <= slot.hours + 0.01 ? `gets ${hoursWord(row.item.hours)}` : `needs ${hoursWord(row.item.hours)}` };
  };
  const options = first.filter((row) => row.item.id !== block.id && give(row).label !== 'all done');

  const plan = () => {
    if (!chosen) return;
    const { hours, sitting } = give(chosen);
    if (sitting) {
      updateSession(sitting.id, { date: slot.date, startHour: slot.startHour, hours });
    } else if (chosen.kind === 'owing') {
      scheduleSessions(chosen.item.id, [{ date: slot.date, startHour: slot.startHour, hours }]);
    } else {
      if (chosen.item.date !== slot.date) moveItem(chosen.item.id, slot.date);
      scheduleItem(chosen.item.id, slot.startHour);
    }
    successFeedback();
    setPlanned(`${chosen.item.title} · ${formatShort(slot.date)} ${span(slot.startHour, hours)}`);
    setStep(2);
  };

  const finish = (where: string | null) => { setMoved(where); setStep(3); };

  return (
    <Screen
      back="/priority"
      backLabel="What first"
      footer={
        step === 1 ? (
          <Stack direction="row" gap={3}>
            <Button label="Back" kind="secondary" className="flex-1" onPress={() => { tapFeedback(); setStep(0); }} />
            <Button label="Plan it here" className="flex-[2]" onPress={plan} />
          </Stack>
        ) : step === 3 ? (
          <Button label="Back to what first" onPress={back} />
        ) : undefined
      }
    >
      <Stack gap={5} className="pt-2">
        <PageHeader sticker="scales" wash={color.decor.lemon} eyebrow="Make room" title="Swap this time" />

        {/* The block being given up. */}
        <Stack direction="row" gap={3} align="center" className="rounded-xl px-4 py-4" style={{ backgroundColor: color.band.busy.wash, borderWidth: 2, borderColor: color.band.busy.fill }}>
          <View className="items-center justify-center rounded-pill bg-raised" style={{ width: 44, height: 44 }}>
            <AreaIcon area={block.bucket} size={24} />
          </View>
          <Stack gap={0} grow>
            <Text variant="body" weight="semibold">{block.title}</Text>
            <Text variant="micro" tone="muted">{formatShort(block.date)} · {span(block.startHour, block.hours)}</Text>
          </Stack>
          <View className="rounded-pill bg-raised px-3 py-1">
            <Text variant="micro" weight="bold" tone="steady">+{Math.max(1, batteryCost(items, block, ceilings))}% back</Text>
          </View>
        </Stack>

        {step < 3 ? <StepDots labels={STEPS} current={Math.min(step, 2)} /> : null}

        {/* 1 · What should this time go to? */}
        {step === 0 ? (
          <Stack gap={3}>
            <Text variant="heading">Use this time for…</Text>
            {!options.length ? (
              <Text variant="footnote" tone="muted">Nothing is waiting for time - everything on your list is booked.</Text>
            ) : null}
            {options.map((row, index) => {
              const share = give(row);
              return (
                <Pressable
                  key={row.item.id}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !share.fits }}
                  accessibilityLabel={`${row.item.title}. ${startLabel(row, today)}. ${share.label}`}
                  disabled={!share.fits}
                  onPress={() => { tapFeedback(); setChosen(row); setStep(1); }}
                  className={`flex-row items-center gap-3 rounded-lg border-2 border-line-hairline bg-raised px-4 py-3 ${share.fits ? 'active:opacity-70' : 'opacity-50'}`}
                >
                  <View className="items-center justify-center rounded-pill bg-sunken" style={{ width: 30, height: 30 }}>
                    <Text variant="callout" weight="bold" tone="muted">{index + 1}</Text>
                  </View>
                  <Stack gap={0} grow>
                    <Text variant="body" weight="semibold">{row.item.title}</Text>
                    <Text variant="micro" tone="subtle">▶ {startLabel(row, today)}{row.kind === 'owing' && (row.need ?? 0) > 0 ? ` · ${row.need}h to plan` : ''}</Text>
                  </Stack>
                  <View className="rounded-pill px-3 py-1" style={{ backgroundColor: share.fits ? color.band.steady.wash : color.surface.sunken }}>
                    <Text variant="micro" weight="bold" tone={share.fits ? 'steady' : 'muted'}>{share.label}</Text>
                  </View>
                </Pressable>
              );
            })}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Leave it empty, just move the block"
              onPress={() => { tapFeedback(); setChosen(null); setStep(2); }}
              className="items-center rounded-lg border-2 border-dashed border-line-strong px-4 py-3 active:opacity-70"
            >
              <Text variant="callout" weight="semibold">Leave it empty · just move it</Text>
            </Pressable>
          </Stack>
        ) : null}

        {/* 2 · See it land. */}
        {step === 1 && chosen ? (
          <Stack gap={3} align="center">
            <Text variant="title">↓</Text>
            <Stack gap={1} className="w-full rounded-xl px-4 py-4" style={{ backgroundColor: color.band.steady.wash, borderWidth: 2, borderColor: color.band.steady.fill }}>
              <Text variant="micro" tone="steady" weight="bold">TAKES ITS PLACE</Text>
              <Text variant="heading">{chosen.item.title}</Text>
              <Text variant="footnote" tone="muted">
                {formatShort(slot.date)} · {span(slot.startHour, give(chosen).hours)}{give(chosen).sitting ? ' · moved from its booked sitting' : chosen.kind === 'owing' ? ' · a sitting' : ''}
              </Text>
            </Stack>
            <Text variant="footnote" tone="muted" className="text-center">Next, you’ll find {block.title} a new time.</Text>
          </Stack>
        ) : null}

        {/* 3 · The block that was there needs somewhere to go. */}
        {step === 2 ? (
          <Stack gap={3}>
            {planned ? (
              <Stack direction="row" gap={2} align="center" className="rounded-md px-3 py-2" style={{ backgroundColor: color.band.steady.wash }}>
                <Text variant="callout">✓</Text>
                <Text variant="footnote" weight="semibold" tone="steady" className="flex-1">{planned}</Text>
              </Stack>
            ) : null}
            <Text variant="heading">Where does {block.title} go now?</Text>
            <MoveItem item={block} replace={false} onDone={(where) => finish(`${block.title} · ${where}`)} />
            <CancelTask item={block} kind="quiet" label="🗑 Drop it instead" onCancelled={() => finish(null)} />
          </Stack>
        ) : null}

        {/* Done: what changed, in two lines. */}
        {step === 3 ? (
          <Stack gap={3}>
            <Cheer title="Room made" sub={planned ? 'Something that matters got the time.' : 'The time is yours again.'} />
            {planned ? <Line text={planned} /> : null}
            <Line text={moved ?? `${block.title} · dropped`} />
          </Stack>
        ) : null}

        <View className="h-2" />
      </Stack>
    </Screen>
  );
}

function Line({ text }: { text: string }) {
  return (
    <Stack direction="row" gap={2} align="center" className="rounded-md bg-raised px-4 py-3" style={{ borderWidth: 1, borderColor: color.line.hairline }}>
      <Text variant="callout" tone="steady">✓</Text>
      <Text variant="footnote" weight="semibold" className="flex-1">{text}</Text>
    </Stack>
  );
}
