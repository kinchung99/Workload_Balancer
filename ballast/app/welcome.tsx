import { useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Battery, BatteryMini, Button, Card, Chip, DreadPicker, Screen, Stack, Text,
} from '@/components';
import { color } from '@design/tokens';
import { BUCKETS, BUCKET_LABEL, bandFor, loadOf } from '@/lib/load';
import { chargeOf } from '@/lib/battery';
import { tapFeedback, successFeedback } from '@/lib/haptics';
import type { Dread } from '@/lib/types';
import { useStore, weekReading } from '@/state/store';

const TONE = { steady: 'steady', busy: 'busy', heavy: 'heavy' } as const;
const HOURS = [1, 2, 4, 8];

/**
 * The intro.
 *
 * The one idea this app is built on is that an hour of laundry and an hour of a
 * group presentation are not the same hour. That idea is invisible on a home
 * screen full of percentages, so this teaches it in the only way that sticks:
 * two tasks, a dial each, and the load swapping in front of you.
 *
 * Three steps, skippable, and it ends with the student's own task in their own
 * week rather than with a "Get started" button.
 */
export default function Welcome() {
  const router = useRouter();
  const { items, ceilings, today, addItem, finishOnboarding } = useStore();
  const [step, setStep] = useState(0);

  // Step 1 - the demonstration. Both dials start where the study puts them.
  const [presentationDread, setPresentationDread] = useState<Dread>(4);
  const [readingDread, setReadingDread] = useState<Dread>(1);

  // Step 3 - their own first task.
  const [title, setTitle] = useState('');
  const [hours, setHours] = useState(4);
  const [dread, setDread] = useState<Dread>(4);

  const presentation = loadOf({ hours: 3, dread: presentationDread });
  const reading = loadOf({ hours: 6, dread: readingDread });
  const mine = loadOf({ hours, dread });

  const { percents, overall } = weekReading(items, today, ceilings);

  const verdict = useMemo(() => {
    if (presentation > reading) return 'Half the hours. Twice the load.';
    if (presentation < reading) return 'Now the long, easy one costs more.';
    return 'Level. Six easy hours equal three hard ones.';
  }, [presentation, reading]);

  const done = () => {
    if (title.trim()) {
      addItem({
        title: title.trim(),
        bucket: 'mental',
        hours,
        dread,
        commitment: 'soft',
        date: today,
      });
    }
    successFeedback();
    finishOnboarding();
    router.replace('/');
  };

  const skip = () => {
    finishOnboarding();
    router.replace('/');
  };

  return (
    <Screen
      footer={
        <>
          {step < 2 ? (
            <Button
              label="Next"
              onPress={() => {
                tapFeedback();
                setStep((current) => current + 1);
              }}
            />
          ) : (
            <Button label={title.trim() ? 'Add it and see my week' : 'See my week'} onPress={done} />
          )}
          <Pressable
            accessibilityRole="button"
            onPress={step === 0 ? skip : () => setStep((current) => current - 1)}
            className="min-h-min items-center justify-center"
          >
            <Text variant="footnote" tone="subtle">{step === 0 ? 'Skip the intro' : 'Back'}</Text>
          </Pressable>
        </>
      }
    >
      <Stack gap={6} className="pt-6">
        {/* Progress. Three steps, and you can see all three. */}
        <Stack direction="row" gap={2} accessibilityRole="progressbar" accessibilityLabel={`Step ${step + 1} of 3`}>
          {[0, 1, 2].map((index) => (
            <View
              key={index}
              className={`h-1 flex-1 rounded-pill ${index <= step ? 'bg-inverse' : 'bg-track'}`}
            />
          ))}
        </Stack>

        {step === 0 ? (
          <Stack gap={6}>
            <Stack gap={3}>
              <Text variant="micro" tone="subtle">THE WHOLE IDEA</Text>
              <Text variant="title" accessibilityRole="header">Not every hour costs the same.</Text>
              <Text variant="callout" tone="muted">
                Two tasks, same afternoon. Drag the dots and watch what happens.
              </Text>
            </Stack>

            <Card gap={5}>
              <Stack gap={2}>
                <Text variant="heading">Group presentation</Text>
                <Text variant="footnote" tone="subtle">3 hours</Text>
              </Stack>
              <DreadPicker value={presentationDread} onChange={setPresentationDread} />
              <LoadBar value={presentation} max={30} />
            </Card>

            <Card gap={5}>
              <Stack gap={2}>
                <Text variant="heading">Reading you enjoy</Text>
                <Text variant="footnote" tone="subtle">6 hours</Text>
              </Stack>
              <DreadPicker value={readingDread} onChange={setReadingDread} />
              <LoadBar value={reading} max={30} />
            </Card>

            <Card tone={presentation > reading ? 'heavy' : 'steady'} gap={2}>
              <Text variant="heading" accessibilityLiveRegion="polite">{verdict}</Text>
              <Text variant="footnote" tone="muted">
                Every planner measures hours. That is exactly why none of them can tell you that you are
                about to break.
              </Text>
            </Card>
          </Stack>
        ) : null}

        {step === 1 ? (
          <Stack gap={6}>
            <Stack gap={3}>
              <Text variant="micro" tone="subtle">WHY ONE NUMBER IS NOT ENOUGH</Text>
              <Text variant="title" accessibilityRole="header">You do not run flat. You run out in one place.</Text>
            </Stack>

            <Card tone={bandFor(overall)} gap={5}>
              <Stack direction="row" gap={5} align="center">
                <Battery
                  charge={chargeOf(overall)}
                  loadPercent={overall}
                  width={130}
                  height={64}
                  label={`${chargeOf(overall)} percent left overall`}
                />
                <Stack gap={1} grow>
                  <Text variant="display" tone={TONE[bandFor(overall)]}>{chargeOf(overall)}%</Text>
                  <Text variant="footnote" tone="muted">left this week</Text>
                </Stack>
              </Stack>
            </Card>

            <Stack gap={3}>
              {BUCKETS.map((bucket) => (
                <Stack key={bucket} direction="row" gap={4} align="center">
                  <BatteryMini charge={chargeOf(percents[bucket])} loadPercent={percents[bucket]} />
                  <Text variant="body" className="flex-1">{BUCKET_LABEL[bucket]}</Text>
                  <Text variant="body" weight="semibold" tone={TONE[bandFor(percents[bucket])]}>
                    {chargeOf(percents[bucket])}%
                  </Text>
                </Stack>
              ))}
            </Stack>

            <Card gap={2}>
              <Text variant="callout">
                Amira's head is empty and her body still has {chargeOf(percents.physical)}% left. That pairing has
                a specific fix — get out of the building, do not think.
              </Text>
              <Text variant="footnote" tone="muted">
                A timetable cannot see it, because a timetable counts hours.
              </Text>
            </Card>
          </Stack>
        ) : null}

        {step === 2 ? (
          <Stack gap={6}>
            <Stack gap={3}>
              <Text variant="micro" tone="subtle">YOUR TURN</Text>
              <Text variant="title" accessibilityRole="header">What are you dreading this week?</Text>
              <Text variant="callout" tone="muted">One thing. It goes straight into your week.</Text>
            </Stack>

            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Statistics coursework"
              placeholderTextColor={color.ink.subtle}
              accessibilityLabel="What are you dreading"
              className="min-h-row rounded-md border border-line-strong bg-page px-5 py-4 text-body text-ink-default"
            />

            <Stack gap={3}>
              <Text variant="micro" tone="subtle">HOW LONG</Text>
              <Stack direction="row" gap={3} wrap>
                {HOURS.map((option) => (
                  <Chip
                    key={option}
                    label={`${option}h`}
                    tone={hours === option ? 'selected' : 'plain'}
                    onPress={() => { tapFeedback(); setHours(option); }}
                  />
                ))}
              </Stack>
            </Stack>

            <Card gap={5}>
              <Text variant="micro" tone="subtle">HOW MUCH ARE YOU DREADING IT</Text>
              <DreadPicker value={dread} onChange={setDread} />
            </Card>

            <Card tone={mine >= 20 ? 'heavy' : mine >= 10 ? 'busy' : 'steady'} gap={2}>
              <Text variant="display" accessibilityLiveRegion="polite">{mine}</Text>
              <Text variant="footnote" tone="muted">
                load — {hours} hours multiplied by dread {dread}. That is the number the whole app runs on.
              </Text>
            </Card>
          </Stack>
        ) : null}

        <View className="h-4" />
      </Stack>
    </Screen>
  );
}

/** A bare load bar, sized against a shared maximum so the two cards compare honestly. */
function LoadBar({ value, max }: { value: number; max: number }) {
  const band = value >= 20 ? 'heavy' : value >= 10 ? 'busy' : 'steady';
  const tone = { steady: 'bg-steady-fill', busy: 'bg-busy-fill', heavy: 'bg-heavy-fill' }[band];
  return (
    <Stack direction="row" gap={4} align="center">
      <View className="h-3 flex-1 overflow-hidden rounded-pill bg-track">
        <View className={`h-3 rounded-pill ${tone}`} style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
      </View>
      <Text variant="heading" tone={band} accessibilityLabel={`Load ${value}`}>{value}</Text>
    </Stack>
  );
}
