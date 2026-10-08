/**
 * What one thing does to the week's battery, as a small chip.
 *
 * The same chip everywhere a single thing is shown - a block on the plan, a
 * trade, a task's page - so "−2%" always means the same: this, out of your
 * week. Spending is grey, because spending is what a week is for; giving back
 * is green.
 */
import { View } from 'react-native';
import { color } from '@design/tokens';
import { Text } from './Text';

export function CostChip({ percent, prefix = '🔋' }: { percent: number; prefix?: string }) {
  const rounded = Math.round(percent);
  const gives = rounded < 0;
  const label = rounded === 0 ? (percent > 0 ? '<1%' : '0%') : gives ? `+${-rounded}%` : `−${rounded}%`;
  return (
    <View
      accessible
      accessibilityLabel={gives ? `Gives back ${-rounded} percent of your week` : `Uses ${label.replace('−', '')} of your week`}
      className="flex-row items-center rounded-pill px-2"
      style={{ height: 24, backgroundColor: gives ? color.band.steady.wash : color.surface.sunken }}
    >
      <Text variant="micro" tone={gives ? 'steady' : 'muted'} numberOfLines={1}>{prefix}{label}</Text>
    </View>
  );
}
