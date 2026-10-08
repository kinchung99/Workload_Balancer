import { View } from 'react-native';
import { Button, Card, Stack, Sticker, Text } from '@/components';
import { color } from '@design/tokens';
import { dayName } from '@/lib/dates';
import type { DaySwap } from '@/lib/swap';
import type { Item } from '@/lib/types';

/** Wide enough for "YOU WANT" on one line. Not a spacing token: there is none. */
const WORD_WIDTH = 66;

export interface Refusal {
  date: string;
  keep: Item;
  blocked: Array<{ item: Item; reason: string }>;
}

/**
 * The one trade worth offering this week, or the honest reason there isn't one.
 *
 * Every other card in Rebalance answers "what can come off". This one answers a
 * harder question - "which of these two" - and it is the only card that needs a
 * rating the student gave us. It sits at the top because it is the only advice
 * here that a calendar could not have produced.
 *
 * The refusal is not a fallback. A student who wants Thursday evening and is
 * told exactly which three things will not let them have it has been given
 * something; a student shown an empty card has been given nothing.
 */
export function SwapCard({ swap, refusal, why, capacity, onSwap }: {
  swap: DaySwap | null;
  refusal: Refusal | null;
  /** The AI's one line on the swap, when it has given one. */
  why?: string;
  /** The week's capacity in load, so the swap can say what it gives back. */
  capacity: number;
  onSwap: () => void;
}) {
  if (swap) {
    const back = Math.max(1, Math.round((swap.saves / capacity) * 100));
    return (
      <Card tone="recovery" gap={4}>
        <Stack direction="row" gap={2} align="center">
          <Sticker name="scales" size={28} wiggle />
          <Text variant="micro" tone="recovery" className="flex-1">A SWAP · {dayName(swap.date).toUpperCase()}</Text>
          <View className="rounded-pill px-3 py-1" style={{ backgroundColor: color.band.steady.fill }}>
            <Text variant="caption" weight="bold" tone="inverse">⚡ +{back}%</Text>
          </View>
        </Stack>

        {/* Keep one, drop the other - side by side. */}
        <Stack direction="row" gap={2} align="stretch">
          <Side word="KEEP" emoji="💚" title={swap.keep.title} keep />
          <View className="items-center justify-center">
            <Text variant="heading" tone="subtle">vs</Text>
          </View>
          <Side word="DROP" emoji="✂️" title={swap.drop.title} />
        </Stack>

        {why ? <Text variant="footnote" weight="semibold">✨ {why}</Text> : null}

        <Button label="Make the swap" onPress={onSwap} />
      </Card>
    );
  }

  if (!refusal) return null;

  return (
    <Card tone="sunken" gap={4}>
      <Stack direction="row" gap={4} align="center">
        <Sticker name="scales" size={34} />
        <Stack gap={1} grow>
          <Text variant="micro" tone="subtle">{dayName(refusal.date).toUpperCase()}</Text>
          <Text variant="heading">Nothing here can go.</Text>
        </Stack>
      </Stack>

      <Row word="YOU WANT" title={refusal.keep.title} tone="recovery" />

      <Stack gap={2}>
        {refusal.blocked.slice(0, 3).map(({ item, reason }) => (
          <Stack key={item.id} gap={1} className="rounded-sm bg-raised px-4 py-3">
            <Text variant="footnote" weight="semibold">{item.title}</Text>
            <Text variant="micro" tone="muted">{reason}</Text>
          </Stack>
        ))}
      </Stack>
    </Card>
  );
}

function Side({ word, emoji, title, keep = false }: { word: string; emoji: string; title: string; keep?: boolean }) {
  return (
    <View
      className="flex-1 gap-1 rounded-lg px-3 py-3"
      style={{ backgroundColor: color.surface.raised, borderWidth: 2, borderColor: keep ? color.band.recovery.fill : color.line.hairline, opacity: keep ? 1 : 0.75 }}
    >
      <Text variant="micro" tone={keep ? 'recovery' : 'subtle'}>{emoji} {word}</Text>
      <Text variant="callout" weight="semibold" numberOfLines={3} className={keep ? '' : 'line-through'}>{title}</Text>
    </View>
  );
}

function Row({ word, title, note, tone }: {
  word: string;
  title: string;
  note?: string;
  tone: 'recovery' | 'muted';
}) {
  return (
    <Stack direction="row" gap={4} align="center">
      <Text
        variant="micro"
        tone={tone === 'recovery' ? 'recovery' : 'subtle'}
        style={{ width: WORD_WIDTH }}
      >
        {word}
      </Text>
      <Stack gap={1} grow>
        <Text variant="body" weight="semibold">{title}</Text>
        {note ? <Text variant="micro" tone="muted">{note}</Text> : null}
      </Stack>
    </Stack>
  );
}
