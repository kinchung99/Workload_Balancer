/**
 * Frame / Screen — every screen's outer box.
 *
 * Constrained to the artboard width so a web screenshot lands on a 390x844
 * Figma frame at 1:1 with no scaling. On a phone it is just a safe-area view.
 *
 * Everything inside one thumb: `footer` is where primary actions go, pinned to
 * the lower half, because the moment that matters most is one-handed on a bus.
 * `back` is the exception and belongs at the top left, where every platform puts
 * it and where nobody looks for anything else.
 */
import type { ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { color, space } from '@design/tokens';
import { Stack } from '../primitives/Stack';
import { Text } from '../primitives/Text';

const SURFACE = { page: 'bg-page', sunken: 'bg-sunken', night: 'bg-night' } as const;

export interface ScreenProps {
  children: ReactNode;
  /** Pinned to the bottom. Primary actions live here, never in a top corner. */
  footer?: ReactNode;
  surface?: keyof typeof SURFACE;
  scroll?: boolean;
  /**
   * Where back goes when there is no history to pop - a deep link, a shared URL,
   * a browser tab opened straight onto this route. Passing this is what makes a
   * screen reachable *out of* as well as into.
   */
  back?: Href;
  /** Optional word next to the chevron. Defaults to "Back". */
  backLabel?: string;
}

export function Screen({ children, footer, surface = 'page', scroll = true, back, backLabel }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const onNight = surface === 'night';

  const body = (
    <Stack gap={5} padX={5} className="w-full">
      {children}
    </Stack>
  );

  return (
    <View className={`flex-1 items-center ${SURFACE[surface]}`}>
      {/* max-w-frame keeps the web preview at exactly one artboard wide. */}
      <View className="w-full max-w-frame flex-1" style={{ paddingTop: insets.top || space[5] }}>
        {back ? (
          <View className="w-full px-5 pb-1 pt-2">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={backLabel ?? 'Back'}
              onPress={() => {
                // Popping history is right in-app; the fallback is what rescues
                // anyone who arrived here from a shared link with no history.
                if (router.canGoBack()) router.back();
                else router.replace(back);
              }}
              className="min-h-min flex-row items-center gap-2 self-start pr-4 active:opacity-60"
            >
              <Svg width={20} height={20} viewBox="0 0 20 20">
                <Path
                  d="M12.5 4 6.5 10l6 6"
                  stroke={onNight ? color.ink.inverse : color.ink.default}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </Svg>
              <Text variant="callout" tone={onNight ? 'inverse' : 'default'}>{backLabel ?? 'Back'}</Text>
            </Pressable>
          </View>
        ) : null}

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
