import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Battery, Card, Screen, Stack, Text } from '@/components';
import { BUCKETS, BUCKET_LABEL, bandFor, speakBuckets } from '@/lib/load';
import { CHARGE_LABEL, chargeOf } from '@/lib/battery';
import type { BucketKey } from '@/lib/types';
import { useStore, weekReading } from '@/state/store';

const TONE = { steady: 'steady', busy: 'busy', heavy: 'heavy' } as const;

/** What each area logs, so the hub says why you would open it. */
const WHAT: Record<BucketKey, string> = {
  mental: 'Mood check-ins and what is contributing',
  time: 'Committed hours and protected recovery',
  physical: 'Meals, movement and sleep',
  social: 'Who you have not spoken to',
  errands: 'Batched into trips you can actually do',
};

/**
 * Areas — five batteries, because the whole argument of this app is that one
 * number hides which part of you is empty.
 */
export default function Areas() {
  const router = useRouter();
  const { items, ceilings, today } = useStore();
  const { percents } = weekReading(items, today, ceilings);

  const sorted = [...BUCKETS].sort((a, b) => percents[b] - percents[a]);

  return (
    <Screen>
      <Stack gap={6} className="pt-4">
        <Stack gap={1}>
          <Text variant="micro" tone="subtle">EMPTIEST FIRST</Text>
          <Text variant="title" accessibilityRole="header">Your areas</Text>
        </Stack>

        {/* The whole chart as one sentence, for anyone not reading the picture. */}
        <Stack gap={4} accessible accessibilityLabel={speakBuckets(percents)}>
          {sorted.map((bucket) => {
            const percent = percents[bucket];
            const band = bandFor(percent);
            const charge = chargeOf(percent);
            return (
              <Pressable
                key={bucket}
                accessibilityRole="button"
                accessibilityLabel={`${BUCKET_LABEL[bucket]}, ${charge}% left, ${CHARGE_LABEL[band].toLowerCase()}. ${WHAT[bucket]}`}
                onPress={() => router.push(`/areas/${bucket}`)}
                className="active:opacity-70"
              >
                <Card tone={band} gap={4}>
                  <Stack direction="row" gap={5} align="center">
                    <Battery charge={charge} loadPercent={percent} width={96} height={46} label="" />
                    <Stack gap={1} grow>
                      <Stack direction="row" gap={3} align="center">
                        <Text variant="heading">{BUCKET_LABEL[bucket]}</Text>
                        <Text variant="heading" tone={TONE[band]}>{charge}%</Text>
                      </Stack>
                      <Text variant="footnote" tone="muted">{WHAT[bucket]}</Text>
                    </Stack>
                  </Stack>
                </Card>
              </Pressable>
            );
          })}
        </Stack>

        <View className="h-4" />
      </Stack>
    </Screen>
  );
}
