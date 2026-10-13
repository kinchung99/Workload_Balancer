import { Platform } from 'react-native';

/**
 * Animations run on the native thread on a phone. The web has no native
 * animated module, so asking for it there only logs a warning on every
 * animation - the same animation runs in JavaScript either way.
 */
export const NATIVE_DRIVER = Platform.OS !== 'web';
