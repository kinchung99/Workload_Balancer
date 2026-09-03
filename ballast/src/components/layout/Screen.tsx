/**
 * Frame / Screen — every screen's outer box.
 *
 * Constrained to the artboard width so a web screenshot lands on a 390x844
 * Figma frame at 1:1 with no scaling. On a phone it is just a safe-area view.
 *
 * Everything inside one thumb: `footer` is where primary actions go, pinned to
 * the lower half, because the moment that matters most is one-handed on a bus.
 */
import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { space } from '@design/tokens';
import { Stack } from '../primitives/Stack';

const SURFACE = { page: 'bg-page', sunken: 'bg-sunken', night: 'bg-night' } as const;

export interface ScreenProps {
  children: ReactNode;
  /** Pinned to the bottom. Primary actions live here, never in a top corner. */
  footer?: ReactNode;
  surface?: keyof typeof SURFACE;
  scroll?: boolean;
}

export function Screen({ children, footer, surface = 'page', scroll = true }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const body = (
    <Stack gap={5} padX={5} className="w-full">
      {children}
    </Stack>
  );

  return (
    <View className={`flex-1 items-center ${SURFACE[surface]}`}>
      {/* max-w-frame keeps the web preview at exactly one artboard wide. */}
      <View className="w-full max-w-frame flex-1" style={{ paddingTop: insets.top || space[5] }}>
        {scroll ? (
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ paddingBottom: space[8] }}
            showsVerticalScrollIndicator={false}
          >
            {body}
          </ScrollView>
        ) : (
          <View className="flex-1">{body}</View>
        )}

        {footer ? (
          <Stack gap={3} padX={5} padY={5} className={`w-full border-t border-line-hairline ${SURFACE[surface]}`}>
            {footer}
          </Stack>
        ) : null}
      </View>
    </View>
  );
}

/** A screen's title block. Kept separate so every screen opens the same way. */
export function ScreenHeader({ children }: { children: ReactNode }) {
  return <Stack gap={2} className="w-full pt-4">{children}</Stack>;
}
