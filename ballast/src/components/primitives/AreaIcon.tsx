/**
 * Data / Area icon.
 *
 * Shape, not colour. Colour in this app already means one thing — which band a
 * reading is in — and giving the five areas their own palette would quietly
 * break that. A glyph each gives them an identity you can recognise at a glance
 * without competing with the thing colour is for.
 */
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { color } from '@design/tokens';
import type { BucketKey } from '@/lib/types';

export function AreaIcon({ area, size = 20, tint }: { area: BucketKey; size?: number; tint?: string }) {
  // Each area owns a hue; the reading beside it still owns the band colour.
  const stroke = tint ?? color.area[area].ink;
  const line = { stroke, strokeWidth: 1.7, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {/* Mental: a head, and the loop going round inside it. */}
      {area === 'mental' ? (
        <>
          <Path d="M12 3.5a6.5 6.5 0 0 1 4 11.6V19h-8v-3.9A6.5 6.5 0 0 1 12 3.5z" {...line} />
          <Path d="M9.5 10.5a2.5 2.5 0 1 1 2.5 2.5" {...line} />
        </>
      ) : null}
      {/* Time: the clock everyone else thinks is the whole problem. */}
      {area === 'time' ? (
        <>
          <Circle cx={12} cy={12} r={8} {...line} />
          <Path d="M12 7.5V12l3 2" {...line} />
        </>
      ) : null}
      {/* Physical: a body in motion. */}
      {area === 'physical' ? (
        <>
          <Circle cx={13} cy={5.5} r={2} {...line} />
          <Path d="M8 20l3-5 1-3.5 4 2 .5 3M12 11.5 9 9l-3 1.5M16 13.5l3-1" {...line} />
        </>
      ) : null}
      {/* Social: two people, one slightly behind. */}
      {area === 'social' ? (
        <>
          <Circle cx={9.5} cy={8.5} r={3} {...line} />
          <Path d="M4 19a5.5 5.5 0 0 1 11 0" {...line} />
          <Path d="M15.5 6.2a3 3 0 0 1 0 5.6M17 19a5.5 5.5 0 0 0-2-4.3" {...line} />
        </>
      ) : null}
      {/* Errands: the list of small things nobody was counting. */}
      {area === 'errands' ? (
        <>
          <Rect x={4} y={4} width={16} height={16} rx={3} {...line} />
          <Path d="M8 9.5h8M8 13h8M8 16.5h4" {...line} />
        </>
      ) : null}
    </Svg>
  );
}
