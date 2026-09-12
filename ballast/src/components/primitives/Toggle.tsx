/**
 * Control / Toggle.
 *
 * Three states, not two. `locked` is a hard deadline, which the app will never
 * propose moving; `protected` is recovery, which takes a deliberate tap to
 * override and says what it will cost. Both read as off but neither is a plain
 * off, and both are announced differently to a screen reader.
 */
import { Pressable, View } from 'react-native';
import { tapFeedback } from '@/lib/haptics';

export type ToggleState = 'on' | 'off' | 'locked' | 'protected';

const TRACK = {
  on: 'bg-control-onFill',
  off: 'bg-control-offFill',
  locked: 'bg-control-lockedFill',
  protected: 'bg-control-lockedFill',
} as const;

/** 44pt of target around a 30pt track. Not a spacing token: there is none this size. */
const TRACK_WIDTH = 44;

const HINT: Record<ToggleState, string> = {
  on: 'Selected. This change will be applied.',
  off: 'Not selected.',
  locked: 'Hard deadline. This is never suggested for moving.',
  protected: 'Recovery, protected by default. Overriding this costs you the rest.',
};

export interface ToggleProps {
  state: ToggleState;
  onPress?: () => void;
  label: string;
}

export function Toggle({ state, onPress, label }: ToggleProps) {
  const disabled = state === 'locked';
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: state === 'on', disabled }}
      accessibilityHint={HINT[state]}
      disabled={disabled}
      onPress={() => { tapFeedback(); onPress?.(); }}
      // 44pt target around a 30pt control, which is the WCAG rule people skip.
      className="min-h-min min-w-min items-end justify-center"
    >
      <View className={`h-6 justify-center rounded-pill p-1 ${TRACK[state]}`} style={{ width: TRACK_WIDTH }}>
        <View className={`h-5 w-5 rounded-pill bg-control-knob ${state === 'on' ? 'self-end' : 'self-start'}`} />
      </View>
    </Pressable>
  );
}
