/** Surface / Card. A bordered auto-layout frame. `tone` tints it by band. */
import { Stack, type StackProps } from './Stack';

const TONE = {
  plain:    'bg-raised border-line-hairline',
  sunken:   'bg-sunken border-line-hairline',
  steady:   'bg-steady-wash border-steady-fill',
  busy:     'bg-busy-wash border-busy-fill',
  heavy:    'bg-heavy-wash border-heavy-fill',
  recovery: 'bg-recovery-wash border-recovery-fill',
} as const;

export interface CardProps extends StackProps {
  tone?: keyof typeof TONE;
}

export function Card({ tone = 'plain', pad = 5, gap = 4, className = '', ...rest }: CardProps) {
  return <Stack pad={pad} gap={gap} className={`rounded-lg border ${TONE[tone]} ${className}`} {...rest} />;
}
