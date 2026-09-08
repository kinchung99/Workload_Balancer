/**
 * Foundations / Spot — small drawings, used sparingly.
 *
 * Drawn rather than fetched. A photograph or a GIF would need the network, would
 * not survive the offline promise, and would be the one thing on screen that
 * cannot follow the theme. These are SVG on the same palette as everything else,
 * so they work in the dark, print in greyscale, and paste into Figma as vectors.
 *
 * One per moment that would otherwise be a bare sentence.
 */
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { color } from '@design/tokens';

export type SpotName = 'clear' | 'night' | 'done' | 'nothing' | 'wall';

export function Spot({ name, size = 72 }: { name: SpotName; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 96 96" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Defs>
        <LinearGradient id={`spot-${name}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color.band.steady.fill} stopOpacity="0.22" />
          <Stop offset="1" stopColor={color.band.recovery.fill} stopOpacity="0.16" />
        </LinearGradient>
      </Defs>

      {/* A clear stretch of day: an arc of open sky. */}
      {name === 'clear' ? (
        <>
          <Circle cx={48} cy={48} r={44} fill={`url(#spot-${name})`} />
          <Circle cx={48} cy={52} r={16} fill="none" stroke={color.band.steady.fill} strokeWidth={3} />
          <Path d="M48 22v8M74 52h-8M22 52h8M66 34l-5 5M30 34l5 5" stroke={color.band.steady.fill} strokeWidth={3} strokeLinecap="round" />
        </>
      ) : null}

      {/* The evening, and the point of protecting it. */}
      {name === 'night' ? (
        <>
          <Circle cx={48} cy={48} r={44} fill={`url(#spot-${name})`} />
          <Path
            d="M58 30a20 20 0 1 0 12 30 22 22 0 0 1-12-30z"
            fill={color.band.recovery.fill}
            fillOpacity={0.9}
          />
          <Circle cx={32} cy={30} r={2.5} fill={color.band.recovery.fill} />
          <Circle cx={70} cy={38} r={2} fill={color.band.recovery.fill} />
        </>
      ) : null}

      {/* Something closed off. */}
      {name === 'done' ? (
        <>
          <Circle cx={48} cy={48} r={44} fill={`url(#spot-${name})`} />
          <Circle cx={48} cy={48} r={24} fill={color.band.steady.fill} fillOpacity={0.18} />
          <Path d="M35 49l9 9 18-19" stroke={color.band.steady.fill} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </>
      ) : null}

      {/* An empty list, which is allowed to be a good outcome. */}
      {name === 'nothing' ? (
        <>
          <Circle cx={48} cy={48} r={44} fill={`url(#spot-${name})`} />
          <Rect x={28} y={34} width={40} height={30} rx={6} fill="none" stroke={color.line.strong} strokeWidth={3} strokeDasharray="6 5" />
        </>
      ) : null}

      {/* Three days stacked into one another. */}
      {name === 'wall' ? (
        <>
          <Circle cx={48} cy={48} r={44} fill={color.band.heavy.fill} fillOpacity={0.12} />
          <Rect x={26} y={54} width={12} height={22} rx={3} fill={color.band.heavy.fill} fillOpacity={0.55} />
          <Rect x={42} y={34} width={12} height={42} rx={3} fill={color.band.heavy.fill} />
          <Rect x={58} y={46} width={12} height={30} rx={3} fill={color.band.heavy.fill} fillOpacity={0.75} />
        </>
      ) : null}
    </Svg>
  );
}
