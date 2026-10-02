import { Image, View } from 'react-native';
import { color } from '@design/tokens';
import { Text } from './Text';
import type { TypeVariant } from '@design/tokens';
import type { BandName } from '@/lib/types';

/**
 * A person, as a circle.
 *
 * Every social app has one of these and they all do the same job: make a name
 * recognisable at a glance, in a list, at thumbnail size. Ours carries one extra
 * thing, and it is the whole product — **a ring in their band colour**, so you
 * can see who is running empty before you have read a single word.
 *
 * Inside the ring goes whatever they picked: a photo, an emoji, or their
 * initials when they picked nothing. A small bubble on the corner carries the
 * emoji they chose for how they feel.
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

/** Behind an emoji picture. Decoration, picked by the emoji so it never changes. */
const BACKDROP = [color.decor.sky, color.decor.lilac, color.decor.mint, color.decor.lemon, color.decor.candy, color.decor.blush];

/** A photo, rather than an emoji or nothing. */
export const isPhoto = (pic?: string | null): boolean =>
  !!pic && /^(data:|https?:|blob:|file:)/.test(pic);

const emojiVariant = (size: number): TypeVariant =>
  size >= 80 ? 'display' : size >= 56 ? 'title' : size >= 40 ? 'heading' : 'callout';

export interface AvatarProps {
  initials: string;
  /** Their reading. Without one the circle is neutral rather than guessed at. */
  band?: BandName;
  /** Greyed, because a reading nobody has confirmed is not evidence of anything. */
  stale?: boolean;
  size?: number;
  /** The percentage, small, on the corner. Off in dense lists. */
  charge?: number | null;
  /** Their picture: a photo URI or an emoji. Initials when absent. */
  pic?: string | null;
  /** How they feel, as one emoji, in a bubble on the corner. */
  mood?: string;
}

export function Avatar({ initials, band, stale = false, size = 44, charge = null, pic, mood }: AvatarProps) {
  const ring = stale || !band ? color.line.strong : RING[band];
  const fill = stale || !band ? color.surface.sunken : WASH[band];
  // The ring has to stay visible at 32px and not swallow the picture at 96px.
  const border = Math.max(2, Math.round(size * 0.06));
  const inner = size - border * 2 - 4;
  const backdrop = pic && !isPhoto(pic)
    ? BACKDROP[[...pic].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % BACKDROP.length]
    : fill;
  const bubble = Math.max(18, Math.round(size * 0.42));

  return (
    <View style={{ width: size, height: size }}>
      <View
        className="items-center justify-center rounded-pill"
        style={{ width: size, height: size, backgroundColor: color.surface.page, borderWidth: border, borderColor: ring }}
      >
        <View
          className="items-center justify-center overflow-hidden rounded-pill"
          style={{ width: inner, height: inner, backgroundColor: backdrop, opacity: stale ? 0.6 : 1 }}
        >
          {pic && isPhoto(pic) ? (
            <Image source={{ uri: pic }} style={{ width: inner, height: inner }} accessibilityIgnoresInvertColors />
          ) : pic ? (
            <Text variant={emojiVariant(size)}>{pic}</Text>
          ) : (
            <Text
              variant={size >= 72 ? 'title' : size >= 52 ? 'heading' : 'footnote'}
              weight="bold"
              tone={stale || !band ? 'muted' : 'default'}
            >
              {initials.slice(0, 2).toUpperCase()}
            </Text>
          )}
        </View>
      </View>

      {mood && size >= 36 ? (
        <View
          className="absolute items-center justify-center rounded-pill"
          style={{
            right: -4, top: -4, width: bubble, height: bubble,
            backgroundColor: color.surface.page, borderWidth: 1.5, borderColor: color.line.hairline,
          }}
        >
          <Text variant={bubble >= 30 ? 'heading' : bubble >= 22 ? 'footnote' : 'micro'}>{mood}</Text>
        </View>
      ) : null}

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
