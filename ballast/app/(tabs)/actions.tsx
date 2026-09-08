import { useState } from 'react';
import { successFeedback } from '@/lib/haptics';
import { Pressable, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Battery, Button, Card, Chip, DayTimeline, Divider, Screen, Slider, Stack, Text,
} from '@/components';
import {
  ACTIONS, OFF_HOURS, PRESETS, customAction, initialSim, note, pointsOf, project, readout, totalPoints,
} from '@/lib/simulate';
import { CHARGE_LABEL, chargeOf } from '@/lib/battery';
import { bandFor } from '@/lib/load';
import { useStore } from '@/state/store';
import { useItemsWithLogs } from '@/state/selectors';
import { formatHour, placeIn } from '@/lib/schedule';
import { addDays, formatShort } from '@/lib/dates';
import type { Item } from '@/lib/types';
import { color } from '@design/tokens';
import { useReading } from '@/state/selectors';

const TONE = { steady: 'steady', busy: 'busy', heavy: 'heavy' } as const;

/**
 * What if I… — the simulator.
 *
 * Drag a slider, watch the battery move. Sleep, walking and seeing people give
 * charge back; a study session and late-night screen time take it. Nothing here
 * is a health claim: these are coefficients for one student's week, not advice.
 */
export default function Actions() {
  const router = useRouter();
  const { today, applyPlan, clearPlan, offHour, setOffHour, customActions, addCustomAction, removeCustomAction } = useStore();
  const items = useItemsWithLogs();
  const { overall } = useReading();

  const now = chargeOf(overall);
  // The shipped five plus whatever the student added for their own evening.
  const allActions = [...ACTIONS, ...customActions];
  const [sim, setSim] = useState<Record<string, number>>(initialSim);
  const [newLabel, setNewLabel] = useState('');
  const [newHours, setNewHours] = useState(1);
  const [addingActivity, setAddingActivity] = useState(false);
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
  const placed = gains.reduce<Array<(typeof gains)[number] & { startHour?: number }>>((acc, block) => {
    const taken: Item[] = acc
      .filter((b) => b.startHour !== undefined)
      .map((b) => ({
        id: b.id, title: b.label, bucket: b.bucket, hours: b.hours,
        dread: 1, commitment: 'self', date: today, startHour: b.startHour, isRecovery: true,
      }));
    // Placed in the window the activity belongs in, and never on top of one
    // already placed by this same plan.
    // Nothing before the hour the student says their day is their own.
    return [...acc, { ...block, startHour: placeIn([...otherItems, ...taken], day, block.hours, block.preferred, offHour) }];
  }, []);

  const sleepAction = allActions.find((a) => a.logOnly)!;
  const sleepChanged = sim[sleepAction.id] !== sleepAction.baseline;
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
        <Stack gap={6} className="pt-8">
          <Text variant="micro" tone="steady">IN YOUR WEEK</Text>
          <Text variant="title" accessibilityRole="header" accessibilityLiveRegion="polite">
            {committed.blocks} block{committed.blocks === 1 ? '' : 's'} booked.
          </Text>
          <Card tone="steady" gap={3}>
            <Text variant="callout">
              Protected time now. Rebalancing moves work around them, never through them.
            </Text>
            <Text variant="footnote" tone="muted">+{committed.points} charge points, and your battery already moved.</Text>
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
        <>
          <Button
            label={
              toBook.length || sleepChanged
                ? `${alreadyBooked.length ? 'Replace' : 'Book'} ${dayName.toLowerCase()} — ${toBook.length + (sleepChanged ? 1 : 0)} thing${toBook.length + (sleepChanged ? 1 : 0) === 1 ? '' : 's'}`
                : 'Move a slider first'
            }
            onPress={() => {
              if (!toBook.length && !sleepChanged) return;
              applyPlan(toBook, sleepChanged ? sim[sleepAction.id] : undefined, day);
              successFeedback();
              setCommitted({ blocks: toBook.length + (sleepChanged ? 1 : 0), points: delta });
            }}
          />
          <Button label="Reset" kind="quiet" onPress={() => setSim(initialSim())} />
        </>
      }
    >
      <Stack gap={6} className="pt-4">
        <Stack gap={2}>
          <Text variant="micro" tone="subtle">TONIGHT</Text>
          <Text variant="title" accessibilityRole="header">Try tonight before you live it.</Text>
          <Text variant="callout" tone="muted">
            Every other screen tells you what already happened. This one is the rest of today: choose how you
            spend it, see what it costs or gives back, and book it only if you want to. Nothing is saved until
            you press the button.
          </Text>
        </Stack>

        {/* When the evening starts. Nothing is booked before it. */}
        <Stack gap={3}>
          <Text variant="micro" tone="subtle">MY DAY IS MY OWN FROM</Text>
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
          <Text variant="footnote" tone="subtle">
            Nothing here is booked before {formatHour(offHour)} — a run at 11am is not a plan for someone who
            finishes at five.
          </Text>
        </Stack>

        {/* One evening, chosen. */}
        <Stack gap={3}>
          <Text variant="micro" tone="subtle">WHICH EVENING</Text>
          <Stack direction="row" gap={3} wrap>
            {[today, addDays(today, 1), addDays(today, 2)].map((option) => (
              <Chip
                key={option}
                label={option === today ? 'Tonight' : option === addDays(today, 1) ? 'Tomorrow' : formatShort(option)}
                tone={option === day ? 'selected' : 'plain'}
                onPress={() => setDay(option)}
              />
            ))}
          </Stack>
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
            <Text variant="footnote" tone="muted">
              Booking again replaces these rather than adding to them.
            </Text>
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

        {/* Most people are choosing a kind of night, not dialling in sliders. */}
        <Stack gap={3}>
          <Text variant="micro" tone="subtle">OR START FROM ONE OF THESE</Text>
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
                      <Text variant="footnote" tone="subtle">{preset.note}</Text>
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
              ? 'Drag a slider, or pick a night above, to see the difference.'
              : delta > 0
                ? `That night leaves you ${delta} points better off than you are now.`
                : `That night costs you ${Math.abs(delta)} points.`}
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
                  </Stack>
                </Stack>
              );
            })}
          </Card>
        </Stack>

        {/* The answer to "what happens if I press this". */}
        <Stack gap={3}>
          <Text variant="micro" tone="subtle">WHAT THIS PUTS IN YOUR WEEK</Text>
          <Card pad={0} gap={0} className="px-5">
            {sleepChanged ? (
              <Stack direction="row" gap={4} align="center" justify="between" className="min-h-row py-4">
                <Stack gap={1} grow>
                  <Text variant="body" weight="semibold">Sleep {sim[sleepAction.id]}h tonight</Text>
                  <Text variant="footnote" tone="subtle">Logged for tonight — never placed on the timeline</Text>
                </Stack>
                <Chip
                  label={`${pointsOf(sleepAction, sim[sleepAction.id]) > 0 ? '+' : ''}${pointsOf(sleepAction, sim[sleepAction.id])}`}
                  tone={pointsOf(sleepAction, sim[sleepAction.id]) > 0 ? 'steady' : 'heavy'}
                  readOnly
                />
              </Stack>
            ) : null}

            {placed.map((block, index) => (
              <Stack key={block.id}>
                {(index > 0 || sleepChanged) ? <Divider /> : null}
                <Stack direction="row" gap={4} align="center" justify="between" className="min-h-row py-4">
                  <Stack gap={1} grow>
                    <Text variant="body" weight="semibold">{block.label}</Text>
                    <Text variant="footnote" tone={block.startHour === undefined ? 'heavy' : 'subtle'}>
                      {block.startHour === undefined
                        ? 'No gap long enough today'
                        : `${formatHour(block.startHour)}–${formatHour(block.startHour + block.hours)} · protected`}
                    </Text>
                  </Stack>
                  <Chip label={`+${block.credit}`} tone="steady" readOnly />
                </Stack>
              </Stack>
            ))}

            {!sleepChanged && placed.length === 0 ? (
              <View className="py-5">
                <Text variant="footnote" tone="subtle">
                  Nothing yet. Move a slider above and what it would book appears here, with a time on it.
                </Text>
              </View>
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
              <Text variant="footnote" tone="subtle">
                It becomes a slider like the rest, and gets booked after {formatHour(offHour)}.
              </Text>
            </Card>
          ) : (
            <Text variant="footnote" tone="subtle">
              {customActions.length
                ? `${customActions.length} of your own in the list above.`
                : 'Badminton, a night run, band practice — add what your evenings actually contain.'}
            </Text>
          )}
        </Stack>

        <Stack gap={3}>
          <Text variant="micro" tone="subtle">OR GO STRAIGHT TO</Text>
          <Stack gap={3}>
            <Button label="Rebalance next week" kind="secondary" onPress={() => router.push('/rebalance')} />
            <Button label="Recovery ledger" kind="secondary" onPress={() => router.push('/recover')} />
          </Stack>
        </Stack>

        <View className="h-4" />
      </Stack>
    </Screen>
  );
}
