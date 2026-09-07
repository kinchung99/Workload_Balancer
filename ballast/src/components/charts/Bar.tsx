/**
 * Data / Bar — one horizontal load bar.
 *
 * The fill is a patterned SVG, not a coloured View, so the band is legible in
 * greyscale and on a cracked screen. Anything over its own ceiling is drawn full
 * width with a marker, because "104%" and "100%" must not look the same.
 */
import { useState } from 'react';
import { View } from 'react-native';
import { bar as barToken, color, frame, space } from '@design/tokens';
import type { BandName } from '@/lib/types';
import { PatternFill } from './BandPattern';

export interface BarProps {
  band: BandName;
  /** Percentage of this bucket's own ceiling. May exceed 100. */
  percent: number;
  height?: number;
  /** Renders the band in grey to prove the pattern carries it alone. */
  greyscale?: string;
}

/** Same reason as the forecast strip: draw at the artboard width, then refine. */
const FALLBACK_WIDTH = frame.width - space[5] * 2 - space[6] * 2;

export function Bar({ band, percent, height = barToken.bucket, greyscale }: BarProps) {
  const [width, setWidth] = useState(FALLBACK_WIDTH);
  const filled = Math.max(0, Math.min(percent, 100)) / 100;

  return (
    <View
      className="w-full overflow-hidden rounded-pill bg-track"
      style={{ height }}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {width > 0 ? (
        <View className="flex-row items-center">
          <PatternFill band={band} width={width * filled} height={height} radius={height / 2} fill={greyscale} />
          {percent > 100 ? (
            // Over its own limit. A 2pt rule at the ceiling, not just more colour.
            <View
              style={{ position: 'absolute', right: 0, height, width: 2, backgroundColor: color.ink.inverse }}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
