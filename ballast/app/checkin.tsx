import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Burst, Button, Card, Chip, MoodGrid, PageHeader, Screen, Stack, Text, quadrantLabel, quadrantTone,
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

        <Card gap={4}>
          <Text variant="micro" tone="subtle">TODAY FEELS</Text>
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
        </Card>

        <Card gap={4}>
          <Text variant="micro" tone="subtle">SLEPT</Text>
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
        </Card>

        <Card gap={4}>
          <Text variant="micro" tone="subtle">ATE TODAY</Text>
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
        </Card>

        {/* The only input that puts charge back. */}
        <Card tone="steady" gap={4}>
          <Text variant="micro" tone="steady">SOMETHING GOOD HAPPENED?</Text>
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
        </Card>

        <View className="h-2" />
      </Stack>
    </Screen>
  );
}
