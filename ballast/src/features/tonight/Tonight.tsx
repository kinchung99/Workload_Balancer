import { useState } from 'react';
import { successFeedback } from '@/lib/haptics';
import { Pressable, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Battery, Button, Card, Chip, DayTimeline, Divider, PageHeader, Reveal, Screen, Slider, Sticker, Stack,
  StepDots, StepNav, Text,
} from '@/components';
import { SCREEN } from '@design/screens';
import {
  ACTIONS, OFF_HOURS, PRESETS, customAction, initialSim, note, pointsOf, project, readout, totalPoints,
} from '@/lib/simulate';
import { CHARGE_LABEL, chargeOf } from '@/lib/battery';
import { bandFor } from '@/lib/load';
import { useStore } from '@/state/store';
import { useItemsWithLogs } from '@/state/selectors';
import { daySchedule, formatHour, placeIn, sleepWindow, startOptions } from '@/lib/schedule';
import { addDays, formatShort } from '@/lib/dates';
import type { Item } from '@/lib/types';
import { color } from '@design/tokens';
import { useReading } from '@/state/selectors';

const TONE = { steady: 'steady', busy: 'busy', heavy: 'heavy' } as const;
const STEPS = ['Which night', 'What you do', 'Book it'];

/** The three pages, as URL segments. `/tonight/book` opens on the slots. */
export const STEP_SLUGS = ['night', 'what', 'book'] as const;

/** One drawing and one question per page. */
const ART = [
  { sticker: 'moon', title: 'Which night?', sub: 'One evening at a time.' },
  { sticker: 'sparkle', title: 'What would you do?', sub: 'Drag one and watch the battery move.' },
  { sticker: 'clock', title: 'Book it?', sub: 'Nothing is saved until you press the button.' },
] as const;

/**
 * What if I… — the simulator.
 *
 * Drag a slider, watch the battery move. Sleep, walking and seeing people give
 * charge back; a study session and late-night screen time take it. Nothing here
 * is a health claim: these are coefficients for one student's week, not advice.
 */
