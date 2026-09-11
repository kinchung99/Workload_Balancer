/**
 * Foundations / Sticker — the drawings.
 *
 * Capture is the screen with the highest drop-off in any planner ever built,
 * and the reason is always the same: it looks like a form. These exist to make
 * it look like something else.
 *
 * Drawn rather than downloaded. A GIF would need a network, an asset pipeline
 * and a licence; every one of these is a few dozen bytes of SVG that renders
 * identically offline, in a static export and on a Figma frame. The motion is
 * real motion (`wiggle`), and it stops dead under Reduce Motion.
 *
 * Colour here is decorative and only decorative — see `color.decor`. Nothing on
 * a sticker is ever read as a value, which is what keeps "colour means band"
 * true everywhere it matters.
 */
import { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import { color } from '@design/tokens';
import { useReducedMotion } from '@/hooks/useReducedMotion';

export type StickerName =
  | 'assignment' | 'class' | 'shift' | 'move' | 'people' | 'chore'
  | 'sparkle' | 'heart' | 'clock' | 'calendar' | 'wave' | 'star'
  | 'sun' | 'moon' | 'scales' | 'leaf' | 'chat' | 'palette' | 'cloud' | 'battery' | 'basket'
  | 'wall';

const d = color.decor;
const INK = color.ink.default;

/** Two eyes and a smile, the same on every sticker that has a face. */
function Face({ cx, cy, w = 1 }: { cx: number; cy: number; w?: number }) {
  return (
    <G>
      <Circle cx={cx - 3.4 * w} cy={cy} r={1.5 * w} fill={INK} />
      <Circle cx={cx + 3.4 * w} cy={cy} r={1.5 * w} fill={INK} />
      <Path
        d={`M${cx - 2.6 * w} ${cy + 3 * w} q ${2.6 * w} ${2.2 * w} ${5.2 * w} 0`}
        stroke={INK} strokeWidth={1.4} strokeLinecap="round" fill="none"
      />
      <Ellipse cx={cx - 6.4 * w} cy={cy + 2.4 * w} rx={1.7 * w} ry={1.1 * w} fill={d.blush} opacity={0.75} />
      <Ellipse cx={cx + 6.4 * w} cy={cy + 2.4 * w} rx={1.7 * w} ry={1.1 * w} fill={d.blush} opacity={0.75} />
    </G>
  );
}

const outline = { stroke: INK, strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

export function Sticker({ name, size = 44, wiggle = false }: { name: StickerName; size?: number; wiggle?: boolean }) {
  const reduceMotion = useReducedMotion();
  const tilt = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!wiggle || reduceMotion) {
      tilt.setValue(0);
      return;
    }
    // A slow lean either side. Enough to catch the eye once, not enough to nag.
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(tilt, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(tilt, { toValue: -1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [wiggle, reduceMotion, tilt]);

  const art = (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      {/* Assignment: paper with a corner turned, and a face on it. */}
      {name === 'assignment' ? (
        <G>
          <Path d="M12 7h16l9 9v25a2 2 0 0 1-2 2H12a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z" fill={d.candy} {...outline} />
          <Path d="M28 7v9h9" fill={d.cream} {...outline} />
          <Face cx={24} cy={28} />
          <Path d="M16 36h16" stroke={INK} strokeWidth={1.6} strokeLinecap="round" opacity={0.35} />
        </G>
      ) : null}

      {/* Class: a mortarboard with a tassel that swings. */}
      {name === 'class' ? (
        <G>
          <Path d="M24 11 6 19l18 8 18-8-18-8z" fill={d.lilac} {...outline} />
          <Path d="M13 23v9c0 3 5 6 11 6s11-3 11-6v-9" fill={d.cream} {...outline} />
          <Face cx={24} cy={29} w={0.85} />
          <Path d="M40 21v8" stroke={INK} strokeWidth={1.8} strokeLinecap="round" />
          <Circle cx={40} cy={31} r={2.4} fill={d.lemon} {...outline} />
        </G>
      ) : null}

      {/* Shift: a takeaway cup, steam and all. */}
      {name === 'shift' ? (
        <G>
          <Path d="M14 18h20l-2 21a3 3 0 0 1-3 3H19a3 3 0 0 1-3-3l-2-21z" fill={d.sky} {...outline} />
          <Rect x={11} y={13} width={26} height={6} rx={3} fill={d.cream} {...outline} />
          <Face cx={24} cy={29} w={0.85} />
          <Path d="M19 9c0-2 2-2 2-4M27 9c0-2 2-2 2-4" stroke={INK} strokeWidth={1.6} strokeLinecap="round" opacity={0.5} />
        </G>
      ) : null}

      {/* Move: a trainer, mid-bounce. */}
      {name === 'move' ? (
        <G>
          <Path d="M8 30c0-4 3-6 6-8l6-4 5 6 6 1c5 1 9 4 9 8v3a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2v-6z" fill={d.mint} {...outline} />
          <Path d="M20 18l-4 6M25 24l-4 5" stroke={INK} strokeWidth={1.6} strokeLinecap="round" />
          <Face cx={31} cy={31} w={0.72} />
        </G>
      ) : null}

      {/* People: two friends, one just behind. */}
      {name === 'people' ? (
        <G>
          <Circle cx={31} cy={18} r={6.5} fill={d.lemon} {...outline} />
          <Path d="M21 41a10 10 0 0 1 20 0z" fill={d.lemon} {...outline} />
          <Circle cx={18} cy={20} r={7.5} fill={d.candy} {...outline} />
          <Path d="M7 41a11 11 0 0 1 22 0z" fill={d.candy} {...outline} />
          <Face cx={18} cy={20} w={0.8} />
        </G>
      ) : null}

      {/* Chore: a basket with something spilling out of it. */}
      {name === 'chore' ? (
        <G>
          <Path d="M9 20h30l-3 19a3 3 0 0 1-3 3H15a3 3 0 0 1-3-3L9 20z" fill={d.mint} {...outline} />
          <Path d="M7 16h34" stroke={INK} strokeWidth={2.4} strokeLinecap="round" />
          <Circle cx={18} cy={12} r={4} fill={d.candy} {...outline} />
          <Circle cx={29} cy={13} r={3.2} fill={d.sky} {...outline} />
          <Face cx={24} cy={31} w={0.85} />
        </G>
      ) : null}

      {/* Sparkle: the four-point kind. */}
      {name === 'sparkle' ? (
        <G>
          <Path d="M24 5c1.6 9.6 3.8 11.8 13.4 13.4C27.8 20 25.6 22.2 24 31.8 22.4 22.2 20.2 20 10.6 18.4 20.2 16.8 22.4 14.6 24 5z" fill={d.lemon} {...outline} />
          <Path d="M37 30c.8 4.6 1.8 5.6 6.4 6.4-4.6.8-5.6 1.8-6.4 6.4-.8-4.6-1.8-5.6-6.4-6.4 4.6-.8 5.6-1.8 6.4-6.4z" fill={d.candy} {...outline} />
        </G>
      ) : null}

      {/* Heart. */}
      {name === 'heart' ? (
        <Path
          d="M24 41S7 30.6 7 19.8A9.8 9.8 0 0 1 24 13a9.8 9.8 0 0 1 17 6.8C41 30.6 24 41 24 41z"
          fill={d.blush} {...outline}
        />
      ) : null}

      {/* Clock. */}
      {name === 'clock' ? (
        <G>
          <Circle cx={24} cy={25} r={16} fill={d.sky} {...outline} />
          <Path d="M24 15v10l7 4" stroke={INK} strokeWidth={2.2} strokeLinecap="round" fill="none" />
          <Ellipse cx={13} cy={31} rx={2.4} ry={1.6} fill={d.blush} opacity={0.8} />
          <Ellipse cx={35} cy={31} rx={2.4} ry={1.6} fill={d.blush} opacity={0.8} />
        </G>
      ) : null}

      {/* Calendar. */}
      {name === 'calendar' ? (
        <G>
          <Rect x={7} y={11} width={34} height={30} rx={5} fill={d.cream} {...outline} />
          <Path d="M7 20h34" stroke={INK} strokeWidth={1.8} />
          <Rect x={7} y={11} width={34} height={9} rx={4.5} fill={d.lilac} {...outline} />
          <Path d="M16 7v7M32 7v7" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
          <Circle cx={17} cy={28} r={2.6} fill={d.candy} />
          <Circle cx={24} cy={28} r={2.6} fill={d.mint} />
          <Circle cx={31} cy={28} r={2.6} fill={d.lemon} />
          <Circle cx={17} cy={35} r={2.6} fill={d.sky} />
        </G>
      ) : null}

      {/* Wave: a hand saying hello. */}
      {name === 'wave' ? (
        <G>
          <Path d="M17 41c-5-2-8-7-8-13V17a3 3 0 0 1 6 0v7V11a3 3 0 0 1 6 0v12V9a3 3 0 0 1 6 0v14V14a3 3 0 0 1 6 0v14c0 7-4 13-11 13h-5z" fill={d.lemon} {...outline} />
        </G>
      ) : null}


      {/* Sun: the morning, and the top of the home screen. */}
      {name === 'sun' ? (
        <G>
          <Path d="M24 4v5M24 39v5M4 24h5M39 24h5M10 10l3.5 3.5M34.5 34.5 38 38M38 10l-3.5 3.5M13.5 34.5 10 38" stroke={INK} strokeWidth={2} strokeLinecap="round" />
          <Circle cx={24} cy={24} r={10} fill={d.lemon} {...outline} />
          <Face cx={24} cy={23} w={0.8} />
        </G>
      ) : null}

      {/* Moon: the evening you are about to plan. */}
      {name === 'moon' ? (
        <G>
          <Path d="M31 6a19 19 0 1 0 11 24A15 15 0 0 1 31 6z" fill={d.lilac} {...outline} />
          <Circle cx={38} cy={12} r={1.8} fill={d.lemon} />
          <Circle cx={43} cy={19} r={1.3} fill={d.lemon} />
          <Circle cx={19} cy={25} r={1.6} fill={INK} />
          <Circle cx={27} cy={26} r={1.6} fill={INK} />
          <Path d="M20 31q3.5 2.6 7 0" stroke={INK} strokeWidth={1.5} strokeLinecap="round" fill="none" />
        </G>
      ) : null}

      {/* Scales: the trade sheet. Something has to come off. */}
      {name === 'scales' ? (
        <G>
          <Path d="M24 9v31M14 40h20" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
          <Path d="M9 16h30" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
          <Circle cx={24} cy={12} r={2.6} fill={d.lemon} {...outline} />
          <Path d="M4 22a5 5 0 0 0 10 0z" fill={d.candy} {...outline} />
          <Path d="M34 22a5 5 0 0 0 10 0z" fill={d.mint} {...outline} />
          <Path d="M9 16v6M39 16v6" stroke={INK} strokeWidth={1.6} />
        </G>
      ) : null}

      {/* Leaf: rest, and the thing that grows back. */}
      {name === 'leaf' ? (
        <G>
          <Path d="M38 8C22 8 10 16 10 28a12 12 0 0 0 12 12c12 0 16-14 16-32z" fill={d.mint} {...outline} />
          <Path d="M33 14C25 20 20 28 18 38" stroke={INK} strokeWidth={1.6} strokeLinecap="round" fill="none" opacity={0.55} />
          <Face cx={25} cy={24} w={0.72} />
        </G>
      ) : null}

      {/* Chat: the message you have been putting off. */}
      {name === 'chat' ? (
        <G>
          <Path d="M7 13a5 5 0 0 1 5-5h24a5 5 0 0 1 5 5v14a5 5 0 0 1-5 5H21l-9 8v-8a5 5 0 0 1-5-5V13z" fill={d.sky} {...outline} />
          <Circle cx={18} cy={20} r={2} fill={INK} />
          <Circle cx={24} cy={20} r={2} fill={INK} />
          <Circle cx={30} cy={20} r={2} fill={INK} />
        </G>
      ) : null}

      {/* Palette: the design system. */}
      {name === 'palette' ? (
        <G>
          <Path d="M24 6c10 0 18 7 18 16 0 6-5 8-9 8h-3a3 3 0 0 0-2 5c1 2 0 5-4 5-9 0-18-7-18-17S14 6 24 6z" fill={d.cream} {...outline} />
          <Circle cx={17} cy={17} r={2.6} fill={d.blush} />
          <Circle cx={26} cy={14} r={2.6} fill={d.lemon} />
          <Circle cx={34} cy={20} r={2.6} fill={d.sky} />
          <Circle cx={16} cy={27} r={2.6} fill={d.mint} />
        </G>
      ) : null}

      {/* Cloud: what is going on in your head. */}
      {name === 'cloud' ? (
        <G>
          <Path d="M15 34a8 8 0 0 1-.8-16 10 10 0 0 1 19-2 7 7 0 0 1 0 18H15z" fill={d.lilac} {...outline} />
          <Circle cx={20} cy={26} r={1.7} fill={INK} />
          <Circle cx={28} cy={26} r={1.7} fill={INK} />
          <Path d="M20.5 30.5q3.5 2.6 7 0" stroke={INK} strokeWidth={1.5} strokeLinecap="round" fill="none" />
        </G>
      ) : null}

      {/* Battery: the ledger, and what you are owed. */}
      {name === 'battery' ? (
        <G>
          <Rect x={6} y={15} width={32} height={19} rx={5} fill={d.cream} {...outline} />
          <Rect x={39} y={21} width={4} height={7} rx={2} fill={INK} />
          <Rect x={10} y={19} width={14} height={11} rx={3} fill={d.mint} />
          <Circle cx={17} cy={22.5} r={1.4} fill={INK} />
          <Circle cx={24} cy={22.5} r={1.4} fill={INK} />
          <Path d="M17.5 26.5q3.2 2.4 6.4 0" stroke={INK} strokeWidth={1.4} strokeLinecap="round" fill="none" />
        </G>
      ) : null}

      {/* Basket: the errands, said in one breath. */}
      {name === 'basket' ? (
        <G>
          <Path d="M6 18h36l-4 20a4 4 0 0 1-4 3H14a4 4 0 0 1-4-3L6 18z" fill={d.candy} {...outline} />
          <Path d="M16 18l5-10M32 18l-5-10" stroke={INK} strokeWidth={2} strokeLinecap="round" />
          <Face cx={24} cy={29} w={0.85} />
        </G>
      ) : null}

      {/* Wall: four things stacked inside seventy-two hours. */}
      {name === 'wall' ? (
        <G>
          <Rect x={8} y={30} width={32} height={11} rx={3} fill={d.candy} {...outline} />
          <Rect x={11} y={19} width={26} height={11} rx={3} fill={d.lemon} {...outline} />
          <Rect x={14} y={8} width={20} height={11} rx={3} fill={d.blush} {...outline} />
          <Circle cx={20} cy={35.5} r={1.5} fill={INK} />
          <Circle cx={28} cy={35.5} r={1.5} fill={INK} />
          <Path d="M21 38.6h6" stroke={INK} strokeWidth={1.5} strokeLinecap="round" />
        </G>
      ) : null}

      {/* Star. */}
      {name === 'star' ? (
        <Path d="M24 7l5.4 11 12.1 1.7-8.8 8.5 2.1 12-10.8-5.7L13.2 40l2.1-12-8.8-8.5L18.6 18 24 7z" fill={d.lemon} {...outline} />
      ) : null}
    </Svg>
  );

  if (!wiggle || reduceMotion) return <View>{art}</View>;
  return (
    <Animated.View
      style={{ transform: [{ rotate: tilt.interpolate({ inputRange: [-1, 1], outputRange: ['-7deg', '7deg'] }) }] }}
    >
      {art}
    </Animated.View>
  );
}
