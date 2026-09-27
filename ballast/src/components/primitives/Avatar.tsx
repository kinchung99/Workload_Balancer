import { View } from 'react-native';
import { color } from '@design/tokens';
import { Text } from './Text';
import type { BandName } from '@/lib/types';

/**
 * A person, as a circle.
 *
 * Every social app has one of these and they all do the same job: make a name
 * recognisable at a glance, in a list, at thumbnail size. Ours carries one extra
 * thing, and it is the whole product — **a ring in their band colour**, so you
 * can see who is running empty before you have read a single word.
 *
 * The ring greys out when the reading is stale. A battery nobody has confirmed
 * for three days is not news, and colouring it as though it were would be the
 * app inventing a fact about someone's week.
 */

const RING: Record<BandName, string> = {
  steady: color.band.steady.fill,
  busy: color.band.busy.fill,
  heavy: color.band.heavy.fill,
  recovery: color.band.recovery.fill,
};

const WASH: Record<BandName, string> = {
  steady: color.band.steady.wash,
  busy: color.band.busy.wash,
  heavy: color.band.heavy.wash,
  recovery: color.band.recovery.wash,
};

export interface AvatarProps {
  initials: string;
  /** Their reading. Without one the circle is neutral rather than guessed at. */
  band?: BandName;
  /** Greyed, because a reading nobody has confirmed is not evidence of anything. */
  stale?: boolean;
  size?: number;
  /** The percentage, small, on the corner. Off in dense lists. */
  charge?: number | null;
}

export function Avatar({ initials, band, stale = false, size = 44, charge = null }: AvatarProps) {
  const ring = stale || !band ? color.line.strong : RING[band];
  const fill = stale || !band ? color.surface.sunken : WASH[band];
  // The ring has to stay visible at 32px and not swallow the letters at 96px.
  const border = Math.max(2, Math.round(size * 0.055));

  return (
    <View style={{ width: size, height: size }}>
      <View
        className="items-center justify-center rounded-pill"
        style={{ width: size, height: size, backgroundColor: fill, borderWidth: border, borderColor: ring }}
      >
        <Text
          variant={size >= 72 ? 'title' : size >= 52 ? 'heading' : 'footnote'}
          weight="bold"
          tone={stale || !band ? 'muted' : 'default'}
        >
          {initials.slice(0, 2).toUpperCase()}
        </Text>
      </View>

      {charge !== null && size >= 56 ? (
        <View
          className="absolute items-center justify-center rounded-pill"
          style={{
            right: -2, bottom: -2,
            paddingHorizontal: 7, paddingVertical: 3,
            backgroundColor: color.surface.page,
            borderWidth: 2, borderColor: ring,
          }}
        >
          <Text variant="micro" weight="bold">{charge}%</Text>
        </View>
      ) : null}
    </View>
  );
}
