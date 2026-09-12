import { useState } from 'react';
import { Card, Chip, Stack, Sticker, Text } from '@/components';
import { VERDICT, type Verdict } from '@/lib/review';
import { successFeedback, tapFeedback } from '@/lib/haptics';

/**
 * One question, once, late.
 *
 * This is where the ranking learns. Three taps' worth of feedback a couple of
 * times a week is enough to move the app's priorities towards a particular
 * student's, and it is roughly the most anyone will give a planner voluntarily.
 *
 * Two things it deliberately is not. It is not a mood check - the app has one of
 * those and this is a different question. And it is not a score: there is no
 * streak, nothing to keep up, and skipping it costs nothing. A question you can
 * ignore without penalty is a question people answer honestly.
 */
export function EveningReview({ onAnswer }: { onAnswer: (verdict: Verdict) => void }) {
  const [answered, setAnswered] = useState<Verdict | null>(null);

  if (answered) {
    return (
      <Card tone="recovery" gap={3}>
        <Stack direction="row" gap={4} align="center">
          <Sticker name="moon" size={38} />
          <Stack gap={1} grow>
            <Text variant="heading" accessibilityLiveRegion="polite">Noted.</Text>
            <Text variant="footnote" tone="muted">
              {VERDICT.find((option) => option.value === answered)!.note}.
            </Text>
          </Stack>
        </Stack>
      </Card>
    );
  }

  return (
    <Card tone="busy" gap={4}>
      <Stack direction="row" gap={4} align="center">
        <Sticker name="moon" size={42} wiggle />
        <Stack gap={1} grow>
          <Text variant="micro" tone="busy">TONIGHT</Text>
          <Text variant="heading">How was today?</Text>
        </Stack>
      </Stack>

      <Stack direction="row" gap={2} wrap>
        {VERDICT.map((option) => (
          <Chip
            key={option.value}
            label={option.word}
            onPress={() => {
              tapFeedback();
              setAnswered(option.value);
              onAnswer(option.value);
              successFeedback();
            }}
          />
        ))}
      </Stack>
    </Card>
  );
}
