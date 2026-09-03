/**
 * Data / Area tile.
 *
 * The Areas hub. Five tiles, each showing its own battery, because the whole
 * argument of this app is that one number hides which part of you is empty.
 */
import { Pressable } from 'react-native';
import { BUCKET_LABEL } from '@/lib/load';
import { chargeOf } from '@/lib/battery';
import type { BucketKey } from '@/lib/types';
import { BatteryMini } from '../charts/Battery';
import { Stack } from './Stack';
import { Text } from './Text';

const TONE = { steady: 'steady', busy: 'busy', heavy: 'heavy' } as const;

export function AreaTile({
  bucket,
  percent,
  band,
  hint,
  onPress,
}: {
  bucket: BucketKey;
  percent: number;
  band: keyof typeof TONE;
  hint: string;
  onPress: () => void;
}) {
  const charge = chargeOf(percent);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${BUCKET_LABEL[bucket]}, ${charge}% left. ${hint}`}
      onPress={onPress}
      className="min-h-row flex-1 rounded-md border border-line-hairline bg-raised p-4 active:opacity-70"
    >
      <Stack gap={3}>
        <BatteryMini charge={charge} loadPercent={percent} />
        <Stack gap={1}>
          <Text variant="footnote" weight="semibold">{BUCKET_LABEL[bucket]}</Text>
          <Text variant="micro" tone={TONE[band]}>{charge}% left</Text>
        </Stack>
      </Stack>
    </Pressable>
  );
}
