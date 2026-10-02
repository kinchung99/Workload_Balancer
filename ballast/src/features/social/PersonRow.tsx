/**
 * One person, the way a social app shows a friend.
 *
 * Their picture inside a ring in their band colour, the emoji they picked for
 * how they feel on the corner, their battery as a coloured pill, and the line
 * they wrote in a speech bubble - the way a note sits over a face on Instagram.
 * Everything here is something they chose to share; nothing is inferred.
 */
import { View } from 'react-native';
import { Avatar, Stack, Text } from '@/components';
import { color } from '@design/tokens';
import type { BandName } from '@/lib/types';

const TONE = { steady: 'steady', busy: 'busy', heavy: 'heavy', recovery: 'recovery' } as const;

export interface PersonRowProps {
  name: string;
  initials: string;
  band: BandName;
  charge: number;
  pic?: string | null;
  mood?: string;
  status?: string | null;
  /** "doing fine · 22 min ago" */
  line: string;
  stale?: boolean;
  /** Updated in the last hour: a green dot, the way "active now" reads everywhere. */
  active?: boolean;
  size?: number;
}

export function PersonRow({
  name, initials, band, charge, pic, mood, status, line, stale = false, active = false, size = 56,
}: PersonRowProps) {
  return (
    <Stack gap={3}>
      <Stack direction="row" gap={3} align="center">
        <Avatar initials={initials} band={band} stale={stale} size={size} pic={pic} mood={mood} />
        <Stack gap={1} grow>
          <Stack direction="row" gap={2} align="center">
            <Text variant="heading" numberOfLines={1} className="flex-shrink">{name}</Text>
            {active ? (
              <View style={{ width: 9, height: 9, borderRadius: 999, backgroundColor: color.band.steady.fill }} />
            ) : null}
          </Stack>
          <Text variant="micro" tone={stale ? 'subtle' : TONE[band]}>{line}</Text>
        </Stack>
        {/* Their battery, as a pill in its own colour. */}
        <View
          className="flex-row items-center gap-1 rounded-pill px-3 py-1"
          style={{ backgroundColor: stale ? color.surface.sunken : color.band[band].wash }}
        >
          <Text variant="caption" weight="bold" tone={stale ? 'subtle' : TONE[band]}>🔋 {charge}%</Text>
        </View>
      </Stack>

      {/* The line they wrote, as a note. */}
      {status ? (
        <View className="self-start" style={{ marginLeft: size / 2 - 6 }}>
          <View style={{ width: 12, height: 12, marginLeft: 14, marginBottom: -7, transform: [{ rotate: '45deg' }], backgroundColor: color.decor.cream, borderLeftWidth: 1.5, borderTopWidth: 1.5, borderColor: color.line.hairline }} />
          <View className="rounded-lg border px-3 py-2" style={{ backgroundColor: color.decor.cream, borderColor: color.line.hairline, borderWidth: 1.5 }}>
            <Text variant="footnote" weight="semibold">“{status}”</Text>
          </View>
        </View>
      ) : null}
    </Stack>
  );
}
