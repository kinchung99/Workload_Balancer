/** Control / Checkbox. Errand rows, one tap, struck through when done. */
import { Pressable, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { color } from '@design/tokens';
import { Stack } from './Stack';
import { Text } from './Text';

export function Checkbox({
  label,
  checked,
  onPress,
}: {
  label: string;
  checked: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      onPress={onPress}
      className="min-h-min justify-center active:opacity-70"
    >
      <Stack direction="row" gap={4} align="center">
        <View
          className={`h-6 w-6 items-center justify-center rounded-sm border-2 ${
            checked ? 'border-steady-fill bg-steady-fill' : 'border-line-strong'
          }`}
        >
          {checked ? (
            <Svg width={14} height={14} viewBox="0 0 14 14">
              <Path d="M2.5 7.5 L5.5 10.5 L11.5 3.5" stroke={color.ink.inverse} strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          ) : null}
        </View>
        <Text variant="body" tone={checked ? 'subtle' : 'default'} className={checked ? 'line-through' : ''}>
          {label}
        </Text>
      </Stack>
    </Pressable>
  );
}
