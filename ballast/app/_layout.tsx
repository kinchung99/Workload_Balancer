import '../global.css';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { color } from '@design/tokens';
import { useSync } from '@/hooks/useSync';
import { useGate, useSession, useWaitingForSession } from '@/hooks/useGate';
import { useDemoFriends } from '@/hooks/useDemoFriends';
import { usePopups } from '@/hooks/usePopups';
import { useCalendarSync } from '@/hooks/useCalendarSync';
import { View } from 'react-native';
import { Mascot } from '@/components';

/**
 * Root layout.
 *
 * Everything below the tabs is a plain stack: the capture sheet, the rebalance
 * sheet, the drafter and the previews.
 *
 * The app sits behind sign-in: `useSession` restores a saved session on launch
 * and `useGate` sends anyone signed out to the sign-in screen. `useSync` is the
 * app's only background loop, and it does nothing until somebody signs in.
 */
export default function RootLayout() {
  useSession();
  useGate();
  useSync();
  useDemoFriends();
  usePopups();
  useCalendarSync();
  const waiting = useWaitingForSession();

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: color.surface.page },
          // Presented as sheets, which is what makes "Not this week" cheap.
          animation: 'slide_from_bottom',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ animation: 'default' }} />
      </Stack>
      {/* Coming back signed in: a moment with the battery while the session is confirmed. */}
      {waiting ? (
        <View className="absolute inset-0 items-center justify-center bg-page">
          <Mascot charge={72} loadPercent={28} size={120} />
        </View>
      ) : null}
    </SafeAreaProvider>
  );
}
