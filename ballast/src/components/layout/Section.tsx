/**
 * Layout / Section — one tinted panel per group of related things.
 *
 * Screens used to be a column of identical white cards, so a battery reading, a
 * list of sittings and a privacy switch all looked like the same kind of thing.
 * A section is a soft panel in its family's colour (see `design/families`), with
 * the family's drawing and a short title on top; everything inside it belongs
 * together, and the next section - a different colour - is plainly something
 * else.
 */
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { radius, type SpaceStep } from '@design/tokens';
import { FAMILY, type Family } from '@design/families';
import { tapFeedback } from '@/lib/haptics';
import { Stack } from '../primitives/Stack';
import { Sticker, type StickerName } from '../primitives/Sticker';
import { Text } from '../primitives/Text';

export interface SectionProps {
  family: Family;
  title: string;
  /** Overrides the family's drawing when a section needs its own. */
  sticker?: StickerName;
  /** A short count or status on the right: "2 of 4", "3h free". */
  meta?: string;
  /** One quiet link on the right, for "see all" and the like. */
  action?: { label: string; onPress: () => void };
  gap?: SpaceStep;
  /** Content a little wider than the header: for a strip that needs every point of width. */
  wide?: boolean;
  children: ReactNode;
}

export function Section({ family, title, sticker, meta, action, gap = 3, wide = false, children }: SectionProps) {
  const { wash, sticker: drawing } = FAMILY[family];
  return (
    <View style={{ borderRadius: radius.xl, overflow: 'hidden' }}>
      {/* The tint, kept to a layer so the content on top stays full strength. */}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: wash, opacity: 0.3 }]} />
      <Stack gap={3} className="px-4 pb-4 pt-3">
        <Stack direction="row" align="center" gap={3}>
          <View className="items-center justify-center rounded-pill" style={{ width: 32, height: 32, backgroundColor: wash }}>
            <Sticker name={sticker ?? drawing} size={22} />
          </View>
          <Text variant="heading" accessibilityRole="header" className="flex-1">{title}</Text>
          {meta ? <Text variant="micro" tone="muted">{meta}</Text> : null}
          {action ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={action.label}
              onPress={() => { tapFeedback(); action.onPress(); }}
              className="min-h-min justify-center active:opacity-60"
            >
              <Text variant="caption" weight="semibold" className="underline">{action.label}</Text>
            </Pressable>
          ) : null}
        </Stack>
        <Stack gap={gap} style={wide ? { marginHorizontal: -6 } : undefined}>{children}</Stack>
      </Stack>
    </View>
  );
}
