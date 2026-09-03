import '../global.css';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { color } from '@design/tokens';

/**
 * Root layout.
 *
 * Everything below the tabs is a plain stack: the capture sheet, the rebalance
 * sheet, the drafter and the previews. No auth flow, no settings screen - both
 * were cut on purpose, and the app genuinely works offline as a result.
 */
export default function RootLayout() {
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
