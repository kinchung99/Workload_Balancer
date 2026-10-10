import { useEffect, useState } from 'react';
import { successFeedback, tapFeedback } from '@/lib/haptics';
import { Pressable, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Battery, Button, Card, Chip, DayTimeline, Disclosure, PageHeader, Screen, Section, Slider, Sticker, Stack,
  StepDots, StepNav, Text,
} from '@/components';
import { SCREEN } from '@design/screens';
import {
  ACTIONS, OFF_HOURS, PRESETS, customAction, initialSim, note, planBlocks, planItem, pointsOf, readout,
} from '@/lib/simulate';
import { chargeExact } from '@/lib/checkin';
import { capacityOf } from '@/lib/load';
import { chargeOf } from '@/lib/battery';
import { bandFor } from '@/lib/load';
import { useStore } from '@/state/store';
import { useItemsWithLogs } from '@/state/selectors';
import { daySchedule, formatHour, freeSlots, placeIn, sleepWindow, startOptions } from '@/lib/schedule';
import { addDays, formatShort } from '@/lib/dates';
import type { Item } from '@/lib/types';
import { color } from '@design/tokens';
import { useReading } from '@/state/selectors';

const TONE = { steady: 'steady', busy: 'busy', heavy: 'heavy' } as const;
const STEPS = ['Which night', 'What you do', 'Book it'];
/** A face for each kind of night, so the three read apart at a glance. */
const PRESET_EMOJI: Record<string, string> = { recover: '🌿', balanced: '⚖️', push: '🔥' };

/** The three pages, as URL segments. `/tonight/book` opens on the slots. */
export const STEP_SLUGS = ['night', 'what', 'book'] as const;

/** One drawing and one question per page. */
const ART = [
  { sticker: 'moon', title: 'Which night?' },
  { sticker: 'sparkle', title: 'What would you do?' },
  { sticker: 'clock', title: 'Book it?' },
] as const;

/**
 * What if I… — the simulator.
 *
 * Drag a slider, watch the battery move. Sleep, walking and seeing people give
 * charge back; a study session and late-night screen time take it. Nothing here
 * is a health claim: these are coefficients for one student's week, not advice.
 */
/** A change to the battery as people say it: "+10%", "−27%". */
const pctWord = (points: number): string => {
  const rounded = Math.round(points);
  return rounded > 0 ? `+${rounded}%` : rounded < 0 ? `−${-rounded}%` : '0%';
};

