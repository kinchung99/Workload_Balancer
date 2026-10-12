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
import { Platform, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { keepTokenIn } from '@/lib/api';
import { Mascot } from '@/components';
import { useHydrated } from '@/hooks/useHydrated';
import { isClient } from '@/state/storage';

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
/*
 * On a phone the session token lives in the phone's own store. The web keeps
 * its default (localStorage), which is what makes iPhone Safari stay signed in.
 */
if (Platform.OS !== 'web') {
  const KEY = 'ballast/session-token';
  keepTokenIn({
    load: () => AsyncStorage.getItem(KEY),
    save: async (token) => { if (token) await AsyncStorage.setItem(KEY, token); else await AsyncStorage.removeItem(KEY); },
  });
}

export default function RootLayout() {
  useSession();
  useGate();
  useSync();
  useDemoFriends();
  usePopups();
  useCalendarSync();
  const waiting = useWaitingForSession();
  /*
   * Every page is prerendered from the sample week, because the build has no
   * account to render. Until this device's own state is read back, the
   * battery covers it - otherwise the first thing anyone opening the app saw
   * was a stranger's Monday, for the moment before their own week (or the
   * sign-in screen) replaced it.
   */
  const hydrated = useHydrated();
  const cover = !isClient || !hydrated || waiting;

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
      {/* Opening, or coming back signed in: a moment with the battery while your own state loads. */}
      {cover ? (
        <View className="absolute inset-0 items-center justify-center bg-page">
          <Mascot charge={72} loadPercent={28} size={120} />
        </View>
      ) : null}
    </SafeAreaProvider>
  );
}
