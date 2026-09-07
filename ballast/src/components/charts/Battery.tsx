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
import { useEffect, useRef, useState } from 'react';
import Svg, { Defs, G, Rect, ClipPath } from 'react-native-svg';
import { Animated, View } from 'react-native';
import { color, motion, radius } from '@design/tokens';
import { bandFor } from '@/lib/load';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { PatternFill } from './BandPattern';

export interface BatterySegment {
  key: string;
  /** That area's own charge, 0-100. */
  charge: number;
  loadPercent: number;
}

export interface BatteryProps {
  /** Charge remaining, 0-100. */
  charge: number;
  /** Load percent, used to pick the band. Over 100 reads as flat. */
  loadPercent: number;
  width?: number;
  height?: number;
  label: string;
  /**
   * Draw the cells the headline number is made of instead of one solid fill.
   *
   * The overall reading is a blend of five areas and used to look like a single
   * undifferentiated bar, so it was impossible to see that it was a summary of
   * anything. One column per area, each filled to its own level, makes the
   * composition the picture: mental flat, physical nearly full.
   */
  segments?: BatterySegment[];
}

export function Battery({ charge, loadPercent, width = 200, height = 92, label, segments }: BatteryProps) {
  const band = bandFor(loadPercent);
  // Fills on mount and tweens on change, so a battery that moves reads as a
  // battery moving rather than as a new screen. Reduced motion cuts straight to
  // the value, which is the whole rule this app applies to animation.
  const reduceMotion = useReducedMotion();
  const progress = useRef(new Animated.Value(charge)).current;
  // Start full rather than empty so a prerendered page shows the real reading.
  const [shown, setShown] = useState(charge);

  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(charge);
      setShown(charge);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: charge,
      duration: motion.meter,
      useNativeDriver: false,
    });
    animation.start();
    const id = progress.addListener(({ value }) => setShown(value));
    return () => {
      animation.stop();
      progress.removeListener(id);
    };
  }, [charge, reduceMotion, progress]);
  const nub = 10;
  const body = width - nub - 4;
  const inset = 7;
  const innerW = body - inset * 2;
  const innerH = height - inset * 2;
  const filled = Math.max(shown > 0 ? 10 : 0, (shown / 100) * innerW);

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

      {segments && segments.length > 0 ? (
        // One cell per area, each filled from the bottom to its own charge.
        <View
          style={{ position: 'absolute', left: inset, top: inset, width: innerW, height: innerH, flexDirection: 'row', gap: 2 }}
          pointerEvents="none"
        >
          {segments.map((segment) => {
            const cellW = (innerW - 2 * (segments.length - 1)) / segments.length;
            const cellH = Math.max(3, (Math.max(0, Math.min(100, segment.charge)) / 100) * innerH);
            return (
              <View key={segment.key} style={{ width: cellW, height: innerH, justifyContent: 'flex-end' }}>
                <PatternFill
                  band={bandFor(segment.loadPercent)}
                  width={cellW}
                  height={cellH}
                  radius={3}
                />
              </View>
            );
          })}
        </View>
      ) : (
        /* The patterned fill sits on top, clipped to the charged portion. */
        <View style={{ position: 'absolute', left: inset, top: inset }} pointerEvents="none">
          <PatternFill band={band} width={filled} height={innerH} radius={radius.sm} />
        </View>
      )}
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
