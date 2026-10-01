/**
 * Data / Ring — one piece of work, as a circle that fills.
 *
 * The bar under an assignment said done, booked and loose in a strip of colour
 * thin enough to miss. A ring says the same three things at a size you read
 * from across a room, and it has a middle to put the one number in.
 *
 * Segments are drawn in order from twelve o'clock. Colour is band colour only,
 * because every segment is a reading; the spoken label carries the numbers.
 */
import type { ReactNode } from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { color } from '@design/tokens';
import { DECORATIVE } from './decorative';

export interface RingSegment {
  /** Fraction of the whole circle, 0 to 1. */
  value: number;
  color: string;
  opacity?: number;
}

export function Ring({
  segments,
  size = 108,
  stroke = 14,
  label,
  children,
}: {
  segments: RingSegment[];
  size?: number;
  stroke?: number;
  /** The whole ring, as a sentence. */
  label: string;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = size / 2;
  const length = 2 * Math.PI * r;
  let offset = 0;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      style={{ width: size, height: size }}
      className="items-center justify-center"
    >
      <View style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }} {...DECORATIVE}>
        <Svg width={size} height={size}>
          <Circle cx={c} cy={c} r={r} stroke={color.surface.track} strokeWidth={stroke} fill="none" />
          {segments.map((segment, index) => {
            const share = Math.max(0, Math.min(1, segment.value));
            const dash = share * length;
            const start = offset;
            offset += dash;
            if (dash <= 0) return null;
            return (
              <Circle
                key={index}
                cx={c}
                cy={c}
                r={r}
                stroke={segment.color}
                strokeOpacity={segment.opacity ?? 1}
                strokeWidth={stroke}
                fill="none"
                strokeDasharray={`${dash} ${length}`}
                strokeDashoffset={-start}
              />
            );
          })}
        </Svg>
      </View>
      {children}
    </View>
  );
}
