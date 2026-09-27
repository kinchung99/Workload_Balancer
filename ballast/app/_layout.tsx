import '../global.css';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { color } from '@design/tokens';
import { useSync } from '@/hooks/useSync';

/**
 * Root layout.
 *
 * Everything below the tabs is a plain stack: the capture sheet, the rebalance
 * sheet, the drafter and the previews. There is still no auth *flow* — signing
 * in lives on one optional screen and gates nothing, because the app works
 * offline whether or not anyone ever does.
 *
 * `useSync` is mounted here and nowhere else. It is the app's only background
 * loop, and it does nothing at all until somebody signs in.
 */
export default function RootLayout() {
  useSync();

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
    </SafeAreaProvider>
  );
}
