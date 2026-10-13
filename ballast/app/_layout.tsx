import '../global.css';
import { useEffect } from 'react';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import Head from 'expo-router/head';
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
import { reportError, reportUncaught } from '@/lib/report';
import { Button, Mascot, Stack as Column, Text } from '@/components';
import { useHydrated } from '@/hooks/useHydrated';

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

/**
 * When a screen throws.
 *
 * Instead of a blank page: what happened in one line, a way back, and a quiet
 * report to the server so it gets fixed without anyone having to describe it.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => { reportError('crash', error); }, [error]);
  return (
    <View className="flex-1 items-center justify-center bg-page px-8">
      <Column gap={4} align="center">
        <Mascot charge={18} loadPercent={92} size={110} />
        <Text variant="title" className="text-center">Something went wrong</Text>
        <Text variant="callout" tone="muted" className="text-center">It's been reported. Your week is safe.</Text>
        <Button label="Try again" onPress={() => void retry()} />
        <Button
          label="Back to Home"
          kind="secondary"
          onPress={() => { if (Platform.OS === 'web') globalThis.location?.assign('/'); else void retry(); }}
        />
      </Column>
    </View>
  );
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
   * account to render. The HTML shell covers it (see +html) until this
   * device's own state is read back, and it is lifted here - outside React,
   * so the page underneath never has to mismatch the HTML to hide it.
   */
  const hydrated = useHydrated();
  useEffect(() => { if (Platform.OS === 'web') reportUncaught(); }, []);
  useEffect(() => {
    if (hydrated && Platform.OS === 'web') globalThis.document?.getElementById('boot-cover')?.remove();
  }, [hydrated]);

  return (
    <SafeAreaProvider>
      {/* A name in the tab and for screen readers, on every page. */}
      <Head><title>Ballast</title></Head>
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
