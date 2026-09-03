/**
 * Control / Button.
 *
 * Everything inside one thumb: every primary action sits in the lower half of
 * the screen, never in a top corner, because the moment that matters most is
 * one-handed on a bus. Height is the `button` token, which is above the 44pt
 * minimum with room for a second line at 200% type.
 */
import { Pressable, type PressableProps } from 'react-native';
import { Text } from './Text';

const KIND = {
  primary:   { box: 'bg-inverse border-inverse',              tone: 'inverse' },
  secondary: { box: 'bg-raised border-line-hairline',         tone: 'default' },
  quiet:     { box: 'bg-transparent border-transparent',      tone: 'muted' },
  steady:    { box: 'bg-steady-fill border-steady-fill',      tone: 'inverse' },
} as const;

export interface ButtonProps extends PressableProps {
  label: string;
  kind?: keyof typeof KIND;
  className?: string;
}

export function Button({ label, kind = 'primary', className = '', ...rest }: ButtonProps) {
  const { box, tone } = KIND[kind];
  return (
    <Pressable
      accessibilityRole="button"
      className={`min-h-button items-center justify-center rounded-lg border px-5 py-4 active:opacity-80 ${box} ${className}`}
      {...rest}
    >
      <Text variant="body" weight="semibold" tone={tone as never} className="text-center">
        {label}
      </Text>
    </Pressable>
  );
}
