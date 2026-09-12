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
export function SwapCard({ swap, refusal, onSwap }: {
  swap: DaySwap | null;
  refusal: Refusal | null;
  onSwap: () => void;
}) {
  if (swap) {
    return (
      <Card tone="recovery" gap={5}>
        <Stack direction="row" gap={4} align="center">
          <View
            className="items-center justify-center rounded-pill"
            style={{ width: 56, height: 56, backgroundColor: color.decor.mint }}
          >
            <Sticker name="scales" size={38} wiggle />
          </View>
          <Stack gap={1} grow>
            <Text variant="micro" tone="recovery">A SWAP, {dayName(swap.date).toUpperCase()}</Text>
            <Text variant="heading">Go to one, not both.</Text>
          </Stack>
        </Stack>

        <Stack gap={3}>
          <Row word="KEEP" title={swap.keep.title} note="You said you want this" tone="recovery" />
          <Row word="DROP" title={swap.drop.title} note={`${swap.cost} · ${swap.saves} load back`} tone="muted" />
        </Stack>

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
