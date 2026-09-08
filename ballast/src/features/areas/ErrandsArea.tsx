import { useMemo, useState } from 'react';
import { TextInput, View } from 'react-native';
import { Button, Card, Checkbox, Chip, Divider, Stack, Text } from '@/components';
import { color } from '@design/tokens';
import { DEFAULT_ERRAND_HOURS, EFFORTS, categorise, completionCredit, errandLoad } from '@/lib/errands';
import { formatHour, startOptions } from '@/lib/schedule';
import { addDays, formatShort } from '@/lib/dates';
import { logItems } from '@/lib/logs';
import { successFeedback, tapFeedback } from '@/lib/haptics';
import type { ErrandCategory } from '@/lib/types';
import { useStore } from '@/state/store';
import { readingFrom, useItemsWithLogs, useReading } from '@/state/selectors';

const ORDER: ErrandCategory[] = ['Groceries', 'Admin', 'Academic', 'Home'];
const SIZES: Array<[string, number]> = [['10m', 0.17], ['20m', 0.33], ['45m', 0.75], ['1h30', 1.5]];

/**
 * Errands — said in one breath, sorted into batches you can do in one trip.
 *
 * Anything you add here counts. That is the app's whole thesis applied to the
 * smallest things it holds: burnout is rarely one big item, it is a pile of
 * twenty-minute ones nobody was counting. Seeded errands stay weightless so the
 * study's figures hold; yours move the battery the moment you add them, and give
 * the weight back when you tick them off.
 */
