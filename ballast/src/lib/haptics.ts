/**
 * Haptics, safely.
 *
 * Physical feedback is most of what separates an app that feels finished from a
 * set of screens. It is also unavailable on web and during prerender, so every
 * call goes through here and fails silently rather than crashing a static build.
 */
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

const enabled = Platform.OS === 'ios' || Platform.OS === 'android';

/** A dread dot, a slider notch, a checkbox. */
export const tapFeedback = () => {
  if (enabled) Haptics.selectionAsync().catch(() => {});
};

/** A change applied, an item added. */
export const successFeedback = () => {
  if (enabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
};

/** Crossing into a heavier band. Used sparingly - this app does not nag. */
export const warnFeedback = () => {
  if (enabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
};