export function Tonight({ initialStep = 0 }: { initialStep?: number }) {
  const router = useRouter();
  const { today, applyPlan, clearPlan, offHour, setOffHour, customActions, addCustomAction, removeCustomAction } = useStore();
  const items = useItemsWithLogs();
  const { overall } = useReading();

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
  // One evening at a time. A plan that spans days is a rebalance, not a night.
  const [day, setDay] = useState(today);
  const dayName = day === today ? 'Tonight' : day === addDays(today, 1) ? 'Tomorrow night' : formatShort(day);
  const [committed, setCommitted] = useState<{ blocks: number; points: number } | null>(null);
  const value = (id: string) => sim[id] ?? 0;
  const isPlanBlock = (id: string) => id.startsWith('plan-') && id.endsWith(`-${day}`);

  const projected = project(now, sim, allActions);
  const delta = totalPoints(sim, allActions);
  const projectedLoad = 100 - projected;

  // Only the actions that give charge back become blocks. A study session and
  // late-night scrolling are things you do, not things worth protecting time for.
  // Sleep is the night, not a block, so it is committed as a log instead.
  const gains = allActions.filter((action) => !action.logOnly && pointsOf(action, value(action.id)) > 0).map((action) => {
    const hours = action.unit === 'min' ? value(action.id) / 60 : Math.max(0.5, value(action.id) - action.baseline);
    return {
      id: action.id,
      label: action.label,
      bucket: action.bucket,
      hours: Math.round(hours * 100) / 100,
      credit: pointsOf(action, value(action.id)),
      preferred: action.preferred,
    };
  });

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
        dread: 1, commitment: 'self', date: today, startHour: b.startHour, isRecovery: true,
      }));
    // Placed in the window the activity belongs in, and never on top of one
    // already placed by this same plan.
    // Nothing before the hour the student says their day is their own - unless
    // they picked an hour themselves, which always wins.
    const suggested = placeIn([...otherItems, ...taken], day, block.hours, block.preferred, offHour);
    return [...acc, { ...block, startHour: chosenHour[block.id] ?? suggested, suggested }];
  }, []);

  const sleepAction = allActions.find((a) => a.logOnly)!;
  const sleepChanged = sim[sleepAction.id] !== sleepAction.baseline;
  // What a night of this length would actually mean in clock time.
  const night = sleepWindow(items, day, value(sleepAction.id));
  const firstTomorrow = daySchedule(items, addDays(day, 1)).timed[0];
  const toBook = placed.filter((b) => b.startHour !== undefined);

  if (committed) {
    return (
      <Screen
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
        <Stack gap={6} className="pt-4">
          <PageHeader
            sticker="star"
            wash={SCREEN.tonight.wash}
            eyebrow="In your week"
            title={`${committed.blocks} thing${committed.blocks === 1 ? '' : 's'} booked.`}
            sub="Protected time, at the hours you picked."
          />
          <Text variant="title" accessibilityRole="header" accessibilityLiveRegion="polite">
            {committed.blocks} block{committed.blocks === 1 ? '' : 's'} booked.
          </Text>
          <Card tone="steady" gap={4}>
            <Stack direction="row" gap={4} align="center">
              <Sticker name="star" size={48} />
              <Stack gap={1} grow>
                <Text variant="heading" tone="steady">+{committed.points} points</Text>
                <Text variant="footnote" tone="muted">Protected time now.</Text>
              </Stack>
            </Stack>
          </Card>

          <Stack gap={3}>
            <Text variant="micro" tone="subtle">TODAY, UPDATED</Text>
            <Card gap={4}>
              <DayTimeline items={items} date={day} showGaps={false} />
            </Card>
          </Stack>
        </Stack>
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <StepNav
          step={step}
          last={2}
          canNext={step < 2 || !!toBook.length || sleepChanged}
          nextLabel={
            step === 0
              ? `Plan ${dayName.toLowerCase()}`
              : step === 1
                ? delta === 0 ? 'Move a slider first' : `See what ${delta > 0 ? '+' : ''}${delta} books`
                : toBook.length || sleepChanged
                  ? `${alreadyBooked.length ? 'Replace' : 'Book'} ${dayName.toLowerCase()} — ${toBook.length + (sleepChanged ? 1 : 0)} thing${toBook.length + (sleepChanged ? 1 : 0) === 1 ? '' : 's'}`
                  : 'Move a slider first'
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
          sub={ART[step].sub}
        />

        {step === 0 ? (
        <Stack gap={5}>
        {/* Which evening, and when it starts being yours. */}
        <Stack gap={3}>
          <Stack direction="row" gap={2} wrap>
            {[today, addDays(today, 1), addDays(today, 2)].map((option) => (
              <Chip
                key={option}
                label={option === today ? 'Tonight' : option === addDays(today, 1) ? 'Tomorrow' : formatShort(option)}
                tone={option === day ? 'selected' : 'plain'}
                onPress={() => setDay(option)}
              />
            ))}
          </Stack>
          <Reveal label={`Free from ${formatHour(offHour)}`}>
            <Text variant="footnote" tone="muted">Nothing is booked before this.</Text>
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
          </Reveal>
        </Stack>

        {/* What is already booked for that evening, and a way to take it back. */}
        {alreadyBooked.length ? (
          <Card tone="recovery" gap={4}>
            <Text variant="micro" tone="recovery">ALREADY BOOKED FOR {dayName.toUpperCase()}</Text>
            <Stack gap={2}>
              {alreadyBooked.map((block) => (
                <Text key={block.id} variant="footnote" tone="muted">
                  {block.title} · {formatHour(block.startHour ?? 0)}–{formatHour((block.startHour ?? 0) + block.hours)}
                </Text>
              ))}
            </Stack>
            <Button
              label="Clear this evening"
              kind="secondary"
              onPress={() => {
                clearPlan(day);
                successFeedback();
              }}
            />
          </Card>
        ) : null}

        <Reveal label="What this screen is for">
          <Text variant="footnote" tone="muted">
            Every other screen reports what happened. This is the rest of a day you have not lived yet — choose
            how you spend it, see what it costs, book it only if you want to.
          </Text>
        </Reveal>
        </Stack>
        ) : null}

        {step === 1 ? (
        <Stack gap={5}>
        {/* Most people are choosing a kind of night, not dialling in sliders. */}
        <Stack gap={3}>
          <Text variant="micro" tone="subtle">PICK A NIGHT</Text>
          <Stack gap={3}>
            {PRESETS.map((preset) => {
              const points = totalPoints(preset.state, allActions);
              const outcome = project(now, preset.state, allActions);
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
                  className={`min-h-row justify-center rounded-md border px-5 py-4 active:opacity-70 ${
                    active ? 'border-inverse bg-sunken' : 'border-line-hairline'
                  }`}
                >
                  <Stack direction="row" gap={4} align="center" justify="between">
                    <Stack gap={1} grow>
                      <Text variant="body" weight="semibold">{preset.label}</Text>
                    </Stack>
                    <Stack gap={1} align="end">
                      <Text variant="heading" tone={points > 0 ? 'steady' : points < 0 ? 'heavy' : 'muted'}>
                        {outcome}%
                      </Text>
                      <Text variant="micro" tone={points > 0 ? 'steady' : points < 0 ? 'heavy' : 'subtle'}>
                        {points > 0 ? `+${points}` : points}
                      </Text>
                    </Stack>
                  </Stack>
                </Pressable>
              );
            })}
          </Stack>
        </Stack>

        {/* Now, and what the plan on this screen would make of it. */}
        <Card gap={5}>
          <Stack direction="row" gap={4} align="center" justify="between">
            <Stack gap={3} grow>
              <Text variant="micro" tone="subtle">NOW</Text>
              <Battery charge={now} loadPercent={overall} width={110} height={54} label={`Now, ${now} percent`} />
              <Stack gap={1}>
                <Text variant="heading" tone={TONE[bandFor(overall)]}>{now}%</Text>
                <Text variant="micro" tone="subtle">{CHARGE_LABEL[bandFor(overall)]}</Text>
              </Stack>
            </Stack>

            <Chip
              label={delta === 0 ? '—' : `${delta > 0 ? '+' : ''}${delta}`}
              tone={delta > 0 ? 'steady' : delta < 0 ? 'heavy' : 'plain'}
              readOnly
            />

            <Stack gap={3} grow>
              <Text variant="micro" tone="subtle">PROJECTED</Text>
              <Battery
                charge={projected}
                loadPercent={projectedLoad}
                width={110}
                height={54}
                label={`Projected, ${projected} percent`}
              />
              <Stack gap={1}>
                <Text variant="heading" tone={TONE[bandFor(projectedLoad)]}>{projected}%</Text>
                <Text variant="micro" tone="subtle">{CHARGE_LABEL[bandFor(projectedLoad)]}</Text>
              </Stack>
            </Stack>
          </Stack>
          <Text
            variant="footnote"
            tone="muted"
            accessibilityLiveRegion="polite"
            accessibilityLabel={`Projected ${projected} percent, ${delta > 0 ? 'up' : 'down'} ${Math.abs(delta)} points`}
          >
            {delta === 0
              ? 'Drag a slider, or pick a night above.'
              : delta > 0
                ? `${delta} points better off.`
                : `Costs you ${Math.abs(delta)} points.`}
          </Text>
        </Card>

        <Stack gap={3}>
          <Text variant="micro" tone="subtle">YOUR ACTIONS</Text>
          <Card pad={0} gap={0} className="px-5">
            {allActions.map((action, index) => {
              const current = value(action.id);
              const { text, points } = note(action, current);
              return (
                <Stack key={action.id}>
                  {index > 0 ? <Divider /> : null}
                  <Stack gap={2} className="py-4">
                    <Stack direction="row" justify="between" align="center" gap={3}>
                      <Text variant="body" weight="semibold">{action.label}</Text>
                      <Stack direction="row" gap={3} align="center">
                        <Text variant="body" tone="muted">{readout(action, current)}</Text>
                        {action.custom ? (
                          <Chip label="Remove" onPress={() => removeCustomAction(action.id)} />
                        ) : null}
                      </Stack>
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
                    <Text variant="footnote" tone={points > 0 ? 'steady' : points < 0 ? 'heavy' : 'subtle'}>
                      {points !== 0 ? `${points > 0 ? '+' : ''}${points} pts · ` : ''}{text}
                    </Text>

                    {/* Sleep is the one slider whose number means nothing on its
                        own. Six hours is fine or impossible depending entirely on
                        when tonight finishes, so it says so before you choose. */}
                    {action.logOnly ? (
                      <Stack gap={2} className={`rounded-sm px-3 py-3 ${night.clash ? 'bg-heavy-wash' : 'bg-sunken'}`}>
                        <Stack direction="row" gap={3} justify="between" align="center">
                          <Stack gap={1}>
                            <Text variant="micro" tone="subtle">BED BY</Text>
                            <Text variant="heading" tone={night.clash ? 'heavy' : 'default'}>
                              {formatHour(night.bed)}
                            </Text>
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
                            Tonight runs to {formatHour(night.lastEnd!)}, so {current}h is not available. Shorten
                            the night, or move what runs late.
                          </Text>
                        ) : night.afterMidnight ? (
                          <Text variant="footnote" tone="busy">
                            That is past midnight — fine once, expensive as a habit.
                          </Text>
                        ) : (
                          <Text variant="footnote" tone="steady">
                            That fits: nothing tonight runs past {formatHour(night.bed)}.
                          </Text>
                        )}
                      </Stack>
                    ) : null}
                  </Stack>
                </Stack>
              );
            })}
          </Card>
        </Stack>

        {/* The shipped five are a starting point, not a claim about your life. */}
        <Stack gap={3}>
          <Stack direction="row" justify="between" align="center">
            <Text variant="micro" tone="subtle">WHAT YOU ACTUALLY DO</Text>
            <Chip
              label={addingActivity ? 'Close' : 'Add your own'}
              tone={addingActivity ? 'selected' : 'steady'}
              onPress={() => setAddingActivity(!addingActivity)}
            />
          </Stack>
          {addingActivity ? (
            <Card gap={4}>
              <TextInput
                value={newLabel}
                onChangeText={setNewLabel}
                placeholder="Badminton, a night run, choir…"
                placeholderTextColor={color.ink.subtle}
                accessibilityLabel="What do you usually do in an evening"
                className="min-h-min rounded-sm border border-line-strong bg-page px-4 py-3 text-body text-ink-default"
              />
              <Stack gap={2}>
                <Text variant="micro" tone="subtle">HOW LONG, USUALLY</Text>
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
              </Stack>
              <Button
                label={newLabel.trim() ? `Add ${newLabel.trim()} as a slider` : 'Name it first'}
                kind={newLabel.trim() ? 'primary' : 'secondary'}
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

            </Card>
          ) : (
            <Text variant="footnote" tone="subtle">
              {customActions.length
                ? `${customActions.length} of your own above.`
                : 'Badminton, a night run, band practice.'}
            </Text>
          )}
        </Stack>
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
                {delta === 0 ? 'Nothing chosen yet' : `${delta > 0 ? '+' : ''}${delta} points`}
              </Text>
            </Stack>
          </Stack>
        </Card>

        {/* The answer to "what happens if I press this". */}
        <Stack gap={3}>
          <Text variant="micro" tone="subtle">WHAT THIS PUTS IN YOUR WEEK</Text>
          <Card pad={0} gap={0} className="px-5">
            {sleepChanged ? (
              <Stack direction="row" gap={4} align="center" justify="between" className="min-h-row py-4">
                <Stack gap={1} grow>
                  <Text variant="body" weight="semibold">Sleep {value(sleepAction.id)}h</Text>
                  <Text variant="footnote" tone={night.clash ? 'heavy' : 'subtle'}>
                    Bed by {formatHour(night.bed)} to be up at {formatHour(night.wake)}
                  </Text>
                  {night.clash ? (
                    <Text variant="micro" tone="heavy">
                      Tonight runs to {formatHour(night.lastEnd!)} — that bedtime cannot happen.
                    </Text>
                  ) : night.afterMidnight ? (
                    <Text variant="micro" tone="busy">That is past midnight.</Text>
                  ) : null}
                </Stack>
                <Chip
                  label={`${pointsOf(sleepAction, sim[sleepAction.id]) > 0 ? '+' : ''}${pointsOf(sleepAction, sim[sleepAction.id])}`}
                  tone={pointsOf(sleepAction, sim[sleepAction.id]) > 0 ? 'steady' : 'heavy'}
                  readOnly
                />
              </Stack>
            ) : null}

            {placed.map((block, index) => {
              const options = startOptions(otherItems, day, block.hours, 24).filter((h) => h >= offHour);
              const picking = pickingFor === block.id;
              return (
                <Stack key={block.id}>
                  {(index > 0 || sleepChanged) ? <Divider /> : null}
                  <Stack gap={3} className="py-4">
                    <Stack direction="row" gap={4} align="center" justify="between">
                      <Stack gap={1} grow>
                        <Text variant="body" weight="semibold">{block.label}</Text>
                        <Text variant="footnote" tone={block.startHour === undefined ? 'heavy' : 'subtle'}>
                          {block.startHour === undefined
                            ? `No gap after ${formatHour(offHour)} is long enough`
                            : `${formatHour(block.startHour)}–${formatHour(block.startHour + block.hours)} · protected`}
                        </Text>
                      </Stack>
                      <Stack direction="row" gap={2} align="center">
                        <Chip label={`+${block.credit}`} tone="steady" readOnly />
                        {options.length ? (
                          <Chip
                            label={picking ? 'Close' : 'Change time'}
                            tone={picking ? 'selected' : 'plain'}
                            onPress={() => setPickingFor(picking ? null : block.id)}
                          />
                        ) : null}
                      </Stack>
                    </Stack>

                    {/* Pick the hour yourself; the suggestion is only a default. */}
                    {picking ? (
                      <Stack gap={2}>
                        <Stack direction="row" gap={2} wrap>
                          {options.map((hour) => (
                            <Chip
                              key={hour}
                              label={formatHour(hour)}
                              tone={
                                hour === block.startHour
                                  ? 'selected'
                                  : hour === block.suggested
                                    ? 'steady'
                                    : 'plain'
                              }
                              onPress={() => {
                                setChosenHour((prev) => ({ ...prev, [block.id]: hour }));
                                setPickingFor(null);
                              }}
                            />
                          ))}
                        </Stack>
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
                </Stack>
              );
            })}

            {!sleepChanged && placed.length === 0 ? (
              <Stack direction="row" gap={4} align="center" className="py-5">
                <Sticker name="cloud" size={40} />
                <Text variant="footnote" tone="subtle" className="flex-1">
                  Move a slider and what it books appears here, with a time on it.
                </Text>
              </Stack>
            ) : null}
          </Card>
        </Stack>

        {/* Where the booked blocks would actually sit. */}
        {toBook.length ? (
          <Stack gap={3}>
            <Text variant="micro" tone="subtle">WHERE THEY WOULD LAND</Text>
            <Card gap={4}>
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
            </Card>
          </Stack>
        ) : null}

        <Stack gap={3}>
          <Text variant="micro" tone="subtle">OR GO STRAIGHT TO</Text>
          <Stack gap={3}>
            <Button label="Rebalance next week" kind="secondary" onPress={() => router.push('/rebalance')} />
            <Button label="Recovery ledger" kind="secondary" onPress={() => router.push('/recover')} />
          </Stack>
        </Stack>
        </Stack>
        ) : null}

        <View className="h-4" />
      </Stack>
    </Screen>
  );
}
