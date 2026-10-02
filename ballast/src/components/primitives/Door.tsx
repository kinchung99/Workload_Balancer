/**
 * Control / Door — a row that opens a page of its own.
 *
 * Big features live on their own page and are reached through one of these:
 * the family's drawing, a title, one line saying what is behind it, and a
 * chevron. The same shape everywhere, so "this goes somewhere" never has to be
 * worked out twice.
 */
import { Pressable, View } from 'react-native';
import { color } from '@design/tokens';
import { FAMILY, type Family } from '@design/families';
import { tapFeedback } from '@/lib/haptics';
import { Stack } from './Stack';
import { Sticker, type StickerName } from './Sticker';
import { Text } from './Text';

export interface DoorProps {
  family: Family;
  title: string;
  sub?: string;
  sticker?: StickerName;
  /** A small count in a bubble: requests waiting, things due. */
  badge?: number;
  onPress: () => void;
}

export function Door({ family, title, sub, sticker, badge, onPress }: DoorProps) {
  const { wash, sticker: drawing } = FAMILY[family];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}${sub ? `. ${sub}` : ''}`}
      onPress={() => { tapFeedback(); onPress(); }}
      className="min-h-row flex-row items-center gap-3 rounded-lg border border-line-hairline bg-raised px-4 py-3 active:opacity-70"
    >
      <View className="items-center justify-center rounded-pill" style={{ width: 40, height: 40, backgroundColor: wash }}>
        <Sticker name={sticker ?? drawing} size={26} />
      </View>
      <Stack gap={1} grow>
        <Text variant="body" weight="semibold">{title}</Text>
        {sub ? <Text variant="micro" tone="muted">{sub}</Text> : null}
      </Stack>
      {badge ? (
        <View className="items-center justify-center rounded-pill px-2" style={{ minWidth: 22, height: 22, backgroundColor: color.band.heavy.fill }}>
          <Text variant="micro" tone="inverse">{badge}</Text>
        </View>
      ) : null}
      <Text variant="heading" tone="subtle">›</Text>
    </Pressable>
  );
}
