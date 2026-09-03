/**
 * Control / Chip.
 *
 * On the capture screen a chip is a parser guess, and every one of them is one
 * tap from being fixed. That is what makes the parser safe to be wrong: nothing
 * is applied silently.
 */
import { Pressable } from 'react-native';
import { Text } from './Text';

const TONE = {
  plain:    { box: 'bg-sunken border-line-hairline',     tone: 'muted' },
  guess:    { box: 'bg-heavy-wash border-heavy-fill',    tone: 'heavy' },
  steady:   { box: 'bg-steady-wash border-steady-fill',  tone: 'steady' },
  busy:     { box: 'bg-busy-wash border-busy-fill',      tone: 'busy' },
  heavy:    { box: 'bg-heavy-wash border-heavy-fill',    tone: 'heavy' },
  recovery: { box: 'bg-recovery-wash border-recovery-fill', tone: 'recovery' },
  selected: { box: 'bg-inverse border-inverse',          tone: 'inverse' },
} as const;

export interface ChipProps {
  label: string;
  tone?: keyof typeof TONE;
  onPress?: () => void;
  /** Chips that are not buttons - a read-only status - skip the 44pt rule. */
  readOnly?: boolean;
  accessibilityHint?: string;
}

export function Chip({ label, tone = 'plain', onPress, readOnly, accessibilityHint }: ChipProps) {
  const { box, tone: textTone } = TONE[tone];
  const className = `justify-center rounded-pill border px-4 ${readOnly ? 'py-2' : 'min-h-min py-3'} ${box}`;

  if (readOnly || !onPress) {
    return (
      <Pressable disabled className={className}>
        <Text variant="caption" tone={textTone as never}>{label}</Text>
      </Pressable>
    );
  }
  return (
    <Pressable accessibilityRole="button" accessibilityHint={accessibilityHint} onPress={onPress} className={`${className} active:opacity-70`}>
      <Text variant="caption" tone={textTone as never}>{label}</Text>
    </Pressable>
  );
}
