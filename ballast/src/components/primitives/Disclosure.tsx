/**
 * Control / Disclosure — a small block, folded until it is wanted.
 *
 * Logging time, tuning a drain, fine-tuning five sliders: each is a real
 * feature and none of them needs to be open while you read the page. Folded,
 * a disclosure is one row - a picture, a title, the current answer in a few
 * words - so the page says what is there without showing all of it.
 */
import { useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { color, radius } from '@design/tokens';
import { tapFeedback } from '@/lib/haptics';
import { Stack } from './Stack';
import { Text } from './Text';

export interface DisclosureProps {
  title: string;
  /** The current answer, in a few words. Shown while folded. */
  summary?: string;
  /** A picture on the left: an emoji, or any small node. */
  lead?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function Disclosure({ title, summary, lead, defaultOpen = false, children }: DisclosureProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View className="rounded-lg border border-line-hairline bg-raised">
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${title}${summary ? `${/[.?!]$/.test(title) ? '' : '.'} ${summary}` : ''}`}
        onPress={() => { tapFeedback(); setOpen(!open); }}
        className="min-h-row flex-row items-center gap-3 px-4 py-3 active:opacity-70"
      >
        {typeof lead === 'string' ? <Text variant="heading">{lead}</Text> : lead}
        <Stack gap={1} grow>
          <Text variant="body" weight="semibold">{title}</Text>
          {summary ? <Text variant="micro" tone="muted">{summary}</Text> : null}
        </Stack>
        <View
          className="items-center justify-center rounded-pill"
          style={{ width: 28, height: 28, borderRadius: radius.pill, backgroundColor: open ? color.surface.inverse : color.surface.sunken }}
        >
          <Text variant="caption" weight="bold" tone={open ? 'inverse' : 'muted'}>{open ? '⌃' : '⌄'}</Text>
        </View>
      </Pressable>
      {open ? (
        <View className="border-t border-line-hairline px-4 pb-4 pt-3">
          {children}
        </View>
      ) : null}
    </View>
  );
}
