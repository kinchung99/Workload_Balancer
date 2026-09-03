/**
 * Foundations / Pattern — the non-colour half of every band.
 *
 * Roughly one in twelve men has some colour vision deficiency, and a red-green
 * load scale is the worst possible choice for them. So every band carries three
 * signals at once: a colour, a word, and this - a fill pattern.
 *
 *   Steady    flat fill
 *   Busy      diagonal hatch
 *   Heavy     cross hatch
 *   Recovery  vertical rule
 *
 * Print the app in greyscale and every chart still reads correctly. That was the
 * test. These are SVG, so they also paste into Figma as real vector patterns
 * rather than as a flattened screenshot.
 */
import { memo } from 'react';
import Svg, { Defs, Line, Pattern, Rect } from 'react-native-svg';
import { color } from '@design/tokens';
import type { BandName } from '@/lib/types';

export const BAND_FILL: Record<BandName, string> = {
  steady: color.band.steady.fill,
  busy: color.band.busy.fill,
  heavy: color.band.heavy.fill,
  recovery: color.band.recovery.fill,
};

/** Geometry per band. Pitch and stroke are tuned so the texture survives at 12pt tall. */
const GEOMETRY = {
  steady:   { pitch: 6, stroke: 0,   kind: 'flat' },
  busy:     { pitch: 6, stroke: 2,   kind: 'diagonal' },
  heavy:    { pitch: 6, stroke: 1.6, kind: 'cross' },
  recovery: { pitch: 5, stroke: 2,   kind: 'vertical' },
} as const;

/** The texture is drawn in white over the fill, so it survives a greyscale print. */
const TEXTURE = '#FFFFFF';
const TEXTURE_OPACITY = 0.42;

function PatternDef({ band, id, fill }: { band: BandName; id: string; fill: string }) {
  const { pitch, stroke, kind } = GEOMETRY[band];
  const stripe = { stroke: TEXTURE, strokeWidth: stroke, strokeOpacity: TEXTURE_OPACITY } as const;

  return (
    <Pattern id={id} patternUnits="userSpaceOnUse" width={pitch} height={pitch}>
      <Rect x={0} y={0} width={pitch} height={pitch} fill={fill} />
      {kind === 'diagonal' || kind === 'cross' ? (
        <>
          <Line x1={-1} y1={1} x2={1} y2={-1} {...stripe} />
          <Line x1={-1} y1={pitch + 1} x2={pitch + 1} y2={-1} {...stripe} />
          <Line x1={pitch - 1} y1={pitch + 1} x2={pitch + 1} y2={pitch - 1} {...stripe} />
        </>
      ) : null}
      {kind === 'cross' ? (
        <>
          <Line x1={-1} y1={pitch - 1} x2={1} y2={pitch + 1} {...stripe} />
          <Line x1={-1} y1={-1} x2={pitch + 1} y2={pitch + 1} {...stripe} />
          <Line x1={pitch - 1} y1={-1} x2={pitch + 1} y2={1} {...stripe} />
        </>
      ) : null}
      {kind === 'vertical' ? <Line x1={pitch / 2} y1={-1} x2={pitch / 2} y2={pitch + 1} {...stripe} /> : null}
    </Pattern>
  );
}

export interface PatternFillProps {
  band: BandName;
  width: number;
  height: number;
  radius?: number;
  /** Override the fill to prove the pattern still reads with the colour taken away. */
  fill?: string;
}

/** A rectangle filled with the band's colour and its texture. */
export const PatternFill = memo(function PatternFill({ band, width, height, radius = 999, fill }: PatternFillProps) {
  const id = `band-${band}-${fill ? 'grey' : 'colour'}`;
  const paint = fill ?? BAND_FILL[band];
  const r = Math.min(radius, height / 2, width / 2);

  return (
    <Svg width={width} height={height} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Defs>
        <PatternDef band={band} id={id} fill={paint} />
      </Defs>
      <Rect x={0} y={0} width={width} height={height} rx={r} ry={r} fill={`url(#${id})`} />
    </Svg>
  );
});

/** The small square used in the legend, in a band tag and on the accessibility page. */
export function BandSwatch({ band, size = 16, fill }: { band: BandName; size?: number; fill?: string }) {
  return <PatternFill band={band} width={size} height={size} radius={3} fill={fill} />;
}
