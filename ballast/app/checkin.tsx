import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Burst, Button, Chip, MoodGrid, PageHeader, Screen, Section, Stack, Text, quadrantLabel, quadrantTone,
} from '@/components';
import { color } from '@design/tokens';
import { SLEEP_TARGET } from '@/lib/logs';
import { MOMENT_KINDS } from '@/lib/moments';
import { successFeedback, tapFeedback } from '@/lib/haptics';
import { useStore } from '@/state/store';
import { useReading } from '@/state/selectors';
import type { MealStatus, MoodQuadrant } from '@/lib/types';

const SLEEP = [5, 6, 7, 8, 9];
const ATE: Array<[MealStatus, string]> = [['filling', 'Properly'], ['light', 'Bit'], ['skipped', 'Nope']];

/**
 * Check in — the whole daily ask, on one screen.
 *
 * This replaces five area screens and a hub. Mood, sleep, food and good moments
 * were each behind their own page with their own chart and their own paragraph,
 * which is six destinations for four taps of input.
 *
 * Everything here moves the battery, and nothing here explains itself.
 */
export default function CheckIn() {
  const router = useRouter();
  const { today, meals, sleepHours, logMood, logSleep, setMealStatus, logMoment } = useStore();
  const reading = useReading();
  const [mood, setMood] = useState<MoodQuadrant | null>(null);
  const [burst, setBurst] = useState(false);
  const dinner = meals.find((meal) => meal.id === 'dinner');

  return (
    <Screen
      back="/you"
      backLabel="You"
      footer={<Button label={`Done · ${reading.charge}%`} onPress={() => router.back()} />}
    >
      <Stack gap={5} className="pt-2">
        <PageHeader sticker="sun" wash={color.decor.lemon} title="How are you?" />

        {burst ? <Burst show label="Logged" /> : null}

        {/* How you are: the mood, then the two basics under it. */}
        <Section family="you" title="Today feels" sticker="cloud">
          <MoodGrid
            value={mood}
            onChange={(next) => {
              setMood(next);
              logMood(next, []);
              successFeedback();
              setBurst(true);
            }}
          />
          {mood ? (
            <Text variant="footnote" weight="semibold" tone={quadrantTone(mood)}>{quadrantLabel(mood)}</Text>
          ) : null}
        </Section>

        <Section family="you" title="Sleep and food" sticker="moon">
          <Stack gap={3} className="rounded-lg bg-raised px-4 py-3">
            <Text variant="caption" weight="semibold">😴 Slept</Text>
            <Stack direction="row" gap={2} wrap>
              {SLEEP.map((hours) => (
                <Chip
                  key={hours}
                  label={`${hours}h`}
                  tone={sleepHours === hours ? 'selected' : 'plain'}
                  onPress={() => { logSleep(hours); successFeedback(); }}
                />
              ))}
            </Stack>
          </Stack>
          <Stack gap={3} className="rounded-lg bg-raised px-4 py-3">
            <Text variant="caption" weight="semibold">🍽️ Ate today</Text>
            <Stack direction="row" gap={2} wrap>
              {ATE.map(([status, label]) => (
                <Chip
                  key={status}
                  label={label}
                  tone={dinner?.status === status ? 'selected' : 'plain'}
                  onPress={() => { setMealStatus('dinner', status); successFeedback(); }}
                />
              ))}
            </Stack>
          </Stack>
        </Section>

        {/* The only input that puts charge back - so it wears the rest colour. */}
        <Section family="rest" title="Something good happened?" sticker="sparkle">
          <Stack direction="row" gap={2} wrap>
            {MOMENT_KINDS.map((kind) => (
              <Chip
                key={kind.id}
                label={`${kind.emoji} ${kind.label}`}
                onPress={() => {
                  tapFeedback();
                  logMoment(kind.id, kind.bucket, kind.credit);
                  successFeedback();
                  setBurst(true);
                }}
              />
            ))}
          </Stack>
        </Section>

        <View className="h-2" />
      </Stack>
    </Screen>
  );
}
