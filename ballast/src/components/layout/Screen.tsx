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
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, useRouter, type Href } from 'expo-router';
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
  /**
   * Floats over the top of the screen without blocking it - a notification
   * that slides in. Only what it draws takes touches; the page under it stays live.
   */
  overlay?: ReactNode;
}

/** What each page is called on a back button that returns to it. */
const PAGE_NAME: Record<string, string> = {
  index: 'Home', plan: 'Plan', friends: 'Friends', you: 'You',
  notifications: 'Notifications', update: 'Quick update', plans: 'Plans', calendar: 'Calendar',
  'calendar/setup': 'Calendar', battery: 'Battery', priority: 'What first', rebalance: 'Rebalance',
  recover: 'Recovery', checkin: 'Check in', 'tonight/[step]': 'Tonight', settings: 'Settings',
  profile: 'Profile', sharing: 'Sharing', 'sharing/hours': 'Your hours', 'sharing/people': 'Who sees',
  'plan-together': 'Plan', 'find-friends': 'Find friends', everyone: 'All friends', message: 'Message',
  timetable: 'Timetable', 'timetable/[step]': 'Timetable', 'module/[id]': 'Module', 'group/[id]': 'Group',
  'group/[id]/add': 'Invite', 'group/[id]/plan': 'Group plan', 'group/new': 'New group', 'friend/[id]': 'Friend',
  'item/[id]': 'Task', 'item/[id]/sittings': 'Sittings', marked: 'Marked', prescription: 'Recovery',
  'prescription/[step]': 'Recovery', 'decline/[id]': 'Back', account: 'Account', add: 'Add', 'add/[step]': 'Add',
};

interface RouteLike { key: string; name: string; state?: { index?: number; routes: Array<{ name: string }> } }

/** The page under this one in the stack, by name - or nothing when this is the first. */
function usePrevious(): string | null {
  const route = useRoute();
  const navigation = useNavigation();
  const routes = (navigation.getState()?.routes ?? []) as RouteLike[];
  const at = routes.findIndex((r) => r.key === route.key);
  const prev = at > 0 ? routes[at - 1] : undefined;
  if (!prev) return null;
  // The tabs are one stack entry; the name is whichever tab was showing.
  if (prev.name === '(tabs)') {
    const tab = prev.state?.routes[prev.state.index ?? 0]?.name ?? 'index';
    return PAGE_NAME[tab] ?? 'Back';
  }
  return PAGE_NAME[prev.name] ?? 'Back';
}

export function Screen({ children, footer, surface = 'page', scroll = true, back, backLabel, overlay }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const navigation = useNavigation();
  const previous = usePrevious();
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
              accessibilityLabel={previous ?? backLabel ?? 'Back'}
              onPress={() => {
                // Back to the page you came from, and named after it. Only a
                // page opened straight from a link, with nothing under it,
                // falls back to its usual parent.
                if (previous) navigation.goBack();
                else router.navigate(back);
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
              <Text variant="callout" tone={onNight ? 'inverse' : 'default'}>{previous ?? backLabel ?? 'Back'}</Text>
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

        {overlay ? (
          <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { paddingTop: (insets.top || space[5]) + space[2] }]}>
            {overlay}
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** A screen's title block. Kept separate so every screen opens the same way. */
export function ScreenHeader({ children }: { children: ReactNode }) {
  return <Stack gap={2} className="w-full pt-4">{children}</Stack>;
}
