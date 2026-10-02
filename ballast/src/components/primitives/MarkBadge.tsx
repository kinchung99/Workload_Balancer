/**
 * Control / Mark badge — what happened to a block, in one pill.
 *
 * A green tick once it is done, a half-moon when it was partly done, a grey
 * cross when it did not happen, and an amber clock when its time is over and
 * nobody has said. Nothing at all for things still ahead: a badge on every
 * future block would just be noise.
 */
import { View } from 'react-native';
import type { MarkStatus } from '@/lib/marking';
import { Text } from './Text';

const LOOK: Record<Exclude<MarkStatus, 'later'>, { icon: string; className: string; tone: 'steady' | 'busy' | 'muted' | 'recovery' }> = {
  done: { icon: '✓', className: 'bg-steady-fill', tone: 'steady' },
  partial: { icon: '◐', className: 'bg-busy-wash border border-busy-fill', tone: 'busy' },
  missed: { icon: '✕', className: 'bg-sunken border border-line-strong', tone: 'muted' },
  due: { icon: '⏳', className: 'bg-busy-wash border border-busy-fill', tone: 'busy' },
  now: { icon: '●', className: 'bg-recovery-wash border border-recovery-fill', tone: 'recovery' },
};

export function MarkBadge({ status, word, auto = false }: {
  status: MarkStatus;
  /** "Signed in", "50% done", "Skipped" - or, while due, what to do. */
  word?: string | null;
  /** Marked by the app the morning after, rather than by you. */
  auto?: boolean;
}) {
  if (status === 'later') return null;
  const look = LOOK[status];
  const label = word ?? (status === 'due' ? 'Unmarked' : status === 'now' ? 'Now' : '');
  return (
    <View className={`flex-row items-center gap-1 self-start rounded-pill px-2 py-1 ${look.className}`}>
      <Text variant="micro" weight="bold" tone={status === 'done' ? 'inverse' : look.tone}>
        {look.icon} {label}{auto ? ' · auto' : ''}
      </Text>
    </View>
  );
}
