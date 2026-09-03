/**
 * Type / Text — the only way type gets on screen.
 *
 * `variant` is a Figma text style, one to one. `tone` is a colour variable.
 * There is no `style={{ fontSize }}` anywhere in the app, which is what keeps
 * the two type systems from drifting.
 *
 * Type that can grow: nothing here caps a line count or fixes a height, so
 * every layout holds at 200% dynamic type and rows reflow rather than truncate.
 */
import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import type { TypeVariant } from '@design/tokens';

const VARIANT = {
  hero: 'text-hero', display: 'text-display', title: 'text-title', heading: 'text-heading',
  body: 'text-body', callout: 'text-callout', footnote: 'text-footnote', caption: 'text-caption', micro: 'text-micro',
} as const satisfies Record<TypeVariant, string>;

const WEIGHT = {
  hero: 'font-bold', display: 'font-bold', title: 'font-bold', heading: 'font-semibold',
  body: 'font-regular', callout: 'font-regular', footnote: 'font-regular', caption: 'font-medium', micro: 'font-semibold',
} as const satisfies Record<TypeVariant, string>;

const TONE = {
  default: 'text-ink-default',
  muted: 'text-ink-muted',
  subtle: 'text-ink-subtle',
  inverse: 'text-ink-inverse',
  nightMuted: 'text-ink-onNightMuted',
  steady: 'text-steady-ink',
  busy: 'text-busy-ink',
  heavy: 'text-heavy-ink',
  recovery: 'text-recovery-ink',
} as const;

/** Static, because NativeWind cannot resolve a template-literal class name. */
const WEIGHT_OVERRIDE = {
  regular: 'font-regular', medium: 'font-medium', semibold: 'font-semibold', bold: 'font-bold',
} as const;

export interface TextProps extends RNTextProps {
  variant?: TypeVariant;
  tone?: keyof typeof TONE;
  /** Overrides the variant's default weight. Use sparingly - item titles only. */
  weight?: keyof typeof WEIGHT_OVERRIDE;
  className?: string;
}

export function Text({ variant = 'body', tone = 'default', weight, className = '', ...rest }: TextProps) {
  const weightClass = weight ? WEIGHT_OVERRIDE[weight] : WEIGHT[variant];
  return <RNText className={[VARIANT[variant], weightClass, TONE[tone], className].filter(Boolean).join(' ')} {...rest} />;
}
