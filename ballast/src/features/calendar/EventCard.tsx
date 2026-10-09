/**
 * A Google Calendar event, as a card: its calendar's colour down the side, a
 * picture of what it looks like, what and when, how often, where.
 */
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Stack, Sticker, Text, type StickerName } from '@/components';
import { color, radius } from '@design/tokens';
import { KIND, repeatOf, whenOf, type Detected } from '@/lib/gcal';
import type { CalKind } from '@/lib/types';

export const KIND_STICKER: Record<CalKind, StickerName> = {
  class: 'class', assignment: 'assignment', exam: 'star', shift: 'shift',
  exercise: 'move', people: 'people', chore: 'chore', other: 'calendar',
};

export const KIND_WASH: Record<CalKind, string> = {
  class: color.decor.sky, assignment: color.decor.candy, exam: color.decor.lemon, shift: color.decor.lilac,
  exercise: color.decor.mint, people: color.decor.blush, chore: color.decor.cream, other: color.surface.sunken,
};

function Tag({ label, tint }: { label: string; tint?: string }) {
  return (
    <View className="rounded-pill px-2 py-1" style={{ backgroundColor: tint ?? color.surface.sunken }}>
      <Text variant="micro" weight="bold" numberOfLines={1}>{label}</Text>
    </View>
  );
}

export function EventCard({ detected, children, dim = false }: { detected: Detected; children?: ReactNode; dim?: boolean }) {
  const { first, guess } = detected;
  const repeat = repeatOf(detected.repeat);
  return (
    <View
      className="flex-row overflow-hidden rounded-xl bg-raised"
      style={{ borderWidth: 2, borderColor: color.line.hairline, opacity: dim ? 0.6 : 1 }}
    >
      <View style={{ width: 6, backgroundColor: first.color ?? color.line.strong }} />
      <Stack gap={3} grow className="px-4 py-4">
        <Stack direction="row" gap={3} align="center">
          <View className="items-center justify-center rounded-lg" style={{ width: 48, height: 48, backgroundColor: KIND_WASH[guess.kind] }}>
            <Sticker name={KIND_STICKER[guess.kind]} size={32} />
          </View>
          <Stack gap={0} grow>
            <Text variant="heading" numberOfLines={2}>{detected.title}</Text>
            <Text variant="caption" weight="semibold" tone="muted">{whenOf(first)}</Text>
          </Stack>
        </Stack>
        <Stack direction="row" gap={2} wrap>
          <Tag label={`✨ ${KIND[guess.kind].label}`} tint={KIND_WASH[guess.kind]} />
          {repeat ? <Tag label={`🔁 ${repeat}`} /> : null}
          {first.location ? <Tag label={`📍 ${first.location}`} /> : null}
        </Stack>
        {children}
      </Stack>
    </View>
  );
}

/** A small round dot in a calendar's colour. */
export function CalendarDot({ tint, size = 10 }: { tint: string | null; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: radius.pill, backgroundColor: tint ?? color.line.strong }} />;
}
