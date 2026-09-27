/**
 * Marking a drawing as decoration, on every platform.
 *
 * Charts here are drawn twice over: once as shapes, and once as a sentence on the
 * parent for a screen reader. The shapes themselves must therefore be hidden, or
 * the reader announces a pile of anonymous paths after the sentence that already
 * explained them.
 *
 * The catch is that the two platforms spell it differently, and React Native Web
 * does not translate these two props — it passes them straight through to the DOM,
 * where React logs an error for every chart on the page. Harmless, but it fills a
 * developer's console with noise that hides real problems.
 */
import { Platform } from 'react-native';

export const DECORATIVE = Platform.OS === 'web'
  ? ({ 'aria-hidden': true } as const)
  : ({ accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' } as const);
