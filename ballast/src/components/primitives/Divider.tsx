/** Surface / Divider. A 1pt hairline between rows. */
import { View } from 'react-native';

export function Divider({ className = '' }: { className?: string }) {
  return <View className={`h-px w-full bg-line-hairline ${className}`} />;
}
