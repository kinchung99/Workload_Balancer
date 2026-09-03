/**
 * Data / Battery — the headline reading.
 *
 * "13% left" lands in half a second. "87% of capacity used" does not, and a
 * student looking at this is by definition short on seconds. Same number,
 * friendlier end of it.
 *
 * Drawn as SVG so it arrives in Figma as vector, and filled with the band's
 * pattern so it still reads at a glance in greyscale or on a cracked screen.
 */
import Svg, { Defs, G, Rect, ClipPath } from 'react-native-svg';
import { View } from 'react-native';
import { color, radius } from '@design/tokens';
import { bandFor } from '@/lib/load';
import { PatternFill } from './BandPattern';

export interface BatteryProps {
  /** Charge remaining, 0-100. */
  charge: number;
  /** Load percent, used to pick the band. Over 100 reads as flat. */
  loadPercent: number;
  width?: number;
  height?: number;
  label: string;
}

export function Battery({ charge, loadPercent, width = 200, height = 92, label }: BatteryProps) {
  const band = bandFor(loadPercent);
  const nub = 10;
  const body = width - nub - 4;
  const inset = 7;
  const innerW = body - inset * 2;
  const innerH = height - inset * 2;
  const filled = Math.max(charge > 0 ? 10 : 0, (charge / 100) * innerW);

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: charge }}
    >
      <Svg width={width} height={height}>
        {/* Shell */}
        <Rect
          x={0} y={0} width={body} height={height}
          rx={radius.lg} ry={radius.lg}
          fill={color.surface.sunken}
          stroke={color.line.strong}
          strokeWidth={2}
        />
        {/* Terminal */}
        <Rect
          x={body + 3} y={height / 2 - height / 6} width={nub} height={height / 3}
          rx={4} ry={4}
          fill={color.line.strong}
        />
        <Defs>
          <ClipPath id="battery-clip">
            <Rect x={inset} y={inset} width={innerW} height={innerH} rx={radius.sm} ry={radius.sm} />
          </ClipPath>
        </Defs>
        <G clipPath="url(#battery-clip)">
          <Rect x={inset} y={inset} width={filled} height={innerH} fill={color.surface.page} />
        </G>
      </Svg>

      {/* The patterned fill sits on top, clipped to the charged portion. */}
      <View style={{ position: 'absolute', left: inset, top: inset }} pointerEvents="none">
        <PatternFill band={band} width={filled} height={innerH} radius={radius.sm} />
      </View>
    </View>
  );
}

/** The small inline version used on area tiles and rows. */
export function BatteryMini({ charge, loadPercent }: { charge: number; loadPercent: number }) {
  const w = 34;
  const h = 16;
  const inset = 2.5;
  const innerW = w - inset * 2;
  const filled = Math.max(charge > 0 ? 3 : 0, (charge / 100) * innerW);

  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={w + 4} height={h}>
        <Rect x={0} y={0} width={w} height={h} rx={5} ry={5} fill="none" stroke={color.line.strong} strokeWidth={1.5} />
        <Rect x={w + 1} y={h / 2 - 3} width={3} height={6} rx={1.5} fill={color.line.strong} />
      </Svg>
      <View style={{ position: 'absolute', left: inset, top: inset }} pointerEvents="none">
        <PatternFill band={bandFor(loadPercent)} width={filled} height={h - inset * 2} radius={3} />
      </View>
    </View>
  );
}
