import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Battery, Button, Card, Chip, DayTimeline, Disclosure, PageHeader, Screen, Section, Stack, StepDots, StepNav, Text,
} from '@/components';
import { color } from '@design/tokens';
import { SCREEN } from '@design/screens';
import { BUCKETS, BUCKET_LABEL, bandFor } from '@/lib/load';
import { formatHour, freeSlots, placeIn, startOptions } from '@/lib/schedule';
import { addDays, formatShort } from '@/lib/dates';
import { successFeedback, tapFeedback } from '@/lib/haptics';
import { api, hasServer } from '@/lib/api';
import { CATALOGUE, DURATIONS, VIBES, fromIdea, fromSeed, hoursFor, rankRest, type RestEntry } from '@/lib/rest';
import type { Item } from '@/lib/types';
import type { RestContext, VibeId } from '@shared/contract';
import { prescriptions } from '@/data/seed';
import { restOwedFrom, useStore } from '@/state/store';
import { readingFrom, useItemsWithLogs, useReading } from '@/state/selectors';
import { IdeaDeck } from './IdeaDeck';

const STEPS = ['What', 'When'];
/** Ideas per round. Past the last one, "Another idea" asks for a fresh round. */
const ROUND = 5;

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
  const { ceilings, today, booked, recovery, bookRecovery, mode, account, sleepHours } = useStore();
  const items = useItemsWithLogs();
  const reading = useReading();
  const online = hasServer() && !!account;

  const fullest = BUCKETS.reduce((a, b) => (reading.percents[a] >= reading.percents[b] ? a : b));
  const emptiest = BUCKETS.reduce((a, b) => (reading.percents[a] <= reading.percents[b] ? a : b));

  /**
   * Ordered by where you still have room, not by what was written first.
   *
   * The rule this screen has always stated is the one underneath: "mental is
   * full, physical has room", so it offers you something physical. Capture asks
   * which areas a thing drains, which means that answer moves - drain physical
   * and a different kind of rest leads.
   *
   * With an account, Claude suggests from those same numbers (and nothing
   * else). Without one, the phone ranks its own catalogue. Either way "Another
   * idea" never runs dry: past the last card it asks for a fresh round,
   * excluding everything already shown.
   */
  const pool = useMemo<RestEntry[]>(
    () => [...(mode === 'demo' ? prescriptions.map(fromSeed) : []), ...CATALOGUE].filter((e) => !booked.includes(e.id)),
    [mode, booked],
  );
  const [vibes, setVibes] = useState<VibeId[]>([]);
  const rankFor = (moods: VibeId[]) => rankRest(pool, { vibes: moods, room: emptiest, full: fullest });
  const [deck, setDeck] = useState<RestEntry[]>(() => (online ? [] : rankFor([]).slice(0, ROUND)));
  const [source, setSource] = useState<'claude' | 'phone'>('phone');
  const [loading, setLoading] = useState(online);
  const [round, setRound] = useState(1);
  /** Titles already shown this visit, so a fresh round is genuinely fresh. */
  const shown = useRef<string[]>([]);
  const [index, setIndex] = useState(0);
  const [hours, setHours] = useState(1);
  const [day, setDay] = useState(today);
  const [start, setStart] = useState<number | null>(null);
  const dayOptions = Array.from({ length: 5 }, (_, offset) => addDays(today, offset));
  const [justBooked, setJustBooked] = useState<RestEntry | null>(null);
  // Two questions, asked one at a time: what would help, then when it goes.
  const [step, setStep] = useState(initialStep);

  /** A round of ideas: Claude's if it can, the phone's otherwise. */
  const fetchRound = async (moods: VibeId[], fresh: boolean) => {
    if (fresh) shown.current = [];
    const exclude = [...shown.current];
    if (online) {
      setLoading(true);
      const result = await api.restIdeas({
        areas: Object.fromEntries(
          BUCKETS.map((key) => [key, Math.max(0, Math.min(400, Math.round(reading.percents[key])))]),
        ) as RestContext['areas'],
        charge: reading.charge,
        sleepHours: sleepHours ?? undefined,
        free: freeSlots(items, today, 0.5).map(({ start: from, end }) => ({ start: from, end })),
        vibes: moods,
        exclude: exclude.slice(-60),
      });
      setLoading(false);
      if (result.ok && result.data.ideas.length) {
        setSource('claude');
        return result.data.ideas.map(fromIdea).filter((e) => !booked.includes(e.id));
      }
    }
    setSource('phone');
    const ranked = rankFor(moods);
    const unseen = ranked.filter((e) => !exclude.includes(e.title));
    // Everything has been shown: start the list again rather than come up empty.
    return (unseen.length ? unseen : ranked).slice(0, ROUND);
  };

  const load = async (moods: VibeId[], fresh: boolean) => {
    const next = await fetchRound(moods, fresh);
    setDeck(next);
    setIndex(0);
    setStart(null);
  };

  useEffect(() => {
    if (online) void load([], true);
    // Once, on arrival; moods and "Another idea" ask again on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chosen = deck[index] ?? null;

  // Every card shown counts as seen, and sets the length to what it is meant to take.
  useEffect(() => {
    if (!chosen) return;
    if (!shown.current.includes(chosen.title)) shown.current.push(chosen.title);
    setHours(hoursFor(chosen.minutes));
    setStart(null);
  }, [chosen?.id]);

  const another = () => {
    if (index + 1 < deck.length) { setIndex(index + 1); return; }
    setRound(round + 1);
    void load(vibes, false);
  };

  const toggleVibe = (vibe: VibeId) => {
    tapFeedback();
    const next = vibes.includes(vibe) ? vibes.filter((v) => v !== vibe) : [...vibes, vibe];
    setVibes(next);
    setRound(1);
    void load(next, !online);
  };


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
    const entry = justBooked;
    return (
      <Screen
        back="/recover"
        backLabel="Recovery"
        footer={
          <>
            <Button label="See the ledger" onPress={() => router.replace('/recover')} />
            <Button
              label="Book something else"
              kind="secondary"
              onPress={() => { setJustBooked(null); setStep(0); setStart(null); another(); }}
            />
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
          <Section family="week" title={`${dayLabel(day, today)}, updated`} sticker="clock">
            <Card gap={4}>
              <DayTimeline items={items} date={day} showGaps={false} />
            </Card>
          </Section>
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
          canNext={step === 0 ? !!chosen && !loading : slot !== null}
          nextLabel={
            step === 0
              ? chosen ? 'Yes, when?' : 'Finding ideas…'
              : slot === null
                ? `Nothing free on ${formatShort(day)}`
                : `Book ${dayLabel(day, today)} at ${formatHour(slot)}`
          }
          backLabel="Something else"
          onBack={() => { setStep(0); setStart(null); }}
          onNext={() => {
            if (!chosen) return;
            if (step === 0) { setStep(1); return; }
            if (slot === null) return;
            bookRecovery(chosen, slot, hours, day);
            successFeedback();
            setJustBooked(chosen);
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
              : `${chosen?.title ?? ''}, ${hours < 1 ? `${hours * 60} minutes` : `${hours} hour${hours === 1 ? '' : 's'}`}`
          }
        />

        {step === 0 ? (
          <Stack gap={5}>
            {/* What kind of rest, in one tap each. Changing them asks again. */}
            <Stack gap={2}>
              <Text variant="micro" tone="subtle">IN THE MOOD FOR</Text>
              <Stack direction="row" gap={2} wrap>
                {VIBES.map((vibe) => (
                  <Chip
                    key={vibe.id}
                    label={`${vibe.emoji} ${vibe.label}`}
                    tone={vibes.includes(vibe.id) ? 'selected' : 'plain'}
                    onPress={() => toggleVibe(vibe.id)}
                  />
                ))}
              </Stack>
            </Stack>

            <Stack direction="row" align="center" justify="between">
              <View className="rounded-pill px-3 py-1" style={{ backgroundColor: source === 'claude' || loading ? color.area.mental.wash : color.surface.sunken }}>
                <Text variant="micro" tone={source === 'claude' || loading ? 'default' : 'subtle'}>
                  {loading ? '✨ ASKING CLAUDE…' : source === 'claude' ? '✨ IDEAS FROM CLAUDE' : '📱 IDEAS ON YOUR PHONE'}
                </Text>
              </View>
              {chosen ? <Text variant="micro" tone="subtle">ROUND {round} · {index + 1} OF {deck.length}</Text> : null}
            </Stack>

            <IdeaDeck
              entry={chosen}
              label={index === 0 && round === 1 ? 'BEST FIT' : `IDEA ${index + 1} OF ${deck.length}`}
              loading={loading}
              onNext={another}
              onPick={() => setStep(1)}
            />

            {/* Two small choices, shown as they are. */}
            <Stack gap={2}>
              <Text variant="micro" tone="subtle">⏱ HOW LONG</Text>
              <Stack direction="row" gap={2} wrap>
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

            {deck.length > 1 ? (
              <Stack gap={2}>
                <Text variant="micro" tone="subtle">🗂️ OR ONE OF THESE</Text>
                <Stack direction="row" gap={2} wrap>
                  {deck.filter((entry) => entry.id !== chosen?.id).map((entry) => (
                    <Chip
                      key={entry.id}
                      label={`${entry.emoji ?? ''} ${entry.title}`.trim()}
                      onPress={() => { tapFeedback(); setIndex(deck.indexOf(entry)); }}
                    />
                  ))}
                </Stack>
              </Stack>
            ) : null}
          </Stack>
        ) : null}

        {step === 1 ? (
        <Stack gap={5}>
        <Section family="week" title="Pick a slot" sticker="clock">
          <Text variant="micro" tone="subtle">WHICH DAY</Text>
          <Stack direction="row" gap={2} wrap>
            {dayOptions.map((option) => (
              <Chip
                key={option}
                label={dayLabel(option, today)}
                tone={option === day ? 'selected' : 'plain'}
                onPress={() => { setDay(option); setStart(null); }}
              />
            ))}
          </Stack>
          <Text variant="micro" tone="subtle">
            WHAT TIME · {gaps.length} GAP{gaps.length === 1 ? '' : 'S'} ON {dayLabel(day, today).toUpperCase()}
          </Text>
          {starts.length ? (
            <Stack direction="row" gap={2} wrap>
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
        </Section>

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

        <Disclosure
          lead="🕒"
          title="Where it lands"
          summary={slot !== null ? `${dayLabel(day, today)} ${formatHour(slot)}–${formatHour(slot + hours)}` : `${dayLabel(day, today)}, nothing free`}
        >
          <DayTimeline items={preview ? [...items, preview.candidate] : items} date={day} />
        </Disclosure>
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
