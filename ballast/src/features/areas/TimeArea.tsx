import { Card, Chip, Stack, Text, WeekGrid } from '@/components';
import { color } from '@design/tokens';
import { View } from 'react-native';
import { dayIndex } from '@/lib/dates';
import { weekBlocks } from '@/data/seed';
import { useStore } from '@/state/store';

/** Time — committed hours against real ones, with rest written into the grid. */
export function TimeArea() {
  const { today } = useStore();
  const committed = weekBlocks.filter((b) => b.kind === 'committed').reduce((t, b) => t + b.hours, 0);
  const recovery = weekBlocks.filter((b) => b.kind === 'recovery').reduce((t, b) => t + b.hours, 0);

  return (
    <Stack gap={6}>
      <Card gap={4}>
        <Stack direction="row" gap={5}>
          <Stack gap={1} grow>
            <Text variant="title">{committed}</Text>
            <Text variant="micro" tone="subtle">HRS COMMITTED</Text>
          </Stack>
          <View className="w-px bg-line-hairline" />
          <Stack gap={1} grow>
            <Text variant="title" tone="steady">{recovery}</Text>
            <Text variant="micro" tone="subtle">HRS RECOVERY</Text>
          </Stack>
        </Stack>
      </Card>

      <Card gap={5}>
        <WeekGrid blocks={weekBlocks} todayIndex={dayIndex(today)} />
        <Stack direction="row" gap={4} wrap>
          <Stack direction="row" gap={2} align="center">
            <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: color.band.busy.wash, borderWidth: 1, borderColor: color.band.busy.fill }} />
            <Text variant="micro" tone="subtle">Classes and work</Text>
          </Stack>
          <Stack direction="row" gap={2} align="center">
            <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: color.band.steady.wash, borderWidth: 1, borderColor: color.band.steady.fill }} />
            <Text variant="micro" tone="subtle">Protected recovery</Text>
          </Stack>
        </Stack>
      </Card>

      <Card tone="steady" gap={2}>
        <Text variant="callout" weight="semibold" tone="steady">Recovery blocks are protected time.</Text>
        <Text variant="footnote" tone="muted">Rebalancing moves work around them, never through them.</Text>
      </Card>
    </Stack>
  );
}
