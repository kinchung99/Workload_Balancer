/**
 * Layout / Stack — the only container in the app.
 *
 * A Stack is a flex row or column with a gap, padding and alignment, which is
 * exactly the set of properties a Figma auto-layout frame has. Nothing in this
 * codebase positions absolutely or uses a margin, so every container maps to one
 * auto-layout frame with no interpretation required.
 */
import { View, type ViewProps } from 'react-native';
import type { SpaceStep } from '@design/tokens';

/** Static maps, because NativeWind resolves class names at build time. */
const GAP = { 0: 'gap-0', 1: 'gap-1', 2: 'gap-2', 3: 'gap-3', 4: 'gap-4', 5: 'gap-5', 6: 'gap-6', 7: 'gap-7', 8: 'gap-8', 9: 'gap-9', 10: 'gap-10' } as const;
const PAD = { 0: 'p-0', 1: 'p-1', 2: 'p-2', 3: 'p-3', 4: 'p-4', 5: 'p-5', 6: 'p-6', 7: 'p-7', 8: 'p-8', 9: 'p-9', 10: 'p-10' } as const;
const PAD_X = { 0: 'px-0', 1: 'px-1', 2: 'px-2', 3: 'px-3', 4: 'px-4', 5: 'px-5', 6: 'px-6', 7: 'px-7', 8: 'px-8', 9: 'px-9', 10: 'px-10' } as const;
const PAD_Y = { 0: 'py-0', 1: 'py-1', 2: 'py-2', 3: 'py-3', 4: 'py-4', 5: 'py-5', 6: 'py-6', 7: 'py-7', 8: 'py-8', 9: 'py-9', 10: 'py-10' } as const;

const ALIGN = { start: 'items-start', center: 'items-center', end: 'items-end', stretch: 'items-stretch' } as const;
const JUSTIFY = { start: 'justify-start', center: 'justify-center', end: 'justify-end', between: 'justify-between' } as const;

export interface StackProps extends ViewProps {
  /** Figma: auto-layout direction. */
  direction?: 'row' | 'column';
  /** Figma: item spacing. */
  gap?: SpaceStep;
  /** Figma: padding, all sides. */
  pad?: SpaceStep;
  padX?: SpaceStep;
  padY?: SpaceStep;
  /** Figma: counter-axis alignment. */
  align?: keyof typeof ALIGN;
  /** Figma: primary-axis alignment. */
  justify?: keyof typeof JUSTIFY;
  /** Figma: fill container. */
  grow?: boolean;
  wrap?: boolean;
  className?: string;
}

export function Stack({
  direction = 'column',
  gap = 0,
  pad,
  padX,
  padY,
  align,
  justify,
  grow,
  wrap,
  className = '',
  ...rest
}: StackProps) {
  const classes = [
    direction === 'row' ? 'flex-row' : 'flex-col',
    GAP[gap],
    pad !== undefined && PAD[pad],
    padX !== undefined && PAD_X[padX],
    padY !== undefined && PAD_Y[padY],
    align && ALIGN[align],
    justify && JUSTIFY[justify],
    grow && 'flex-1',
    wrap && 'flex-wrap',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return <View className={classes} {...rest} />;
}