export function Tonight({ initialStep = 0 }: { initialStep?: number }) {
  const router = useRouter();
  const {
    today, applyPlan, clearPlan, offHour, setOffHour, customActions, addCustomAction, removeCustomAction,
    items: stored, ceilings, meals, moods, errands, moments, sleepHours,
  } = useStore();
  const items = useItemsWithLogs();
  const { overall } = useReading();
  const capacity = capacityOf(ceilings);

  const now = chargeOf(overall);
  // The shipped five plus whatever the student added for their own evening.
  const allActions = [...ACTIONS, ...customActions];
  const [step, setStep] = useState(initialStep);
  const [sim, setSim] = useState<Record<string, number>>(initialSim);
  const [newLabel, setNewLabel] = useState('');
  const [newHours, setNewHours] = useState(1);
  const [addingActivity, setAddingActivity] = useState(false);
  /** Hours the student chose by hand, overriding where the app would put a block. */
  const [chosenHour, setChosenHour] = useState<Record<string, number>>({});
  const [pickingFor, setPickingFor] = useState<string | null>(null);
  /** Free hours in an evening, from when the day becomes yours until eleven. */
  const eveningFree = (date: string): number =>
    freeSlots(items, date, 0.5)
      .map((slot) => Math.max(0, Math.min(slot.end, 23) - Math.max(slot.start, offHour)))
      .reduce((sum, hours) => sum + hours, 0);
  const evenings = [today, addDays(today, 1), addDays(today, 2)];
  // One evening at a time - starting on the first one that is actually free.
  const [day, setDay] = useState(() => evenings.find((date) => eveningFree(date) >= 2) ?? today);
  // The date can arrive after the first render (signing in): start again from the real tonight.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setDay(evenings.find((date) => eveningFree(date) >= 2) ?? today); }, [today]);
  const dayName = day === today ? 'Tonight' : day === addDays(today, 1) ? 'Tomorrow night' : formatShort(day);
  const [committed, setCommitted] = useState<{ blocks: number; points: number } | null>(null);
  const value = (id: string) => sim[id] ?? 0;
  const isPlanBlock = (id: string) => id.startsWith('plan-') && id.endsWith(`-${day}`);

  /*
   * Every part of the evening becomes a real block - rest that gives charge
   * back, and a study session or late-night scrolling that costs it - and the
   * projection is the battery measured with exactly those blocks in the week,
   * by the same sum as everywhere else. So the number promised here is the
   * number you get after booking. Sleep is the night, not a block: it lands as
   * a log, like the check-in's.
   */
  const sleepAction = allActions.find((a) => a.logOnly)!;
  const blocksFor = (state: Record<string, number>) => planBlocks(allActions, state);
  const chargeWith = (state: Record<string, number>): number => {
    const plan = blocksFor(state).map((block) => planItem(block, day));
    const sleep = state[sleepAction.id] ?? sleepAction.baseline;
    return chargeExact({
      items: [...stored.filter((item) => !isPlanBlock(item.id)), ...plan],
      ceilings, today, meals, moods, errands, moments,
      sleepHours: sleep !== sleepAction.baseline ? sleep : sleepHours,
    });
  };
  /** What one part of the evening does on its own, in battery points. */
  const partOf = (action: (typeof allActions)[number], state: Record<string, number>): number =>
    action.logOnly
      ? chargeWith(state) - chargeWith({ ...state, [action.id]: action.baseline })
      : (pointsOf(action, state[action.id] ?? action.baseline) / capacity) * 100;

  const projected = Math.round(chargeWith(sim));
  const delta = projected - now;
  const projectedLoad = 100 - projected;
  const gains = blocksFor(sim);

  // Blocks this plan would replace must not be treated as occupied, or pressing
  // apply twice makes the walk hop to a different hour each time.
  // Blocks belonging to this day's plan are not "occupied" - applying replaces
  // them - so placement stays stable however many times the button is pressed.
  const otherItems = items.filter((item) => !isPlanBlock(item.id));
  const alreadyBooked = items.filter((item) => isPlanBlock(item.id));

  // Give each one a real slot in today, first gap that fits, none reused.
  const placed = gains.reduce<Array<(typeof gains)[number] & { startHour?: number; suggested?: number }>>((acc, block) => {
    const taken: Item[] = acc
      .filter((b) => b.startHour !== undefined)
      .map((b) => ({
        id: b.id, title: b.label, bucket: b.bucket, hours: b.hours,
        // `day`, not `today`. Dated to today, a block placed earlier in this
        // same pass did not count as occupied on any other evening - so a walk
        // and your own activity were both offered the same hour.
        dread: 1, commitment: 'self', date: day, startHour: b.startHour, isRecovery: true,
      }));
    // Placed in the window the activity belongs in, and never on top of one
    // already placed by this same plan.
    // Nothing before the hour the student says their day is their own - unless
    // they picked an hour themselves, which always wins.
    const suggested = placeIn([...otherItems, ...taken], day, block.hours, block.preferred, offHour);
    return [...acc, { ...block, startHour: chosenHour[block.id] ?? suggested, suggested }];
  }, []);

  const sleepChanged = sim[sleepAction.id] !== sleepAction.baseline;
  // What a night of this length would actually mean in clock time.
  const night = sleepWindow(items, day, value(sleepAction.id));
  const firstTomorrow = daySchedule(items, addDays(day, 1)).timed[0];
  // Booked whether or not a gap was found: a block with no time still costs, or
  // gives back, what it says - it just waits in the day's list.
  const toBook = placed;

  if (committed) {
    return (
      <Screen
        back="/you"
        backLabel="You"
        footer={
          <>
            <Button label="See the ledger" onPress={() => router.push('/recover')} />
            <Button
              label="Plan something else"
              kind="secondary"
              onPress={() => {
                setCommitted(null);
                setSim(initialSim());
              }}
            />
          </>
        }
      >
        <Stack gap={5} className="pt-4">
          <PageHeader
            sticker="star"
            wash={SCREEN.tonight.wash}
            eyebrow="In your week"
            title={`${committed.blocks} thing${committed.blocks === 1 ? '' : 's'} booked.`}
          />
          <Card tone="steady" gap={4}>
            <Stack direction="row" gap={4} align="center">
              <Sticker name="star" size={48} />
              <Stack gap={1} grow>
                <Text variant="heading" tone="steady">{pctWord(committed.points)} battery</Text>
                <Text variant="footnote" tone="muted">Protected time now.</Text>
              </Stack>
            </Stack>
          </Card>

          <Section family="week" title={`${dayName}, updated`} sticker="clock">
            <Card gap={4}>
              <DayTimeline items={items} date={day} showGaps={false} />
            </Card>
          </Section>
        </Stack>
      </Screen>
    );
  }

  return (
    <Screen
      back="/you"
      backLabel="You"
      footer={
        <StepNav
          step={step}
          last={2}
          canNext={step === 0 || (step === 1 ? delta !== 0 : !!toBook.length || sleepChanged)}
          nextLabel={
            step === 0
              ? `Plan ${dayName.toLowerCase()}`
              : step === 1
                ? delta === 0 ? 'Pick a night first' : 'Next'
                : toBook.length || sleepChanged
                  ? `${alreadyBooked.length ? 'Replace' : 'Book'} · ${toBook.length + (sleepChanged ? 1 : 0)} thing${toBook.length + (sleepChanged ? 1 : 0) === 1 ? '' : 's'}`
                  : 'Pick a night first'
          }
          onBack={() => setStep(step - 1)}
          onNext={() => {
            if (step === 1 && delta === 0) return;
            if (step < 2) { setStep(step + 1); return; }
            if (!toBook.length && !sleepChanged) return;
            applyPlan(toBook, sleepChanged ? sim[sleepAction.id] : undefined, day);
            successFeedback();
            setCommitted({ blocks: toBook.length + (sleepChanged ? 1 : 0), points: delta });
          }}
        />
      }
    >
      <Stack gap={5} className="pt-2">
        <StepDots labels={STEPS} current={step} onJump={setStep} />
        <PageHeader
          sticker={ART[step].sticker}
          wash={SCREEN.tonight.wash}
          eyebrow={dayName}
          title={ART[step].title}
        />

        {step === 0 ? (
          <Stack gap={4}>
            {/* Which evening: three big tiles, one tap. */}
            <Stack direction="row" gap={3}>
              {evenings.map((option) => {
                const chosen = option === day;
                const label = option === today ? 'Tonight' : option === addDays(today, 1) ? 'Tomorrow' : formatShort(option).slice(0, 3);
                const free = Math.floor(eveningFree(option));
                return (
                  <Pressable
                    key={option}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: chosen }}
                    accessibilityLabel={`${label}, ${formatShort(option)}`}
                    onPress={() => { tapFeedback(); setDay(option); }}
                    className={`min-h-row flex-1 items-center justify-center gap-1 rounded-lg border-2 px-2 py-4 active:opacity-70 ${
                      chosen ? 'border-inverse bg-inverse' : 'border-line-hairline bg-raised'
                    }`}
                  >
                    <Text variant="callout" weight="semibold" tone={chosen ? 'inverse' : 'default'}>{label}</Text>
                    <Text variant="micro" tone={chosen ? 'inverse' : free >= 2 ? 'steady' : 'heavy'}>
                      {free >= 1 ? `${free}h free` : 'Busy'}
                    </Text>
                  </Pressable>
                );
              })}
            </Stack>

            {/* When the evening starts being yours. */}
            <Stack gap={2} className="rounded-lg bg-sunken px-4 py-3">
              <Text variant="callout" weight="semibold">🕔 Free from {formatHour(offHour)}</Text>
              <Stack direction="row" gap={2} wrap>
                {OFF_HOURS.map((hour) => (
                  <Chip
                    key={hour}
                    label={formatHour(hour)}
                    tone={hour === offHour ? 'selected' : 'plain'}
                    onPress={() => setOffHour(hour)}
                  />
                ))}
              </Stack>
            </Stack>

            {/* What is already booked for that evening, and a way to take it back. */}
            {alreadyBooked.length ? (
              <Section family="rest" title="Already booked" meta={dayName}>
                {alreadyBooked.map((block) => (
                  <Stack key={block.id} direction="row" gap={3} align="center" className="rounded-md bg-raised px-4 py-3">
                    <Text variant="body" weight="semibold" className="flex-1">{block.title}</Text>
                    <Text variant="footnote" tone="muted">
                      {formatHour(block.startHour ?? 0)}–{formatHour((block.startHour ?? 0) + block.hours)}
                    </Text>
                  </Stack>
                ))}
                <Button
                  label="Clear this evening"
                  kind="secondary"
                  onPress={() => {
                    clearPlan(day);
                    successFeedback();
                  }}
                />
              </Section>
            ) : null}
          </Stack>
        ) : null}

        {step === 1 ? (
          <Stack gap={5}>
            {/* Now, and what this evening would make of it - on top, so every
                choice below visibly moves it. */}
            <Card gap={3}>
              <Stack direction="row" gap={3} align="center" justify="between">
                <Stack gap={2} align="center" grow>
                  <Text variant="micro" tone="subtle">NOW</Text>
                  <Battery charge={now} loadPercent={overall} width={84} height={40} label={`Now, ${now} percent`} />
                  <Text variant="heading" tone={TONE[bandFor(overall)]}>{now}%</Text>
                </Stack>
                <Chip
                  label={delta === 0 ? '—' : pctWord(delta)}
                  tone={delta > 0 ? 'steady' : delta < 0 ? 'heavy' : 'plain'}
                  readOnly
                />
                <Stack gap={2} align="center" grow>
                  <Text variant="micro" tone="subtle">PROJECTED</Text>
                  <Battery
                    charge={projected}
                    loadPercent={projectedLoad}
                    width={84}
                    height={40}
                    label={`Projected, ${projected} percent`}
                  />
                  <Text
                    variant="heading"
                    tone={TONE[bandFor(projectedLoad)]}
                    accessibilityLiveRegion="polite"
                    accessibilityLabel={`Projected ${projected} percent, ${delta >= 0 ? 'up' : 'down'} ${Math.abs(delta)} points`}
                  >
                    {projected}%
                  </Text>
                </Stack>
              </Stack>
            </Card>

            {/* Most people are choosing a kind of night, not dialling in sliders. */}
            <Section family="rest" title="Pick a night" sticker="moon">
              {PRESETS.map((preset) => {
                const outcome = Math.round(chargeWith({ ...sim, ...preset.state }));
                const points = outcome - now;
                const active = ACTIONS.every((action) => sim[action.id] === preset.state[action.id]);
                return (
                  <Pressable
                    key={preset.id}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`${preset.label}. ${preset.note}. Would leave you at ${outcome} percent.`}
                    onPress={() => {
                      successFeedback();
                      // Keep whatever the student added; a preset only sets the five.
                      setSim((current) => ({ ...current, ...preset.state }));
                    }}
                    className={`min-h-row justify-center rounded-lg border-2 px-4 py-3 active:opacity-70 ${
                      active ? 'border-inverse bg-raised' : 'border-line-hairline bg-raised'
                    }`}
                  >
                    <Stack direction="row" gap={3} align="center">
                      <Text variant="title">{PRESET_EMOJI[preset.id] ?? '🌙'}</Text>
                      <Stack gap={1} grow>
                        <Text variant="body" weight="semibold">{preset.label}</Text>
                        <Text variant="micro" tone="muted" numberOfLines={1}>{preset.note}</Text>
                      </Stack>
                      <Stack gap={1} align="end">
                        <Text variant="heading" tone={points > 0 ? 'steady' : points < 0 ? 'heavy' : 'muted'}>
                          {outcome}%
                        </Text>
                        <Text variant="micro" tone={points > 0 ? 'steady' : points < 0 ? 'heavy' : 'subtle'}>
                          {pctWord(points)}
                        </Text>
                      </Stack>
                    </Stack>
                  </Pressable>
                );
              })}
            </Section>

            {/* Every part of the evening on its own slider, your own activities
                included - folded, because a preset is usually enough. */}
            <Disclosure
              lead="🎚️"
              title="Fine-tune it"
              summary={`Sleep ${readout(sleepAction, value(sleepAction.id))} · bed by ${formatHour(night.bed)}${customActions.length ? ` · ${customActions.length} of your own` : ''}`}
            >
              <Stack gap={4}>
                {allActions.map((action) => {
                  const current = value(action.id);
                  const points = Math.round(partOf(action, sim));
                  return (
                    <Stack key={action.id} gap={2}>
                      <Stack direction="row" justify="between" align="center" gap={3}>
                        <Text variant="body" weight="semibold" className="flex-1">{action.label}</Text>
                        <Text variant="body" tone="muted">{readout(action, current)}</Text>
                        {points !== 0 ? (
                          <Text variant="micro" weight="semibold" tone={points > 0 ? 'steady' : 'heavy'}>
                            {pctWord(points)}
                          </Text>
                        ) : null}
                      </Stack>
                      <Slider
                        value={current}
                        min={action.min}
                        max={action.max}
                        step={action.step}
                        tone={action.ptsPerUnit > 0 ? 'steady' : 'heavy'}
                        label={action.label}
                        readout={readout(action, current)}
                        onChange={(next) => setSim((prev) => ({ ...prev, [action.id]: next }))}
                      />

                      {/* Sleep is the one slider whose number means nothing on its
                          own: six hours is fine or impossible depending on when
                          tonight finishes, so it says when, not only how long. */}
                      {action.logOnly ? (
                        <Stack gap={2} className={`rounded-md px-3 py-3 ${night.clash ? 'bg-heavy-wash' : 'bg-sunken'}`}>
                          <Stack direction="row" gap={3} justify="between" align="center">
                            <Stack gap={1}>
                              <Text variant="micro" tone="subtle">BED BY</Text>
                              <Text variant="heading" tone={night.clash ? 'heavy' : 'default'}>{formatHour(night.bed)}</Text>
                            </Stack>
                            <Text variant="body" tone="subtle">→</Text>
                            <Stack gap={1}>
                              <Text variant="micro" tone="subtle">TO BE UP AT</Text>
                              <Text variant="heading">{formatHour(night.wake)}</Text>
                            </Stack>
                            <Stack gap={1} align="end">
                              <Text variant="micro" tone="subtle">FIRST THING</Text>
                              <Text variant="footnote" tone="muted">
                                {firstTomorrow ? formatHour(firstTomorrow.startHour!) : 'nothing booked'}
                              </Text>
                            </Stack>
                          </Stack>
                          {night.clash ? (
                            <Text variant="footnote" tone="heavy">
                              Tonight runs to {formatHour(night.lastEnd!)}, so {current}h won’t fit.
                            </Text>
                          ) : night.afterMidnight ? (
                            <Text variant="footnote" tone="busy">That is past midnight — fine once, not as a habit.</Text>
                          ) : (
                            <Text variant="footnote" tone="steady">Fits: nothing runs past {formatHour(night.bed)}.</Text>
                          )}
                        </Stack>
                      ) : null}

                      {action.custom ? (
                        <Stack direction="row">
                          <Chip label="Remove" onPress={() => removeCustomAction(action.id)} />
                        </Stack>
                      ) : null}
                    </Stack>
                  );
                })}

                {/* The shipped five are a starting point, not a claim about your life. */}
                {addingActivity ? (
                  <Stack gap={3} className="rounded-md bg-sunken px-3 py-3">
                    <TextInput
                      value={newLabel}
                      onChangeText={setNewLabel}
                      placeholder="Badminton, a night run, choir…"
                      placeholderTextColor={color.ink.subtle}
                      accessibilityLabel="What do you usually do in an evening"
                      className="min-h-min rounded-sm border border-line-strong bg-page px-4 py-3 text-body text-ink-default"
                    />
                    <Stack direction="row" gap={2} wrap>
                      {[0.5, 1, 1.5, 2, 3].map((option) => (
                        <Chip
                          key={option}
                          label={option < 1 ? `${option * 60}m` : `${option}h`}
                          tone={option === newHours ? 'selected' : 'plain'}
                          onPress={() => setNewHours(option)}
                        />
                      ))}
                    </Stack>
                    <Stack direction="row" gap={2}>
                      <Button label="Cancel" kind="quiet" className="flex-1" onPress={() => setAddingActivity(false)} />
                      <Button
                        label={newLabel.trim() ? `Add ${newLabel.trim()}` : 'Name it first'}
                        kind={newLabel.trim() ? 'primary' : 'secondary'}
                        className="flex-1"
                        onPress={() => {
                          if (!newLabel.trim()) return;
                          const id = newLabel.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
                          const action = customAction(id, newLabel.trim(), newHours, 'physical');
                          addCustomAction(action);
                          setSim((current) => ({ ...current, [action.id]: newHours }));
                          successFeedback();
                          setNewLabel('');
                          setAddingActivity(false);
                        }}
                      />
                    </Stack>
                  </Stack>
                ) : (
                  <Chip label="＋ Add your own" tone="steady" onPress={() => setAddingActivity(true)} />
                )}
              </Stack>
            </Disclosure>
          </Stack>
        ) : null}

        {step === 2 ? (
          <Stack gap={5}>
            {/* The projection again, because this is the page you press the button
                on and "what does it cost me" is the whole question. */}
            <Card tone={delta > 0 ? 'steady' : 'sunken'} gap={4}>
              <Stack direction="row" gap={5} align="center">
                <Battery
                  charge={projected}
                  loadPercent={projectedLoad}
                  width={96}
                  height={48}
                  label={`Projected, ${projected} percent`}
                />
                <Stack gap={1} grow>
                  <Stack direction="row" gap={3} align="center">
                    <Text variant="heading" tone="subtle">{now}%</Text>
                    <Text variant="heading" tone="subtle">→</Text>
                    <Text variant="display" tone={TONE[bandFor(projectedLoad)]}>{projected}%</Text>
                  </Stack>
                  <Text variant="micro" tone={delta > 0 ? 'steady' : delta < 0 ? 'heavy' : 'subtle'}>
                    {delta === 0 ? 'Nothing chosen yet' : `${pctWord(delta)} battery`}
                  </Text>
                </Stack>
              </Stack>
            </Card>

            {/* The answer to "what happens if I press this", one card per block. */}
            <Section
              family="rest"
              title="What this books"
              sticker="clock"
              meta={toBook.length + (sleepChanged ? 1 : 0) ? `${toBook.length + (sleepChanged ? 1 : 0)} things` : undefined}
            >
              {sleepChanged ? (
                <Stack direction="row" gap={4} align="center" className="rounded-lg border border-line-hairline bg-raised px-4 py-3">
                  <Text variant="title">😴</Text>
                  <Stack gap={1} grow>
                    <Text variant="body" weight="semibold">Sleep {value(sleepAction.id)}h</Text>
                    <Text variant="micro" tone={night.clash ? 'heavy' : night.afterMidnight ? 'busy' : 'subtle'}>
                      {night.clash
                        ? `Tonight runs to ${formatHour(night.lastEnd!)} — that bedtime can’t happen`
                        : `Bed by ${formatHour(night.bed)} · up at ${formatHour(night.wake)}`}
                    </Text>
                  </Stack>
                  <Chip
                    label={pctWord(partOf(sleepAction, sim))}
                    tone={partOf(sleepAction, sim) > 0 ? 'steady' : 'heavy'}
                    readOnly
                  />
                </Stack>
              ) : null}

              {placed.map((block) => {
                const options = startOptions(otherItems, day, block.hours, 24).filter((h) => h >= offHour);
                const picking = pickingFor === block.id;
                return (
                  <Stack key={block.id} gap={3} className="rounded-lg border border-line-hairline bg-raised px-4 py-3">
                    <Stack direction="row" gap={3} align="center">
                      <Stack gap={1} grow>
                        <Text variant="body" weight="semibold">{block.label}</Text>
                        <Text variant="micro" tone={block.startHour === undefined ? 'heavy' : 'subtle'}>
                          {block.startHour === undefined
                            ? `No gap after ${formatHour(offHour)} is long enough`
                            : `${formatHour(block.startHour)}–${formatHour(block.startHour + block.hours)}${block.credit > 0 ? ' · protected' : ''}`}
                        </Text>
                      </Stack>
                      <Chip label={pctWord((block.credit / capacity) * 100)} tone={block.credit > 0 ? 'steady' : 'heavy'} readOnly />
                      {options.length ? (
                        <Chip
                          label={picking ? 'Close' : 'Change time'}
                          tone={picking ? 'selected' : 'plain'}
                          onPress={() => setPickingFor(picking ? null : block.id)}
                        />
                      ) : null}
                    </Stack>

                    {/* Pick the hour yourself; the suggestion is only a default. */}
                    {picking ? (
                      <Stack direction="row" gap={2} wrap>
                        {options.map((hour) => (
                          <Chip
                            key={hour}
                            label={formatHour(hour)}
                            tone={hour === block.startHour ? 'selected' : hour === block.suggested ? 'steady' : 'plain'}
                            onPress={() => {
                              setChosenHour((prev) => ({ ...prev, [block.id]: hour }));
                              setPickingFor(null);
                            }}
                          />
                        ))}
                        {chosenHour[block.id] !== undefined ? (
                          <Chip
                            label="Back to the suggestion"
                            onPress={() => {
                              setChosenHour((prev) => {
                                const next = { ...prev };
                                delete next[block.id];
                                return next;
                              });
                              setPickingFor(null);
                            }}
                          />
                        ) : null}
                      </Stack>
                    ) : null}
                  </Stack>
                );
              })}

              {!sleepChanged && placed.length === 0 ? (
                <Stack direction="row" gap={4} align="center" className="rounded-lg bg-raised px-4 py-4">
                  <Sticker name="cloud" size={36} />
                  <Text variant="footnote" tone="subtle" className="flex-1">Nothing yet. Pick a night first.</Text>
                </Stack>
              ) : null}
            </Section>

            {/* Where the booked blocks would actually sit - one tap away. */}
            {toBook.length ? (
              <Disclosure lead="🕒" title="See it on the day" summary={`${dayName} with ${toBook.length} new block${toBook.length === 1 ? '' : 's'}`}>
                <DayTimeline
                  items={[
                    ...otherItems,
                    ...toBook.map((block) => ({
                      id: `preview-${block.id}`,
                      title: block.label,
                      bucket: block.bucket,
                      hours: block.hours,
                      dread: 1 as const,
                      commitment: 'self' as const,
                      date: day,
                      startHour: block.startHour,
                      isRecovery: true,
                    })),
                  ]}
                  date={day}
                  showGaps={false}
                />
              </Disclosure>
            ) : null}
          </Stack>
        ) : null}

        <View className="h-4" />
      </Stack>
    </Screen>
  );
}
