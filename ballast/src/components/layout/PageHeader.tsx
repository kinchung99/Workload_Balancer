/**
 * Frame / Page header — how every screen opens.
 *
 * A drawing on a coloured disc, a short title, one line under it. That is the
 * whole pattern, and it exists as a component so the app cannot drift back into
 * fifteen slightly different headings.
 *
 * The wash is decorative (`color.decor`) and never carries a value: a screen's
 * colour says which screen it is, the same way the sticker does. Anything you
 * read a number off is still band-coloured.
 */
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Stack } from '../primitives/Stack';
import { Text } from '../primitives/Text';
import { Sticker, type StickerName } from '../primitives/Sticker';

export interface PageHeaderProps {
  sticker: StickerName;
  /** Decorative disc colour. Pass a `color.decor.*` value. */
  wash: string;
  title: string;
  sub?: string;
  /** Small caps line above the title — a week number, a date, a count. */
  eyebrow?: string;
  /** Anything that belongs on the right: a chip, a count, a control. */
  right?: ReactNode;
  size?: number;
  /** The drawing leans gently. Off for screens you sit on for a while. */
  wiggle?: boolean;
}

export function PageHeader({
  sticker, wash, title, sub, eyebrow, right, size = 68, wiggle = true,
}: PageHeaderProps) {
  return (
    <Stack direction="row" gap={4} align="center">
      <View
        className="items-center justify-center rounded-pill"
        style={{ width: size, height: size, backgroundColor: wash }}
      >
        <Sticker name={sticker} size={size * 0.68} wiggle={wiggle} />
      </View>
      <Stack gap={1} grow>
        {eyebrow ? <Text variant="micro" tone="subtle">{eyebrow.toUpperCase()}</Text> : null}
        <Text variant="title" accessibilityRole="header">{title}</Text>
        {sub ? <Text variant="footnote" tone="muted">{sub}</Text> : null}
      </Stack>
      {right}
    </Stack>
  );
}