export function ErrandsArea() {
  const { items, ceilings, today, meals, moods, sleepHours, errands, toggleErrand, addErrand } = useStore();
  const reading = useReading();

  const scheduleItems = useItemsWithLogs();
  const [title, setTitle] = useState('');
  const [hours, setHours] = useState(DEFAULT_ERRAND_HOURS);
  const [override, setOverride] = useState<ErrandCategory | null>(null);
  const [day, setDay] = useState(today);
  const [startHour, setStartHour] = useState<number | null>(null);
  const [effort, setEffort] = useState<1 | 2 | 3>(2);

  const dayOptions = Array.from({ length: 5 }, (_, offset) => addDays(today, offset));
  const timeOptions = useMemo(() => startOptions(scheduleItems, day, hours, 6), [scheduleItems, day, hours]);

  const guess = useMemo(() => categorise(title || 'pick up milk'), [title]);
  const category = override ?? guess;

  /** What adding this would cost, before you add it. */
  const preview = useMemo(() => {
    if (!title.trim()) return null;
    const candidate = {
      id: 'preview', title, category, done: false, hours, effort, addedByUser: true,
      ...(startHour === null ? {} : { date: day, startHour }),
    };
    return readingFrom(
      [...items, ...logItems({ today, sleepHours, meals, moods, errands: [...errands, candidate] })],
      today,
      ceilings,
    ).charge;
  }, [title, category, hours, effort, day, startHour, items, errands, today, sleepHours, meals, moods, ceilings]);

  const grouped = ORDER.map((name) => ({
    category: name,
    items: errands.filter((errand) => errand.category === name),
  })).filter((group) => group.items.length > 0);

  const mine = errands.filter((e) => e.addedByUser && !e.done);

  const submit = () => {
    if (!title.trim()) return;
    addErrand(title.trim(), category, hours, effort, startHour === null ? undefined : { date: day, startHour });
    successFeedback();
    setTitle('');
    setOverride(null);
    setHours(DEFAULT_ERRAND_HOURS);
    setEffort(2);
    setStartHour(null);
  };

  return (
    <Stack gap={6}>
      <Stack gap={3}>
        <Text variant="micro" tone="subtle">ADD AN ERRAND</Text>
        <Card gap={4}>
          <TextInput
            value={title}
            onChangeText={setTitle}
            onSubmitEditing={submit}
            returnKeyType="done"
            placeholder="Pick up oat milk"
            placeholderTextColor={color.ink.subtle}
            accessibilityLabel="What do you need to do"
            className="min-h-min rounded-md border border-line-strong bg-page px-4 py-3 text-body text-ink-default"
          />

          {title.trim() ? (
            <Stack gap={4}>
              <Stack gap={2}>
                <Text variant="micro" tone="subtle">SORTED INTO — TAP TO CHANGE</Text>
                <Stack direction="row" gap={2} wrap>
                  {ORDER.map((option) => (
                    <Chip
                      key={option}
                      label={option}
                      tone={option === category ? 'selected' : 'plain'}
                      onPress={() => { tapFeedback(); setOverride(option); }}
                    />
                  ))}
                </Stack>
              </Stack>

              <Stack gap={2}>
                <Text variant="micro" tone="subtle">HOW LONG</Text>
                <Stack direction="row" gap={2} wrap>
                  {SIZES.map(([label, value]) => (
                    <Chip
                      key={label}
                      label={label}
                      tone={value === hours ? 'selected' : 'plain'}
                      onPress={() => { tapFeedback(); setHours(value); setStartHour(null); }}
                    />
                  ))}
                </Stack>
              </Stack>

              {/* Twenty minutes at the bank is not twenty minutes of walking. */}
              <Stack gap={2}>
                <Text variant="micro" tone="subtle">
                  HOW MUCH YOU MIND IT · {Math.round(hours * effort * 10) / 10} load
                </Text>
                <Stack direction="row" gap={2} wrap>
                  {EFFORTS.map(([value, label]) => (
                    <Chip
                      key={value}
                      label={label}
                      tone={value === effort ? 'selected' : 'plain'}
                      onPress={() => { tapFeedback(); setEffort(value); }}
                    />
                  ))}
                </Stack>
              </Stack>

              {/* An errand can be a calendar block like anything else, or stay
                  on the list with no slot. Both are legitimate answers. */}
              <Stack gap={2}>
                <Text variant="micro" tone="subtle">WHICH DAY</Text>
                <Stack direction="row" gap={2} wrap>
                  {dayOptions.map((option) => (
                    <Chip
                      key={option}
                      label={option === today ? 'Today' : option === addDays(today, 1) ? 'Tomorrow' : formatShort(option)}
                      tone={option === day ? 'selected' : 'plain'}
                      onPress={() => { tapFeedback(); setDay(option); setStartHour(null); }}
                    />
                  ))}
                </Stack>
              </Stack>

              <Stack gap={2}>
                <Text variant="micro" tone="subtle">
                  WHAT TIME · {timeOptions.length} FREE
                </Text>
                <Stack direction="row" gap={2} wrap>
                  <Chip
                    label="No time yet"
                    tone={startHour === null ? 'selected' : 'plain'}
                    onPress={() => { tapFeedback(); setStartHour(null); }}
                  />
                  {timeOptions.map((option) => (
                    <Chip
                      key={option}
                      label={formatHour(option)}
                      tone={option === startHour ? 'selected' : 'plain'}
                      onPress={() => { tapFeedback(); setStartHour(option); }}
                    />
                  ))}
                </Stack>
              </Stack>

              {preview !== null ? (
                <Text
                  variant="footnote"
                  tone={preview < reading.charge ? 'heavy' : 'subtle'}
                  accessibilityLiveRegion="polite"
                >
                  {preview < reading.charge
                    ? `${startHour === null ? 'On your list' : `${formatShort(day)} at ${formatHour(startHour)}`} · takes you to ${preview}% — small things count too.`
                    : 'This one is too small to move the battery.'}
                </Text>
              ) : null}
            </Stack>
          ) : (
            <Text variant="footnote" tone="subtle">
              Type it as you would say it. Ballast sorts it into a batch and prices it.
            </Text>
          )}

          <Button
            label={
              !title.trim()
                ? 'Type something first'
                : startHour === null
                  ? 'Add to the list'
                  : `Add it ${formatShort(day)} at ${formatHour(startHour)}`
            }
            kind={title.trim() ? 'primary' : 'secondary'}
            onPress={submit}
          />
        </Card>
      </Stack>

      {mine.length > 0 ? (
        <Card tone="busy" gap={2}>
          <Text variant="callout" weight="semibold" tone="busy">
            {mine.length} of your own still outstanding
          </Text>
          <Text variant="footnote" tone="muted">
            Worth {Math.round(mine.reduce((t, e) => t + errandLoad(e), 0) * 10) / 10} load. Tick one off to get it back.
          </Text>
          <Text variant="micro" tone="subtle">
            Everything on this list pays out when you finish it, seeded or not.
          </Text>
        </Card>
      ) : null}

      {grouped.map((group) => {
        const left = group.items.filter((item) => !item.done).length;
        return (
          <Stack key={group.category} gap={3}>
            <Stack direction="row" justify="between" align="center">
              <Text variant="micro" tone="subtle">{group.category.toUpperCase()}</Text>
              <Chip label={String(left)} readOnly />
            </Stack>
            <Card pad={0} gap={0} className="px-5">
              {group.items.map((errand, index) => (
                <Stack key={errand.id}>
                  {index > 0 ? <Divider /> : null}
                  <Stack direction="row" gap={3} align="center" className="py-3">
                    <View className="flex-1">
                      <Checkbox label={errand.title} checked={errand.done} onPress={() => toggleErrand(errand.id)} />
                    </View>
                    {errand.done ? (
                      <Chip label={`+${errandLoad(errand)}`} tone="steady" readOnly />
                    ) : (
                      <Chip
                        label={
                          errand.startHour === undefined
                            ? `${errandLoad(errand)}`
                            : formatHour(errand.startHour)
                        }
                        tone={errand.startHour === undefined ? 'busy' : 'steady'}
                        readOnly
                      />
                    )}
                  </Stack>
                </Stack>
              ))}
            </Card>
          </Stack>
        );
      })}

      <Card tone="steady" gap={2}>
        <Text variant="callout" weight="semibold" tone="steady">Batched by where they are.</Text>
        <Text variant="footnote" tone="muted">Same trip, four things — the one saving that costs you nothing.</Text>
      </Card>
    </Stack>
  );
}
