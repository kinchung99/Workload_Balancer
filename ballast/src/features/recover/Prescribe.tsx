import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Battery, Button, Card, Chip, DayTimeline, Divider, PageHeader, Screen, Stack, StepDots, StepNav,
  Sticker, Text,
} from '@/components';
import { SCREEN } from '@design/screens';
import { BUCKETS, BUCKET_LABEL, bandFor } from '@/lib/load';
import { formatHour, freeSlots, placeIn, startOptions } from '@/lib/schedule';
import { addDays, formatShort } from '@/lib/dates';
import { successFeedback } from '@/lib/haptics';
import type { Item } from '@/lib/types';
import { prescriptions } from '@/data/seed';
import { restOwedFrom, useStore } from '@/state/store';
import { readingFrom, useItemsWithLogs, useReading } from '@/state/selectors';

const DURATIONS = [0.5, 0.75, 1, 1.5];
const STEPS = ['What', 'When'];

/** The two pages, as URL segments. `/prescription/when` opens on the slots. */
export const STEP_SLUGS = ['what', 'when'] as const;
const TONE = { steady: 'steady', busy: 'busy', heavy: 'heavy' } as const;

/**
 * Matched to the area that still has room — and bookable at a time you choose.
 *
 * The previous version offered one fixed slot and told you nothing until after
 * you committed. This shows the free time you actually have, lets you pick the
 * length, and puts the resulting battery and the day itself in front of you
 * before anything is written.
 */
export function Prescribe({ initialStep = 0 }: { initialStep?: number }) {
  const router = useRouter();
  const { ceilings, today, booked, recovery, bookRecovery } = useStore();
  const items = useItemsWithLogs();
  const reading = useReading();

  const fullest = BUCKETS.reduce((a, b) => (reading.percents[a] >= reading.percents[b] ? a : b));
  const emptiest = BUCKETS.reduce((a, b) => (reading.percents[a] <= reading.percents[b] ? a : b));

  /**
   * Ordered by where you still have room, not by what was written first.
   *
   * The rule this screen has always stated is the one underneath: "mental is
   * full, physical has room", so it offers you something physical. Capture now
   * asks which areas a thing drains, which means that answer moves - drain
   * physical with the dials and physical stops being the area with room, and a
   * different kind of rest leads. That loop is what makes the five dials mean
   * something beyond a prettier form.
   */
  const available = prescriptions
    .filter((entry) => !booked.includes(entry.id))
    .slice()
    .sort((a, b) => Number(b.refills === emptiest) - Number(a.refills === emptiest));
  const [index, setIndex] = useState(0);
  const [hours, setHours] = useState(1);
  const [day, setDay] = useState(today);
  const [start, setStart] = useState<number | null>(null);
  const dayOptions = Array.from({ length: 5 }, (_, offset) => addDays(today, offset));
  const [justBooked, setJustBooked] = useState<string | null>(null);
  // Two questions, asked one at a time: what would help, then when it goes.
  const [step, setStep] = useState(initialStep);

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
        <Stack gap={6} className="pt-4">
          <PageHeader
            sticker="sparkle"
            wash={SCREEN.prescription.wash}
            eyebrow="Booked"
            title={`${entry.title}, ${slot !== null ? formatHour(slot) : entry.slot}.`}
          />
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
        <Stack gap={5} className="pt-4">
          <PageHeader
            sticker="star"
            wash={SCREEN.prescription.wash}
            title="Everything is booked."
            sub="All four blocks are in your week. Go and do one."
          />
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
        <StepNav
          step={step}
          last={1}
          canNext={step === 0 || slot !== null}
          nextLabel={
            step === 0
              ? 'Yes, when?'
              : slot === null
                ? `Nothing free on ${formatShort(day)}`
                : `Book ${dayLabel(day, today)} at ${formatHour(slot)}`
          }
          backLabel="Something else"
          onBack={() => { setStep(0); setStart(null); }}
          onNext={() => {
            if (step === 0) { setStep(1); return; }
            if (slot === null) return;
            bookRecovery(chosen, slot, hours, day);
            successFeedback();
            setJustBooked(chosen.id);
          }}
        />
      }
    >
      <Stack gap={5} className="pt-2">
        <StepDots labels={STEPS} current={step} onJump={setStep} />
        <PageHeader
          {...SCREEN.prescription}
          title={step === 0 ? 'What would help' : 'When does it go?'}
          sub={
            step === 0
              ? `${BUCKET_LABEL[fullest]} is full, ${BUCKET_LABEL[emptiest].toLowerCase()} has room.`
              : `${chosen.title}, ${hours < 1 ? `${hours * 60} minutes` : `${hours} hour${hours === 1 ? '' : 's'}`}`
          }
        />

        {step === 0 ? (
          <Stack gap={5}>
            <Card tone="recovery" gap={4}>
              <Stack direction="row" gap={4} align="center">
                <Sticker name="leaf" size={44} />
                <Stack gap={1} grow>
                  <Text variant="micro" tone="recovery">BEST FIT</Text>
                  <Text variant="title">{chosen.title}</Text>
                </Stack>
              </Stack>
              <Text variant="callout" tone="muted">{chosen.detail}</Text>
              {chosen.tags ? (
                <Stack direction="row" gap={3} wrap>
                  {chosen.tags.map((tag) => <Chip key={tag} label={tag} readOnly />)}
                </Stack>
              ) : null}
            </Card>

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

            {available.length > 1 ? (
              <Stack gap={3}>
                <Text variant="micro" tone="subtle">OR ONE OF THESE</Text>
                <Stack direction="row" gap={3} wrap>
                  {available.filter((entry) => entry.id !== chosen.id).map((entry) => (
                    <Chip
                      key={entry.id}
                      label={entry.title}
                      onPress={() => { setIndex(available.indexOf(entry)); setStart(null); }}
                    />
                  ))}
                </Stack>
              </Stack>
            ) : null}
          </Stack>
        ) : null}

        {step === 1 ? (
        <Stack gap={5}>
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
        </Stack>
        ) : null}

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
