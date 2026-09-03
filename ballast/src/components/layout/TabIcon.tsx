/**
 * Navigation / Tab icon.
 *
 * Drawn as SVG rather than pulled from an icon font, so the glyphs paste into
 * Figma as editable vectors and the bundle carries no font it needs four
 * characters from.
 */
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { color } from '@design/tokens';

export type TabName = 'home' | 'areas' | 'plan' | 'actions';

export function TabIcon({ name, active }: { name: TabName; active: boolean }) {
  const stroke = active ? color.ink.default : color.ink.subtle;
  const fill = active ? color.ink.default : 'none';
  const line = { stroke, strokeWidth: 1.8, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

  return (
    <Svg width={22} height={22} viewBox="0 0 22 22">
      {name === 'home' ? <Path d="M3 9.5 11 3l8 6.5V18a1 1 0 0 1-1 1h-4v-6H8v6H4a1 1 0 0 1-1-1z" {...line} fill={fill} /> : null}
      {name === 'areas' ? (
        <>
          <Rect x={3} y={3} width={7} height={7} rx={2} {...line} fill={fill} />
          <Rect x={12} y={3} width={7} height={7} rx={2} {...line} />
          <Rect x={3} y={12} width={7} height={7} rx={2} {...line} />
          <Rect x={12} y={12} width={7} height={7} rx={2} {...line} fill={fill} />
        </>
      ) : null}
      {name === 'plan' ? (
        <>
          <Rect x={3} y={4} width={16} height={15} rx={3} {...line} />
          <Path d="M3 8.5h16M7.5 2.5v3M14.5 2.5v3" {...line} />
          {active ? <Rect x={6} y={11} width={4} height={5} rx={1} fill={stroke} /> : null}
        </>
      ) : null}
      {name === 'actions' ? (
        <>
          <Path d="M12 2.5 4.5 12.5h5.5l-.5 7 8-10.5H12z" {...line} fill={fill} />
          <Circle cx={11} cy={11} r={0} {...line} />
        </>
      ) : null}
    </Svg>
  );
}
