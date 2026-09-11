import { useLocalSearchParams, useRouter } from 'expo-router';
import { Battery, Button, Card, PageHeader, Screen, Stack, Text } from '@/components';
import { View } from 'react-native';
import { color } from '@design/tokens';
import { AREA_STICKER } from '@design/screens';
import { BUCKET_LABEL, BUCKETS, bandFor } from '@/lib/load';
import { CHARGE_LABEL, chargeOf } from '@/lib/battery';
import type { BucketKey } from '@/lib/types';
import { useStore, weekReading } from '@/state/store';
import { useReading } from '@/state/selectors';
import { MentalArea } from '@/features/areas/MentalArea';
import { TimeArea } from '@/features/areas/TimeArea';
import { PhysicalArea } from '@/features/areas/PhysicalArea';
import { SocialArea } from '@/features/areas/SocialArea';
import { ErrandsArea } from '@/features/areas/ErrandsArea';

export async function generateStaticParams() {
  return BUCKETS.map((key) => ({ key }));
}

const TONE = { steady: 'steady', busy: 'busy', heavy: 'heavy' } as const;

const AREA = {
  mental: MentalArea, time: TimeArea, physical: PhysicalArea,
  social: SocialArea, errands: ErrandsArea,
} as const;

/** One line saying why you would open this one. */
const WHAT: Record<BucketKey, string> = {
  mental: 'How today feels, and what is behind it',
  time: 'Committed hours and protected recovery',
  physical: 'Meals, movement and sleep',
  social: 'Who you have not spoken to',
  errands: 'Small things, batched into trips',
};

/**
 * One screen per area, each logging the thing that area is actually made of -
 * a mood grid, a week grid, meals, the people you have not spoken to, a
 * batched list. A generic list of tasks would have told you none of it.
 */
export default function Area() {
  const { key } = useLocalSearchParams<{ key: BucketKey }>();
  const router = useRouter();
  const { items, ceilings, today } = useStore();
  const { percents } = useReading();

  const bucket = (BUCKETS.includes(key) ? key : 'mental') as BucketKey;
  const percent = percents[bucket];
  const band = bandFor(percent);
  const charge = chargeOf(percent);
  const Body = AREA[bucket];

  return (
    <Screen
      back="/areas"
      backLabel="Areas"
      footer={<Button label="Rebalance the week" kind="secondary" onPress={() => router.push('/rebalance')} />}
    >
      <Stack gap={6} className="pt-4">
        {/* The area keeps its own identity hue here rather than a decor one:
            these five already have a palette and it is the one thing on screen
            that says which area you are in. */}
        <PageHeader
          sticker={AREA_STICKER[bucket]}
          wash={color.area[bucket].wash}
          eyebrow={BUCKET_LABEL[bucket]}
          title={`${charge}% left`}
          sub={WHAT[bucket]}
        />

        <Card tone={band} gap={4}>
          <Stack direction="row" gap={5} align="center">
            <Battery
              charge={charge}
              loadPercent={percent}
              width={120}
              height={58}
              label={`${BUCKET_LABEL[bucket]}, ${charge} percent charge`}
            />
            <Stack gap={1} grow>
              <Text variant="heading" tone={TONE[band]}>{CHARGE_LABEL[band]}</Text>
              <Text variant="footnote" tone="muted">{percent}% of your ceiling</Text>
            </Stack>
          </Stack>
        </Card>

        <Body />
      </Stack>
    </Screen>
  );
}
