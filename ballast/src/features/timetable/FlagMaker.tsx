import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { Button, Stack, Text, Toggle } from '@/components';
import { color } from '@design/tokens';
import { FLAG_EMOJIS } from '@/lib/timetable';
import { successFeedback, tapFeedback } from '@/lib/haptics';
import { useStore } from '@/state/store';

/**
 * Make a flag of your own.
 *
 * A picture, a few words, and one real decision: does this flag protect the
 * class? Most flags are notes to self ("bring the laptop") and should not stop
 * the app suggesting a move; a few are reasons the hour cannot be skipped
 * ("lab sign-off"). The switch is off by default and fixed once made.
 */
export function FlagMaker({ onMade, onCancel }: { onMade: (id: string) => void; onCancel: () => void }) {
  const { addCustomFlag } = useStore();
  const [emoji, setEmoji] = useState(FLAG_EMOJIS[0]);
  const [label, setLabel] = useState('');
  const [protect, setProtect] = useState(false);
  const ready = label.trim().length > 0;

  return (
    <Stack gap={4} className="rounded-lg border-2 border-dashed border-line-strong bg-sunken p-4">
      <Text variant="micro" tone="subtle">NEW FLAG</Text>

      <Stack direction="row" gap={2} wrap>
        {FLAG_EMOJIS.map((option) => (
          <Pressable
            key={option}
            accessibilityRole="radio"
            accessibilityState={{ selected: option === emoji }}
            accessibilityLabel={`Flag picture ${option}`}
            onPress={() => { tapFeedback(); setEmoji(option); }}
            className="items-center justify-center rounded-md active:opacity-60"
            style={{
              width: 40, height: 40,
              backgroundColor: option === emoji ? color.decor.lemon : color.surface.raised,
              borderWidth: option === emoji ? 2 : 1,
              borderColor: option === emoji ? color.ink.default : color.line.hairline,
            }}
          >
            <Text variant="heading">{option}</Text>
          </Pressable>
        ))}
      </Stack>

      <TextInput
        value={label}
        onChangeText={(text) => setLabel(text.slice(0, 24))}
        accessibilityLabel="What the flag says"
        placeholder="e.g. Lab sign-off, Groups picked"
        placeholderTextColor={color.ink.subtle}
        className="min-h-min rounded-md border border-line-strong bg-page px-4 py-3 text-body text-ink-default"
      />

      <Stack direction="row" gap={3} align="center">
        <Stack gap={1} grow>
          <Text variant="callout" weight="semibold">Protect the class</Text>
          <Text variant="micro" tone="muted">Never suggest moving or skipping it.</Text>
        </Stack>
        <Toggle state={protect ? 'on' : 'off'} label="Protect classes with this flag" onPress={() => setProtect(!protect)} />
      </Stack>

      {/* What it will look like on a class. */}
      <Stack direction="row" gap={2} align="center">
        <Text variant="micro" tone="subtle">PREVIEW</Text>
        <View
          className={`rounded-pill border px-4 py-2 ${protect ? 'border-heavy-fill bg-heavy-wash' : 'border-inverse bg-inverse'}`}
        >
          <Text variant="caption" tone={protect ? 'heavy' : 'inverse'}>{emoji} {label.trim() || 'Your flag'}</Text>
        </View>
      </Stack>

      <Stack direction="row" gap={2}>
        <Button label="Cancel" kind="quiet" className="flex-1" onPress={onCancel} />
        <Button
          label="Add flag"
          kind={ready ? 'primary' : 'secondary'}
          className="flex-1"
          disabled={!ready}
          onPress={() => {
            if (!ready) return;
            const id = addCustomFlag({ label, emoji, protect });
            successFeedback();
            onMade(id);
          }}
        />
      </Stack>
    </Stack>
  );
}
