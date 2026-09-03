/**
 * Data / Week grid.
 *
 * Committed time in amber, protected recovery in green, written into the same
 * calendar rather than left as whatever is spare. Recovery that is not on the
 * grid is recovery that gets eaten.
 */
import { View } from 'react-native';
import { DAY_LETTER } from '@/lib/dates';
import type { Block } from '@/lib/types';
import { Stack } from '../primitives/Stack';
import { Text } from '../primitives/Text';

const START = 12;
const END = 21;
const ROW = 26;

const KIND = {
  committed: 'bg-busy-wash border-busy-fill',
  recovery: 'bg-steady-wash border-steady-fill',
} as const;

const TONE = { committed: 'busy', recovery: 'steady' } as const;

export function WeekGrid({ blocks, todayIndex }: { blocks: Block[]; todayIndex: number }) {
  const hours = Array.from({ length: END - START }, (_, i) => START + i);
  const spoken = `Week grid. ${blocks.filter((b) => b.kind === 'committed').length} committed blocks and ${
    blocks.filter((b) => b.kind === 'recovery').length
  } protected recovery blocks.`;

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={spoken}>
      <Stack gap={3}>
        <Stack direction="row" gap={1}>
          <View className="w-8" />
          {DAY_LETTER.map((letter, index) => (
            <View key={index} className="flex-1 items-center">
              <Text variant="micro" tone={index === todayIndex ? 'default' : 'subtle'} weight={index === todayIndex ? 'bold' : 'semibold'}>
                {letter}
              </Text>
            </View>
          ))}
        </Stack>

        <Stack direction="row" gap={1}>
          <Stack className="w-8">
            {hours.map((hour) => (
              <View key={hour} style={{ height: ROW }} className="justify-start">
                <Text variant="micro" tone="subtle">{hour > 12 ? `${hour - 12}pm` : '12pm'}</Text>
              </View>
            ))}
          </Stack>

          {DAY_LETTER.map((_, day) => (
            <View key={day} className="flex-1 rounded-sm bg-sunken" style={{ height: (END - START) * ROW }}>
              {blocks
                .filter((block) => block.day === day)
                .map((block) => (
                  <View
                    key={block.id}
                    className={`absolute left-0 right-0 overflow-hidden rounded-sm border-l-2 ${KIND[block.kind]}`}
                    style={{ top: (block.startHour - START) * ROW, height: block.hours * ROW - 2 }}
                  >
                    <Text variant="micro" tone={TONE[block.kind]} className="px-1 pt-1">{block.label}</Text>
                  </View>
                ))}
            </View>
          ))}
        </Stack>
      </Stack>
    </View>
  );
}
