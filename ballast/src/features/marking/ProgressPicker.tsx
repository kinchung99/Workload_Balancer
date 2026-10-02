/**
 * How much of it got done - on a slider, not five buttons.
 *
 * Work rarely stops at a quarter or a half, so the answer is a slider in steps
 * of five percent, with the hours it means underneath and a face that fills up
 * as it moves. Three snaps sit below it for the common answers. Nothing is
 * saved until the button is pressed.
 */
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Chip, Slider, Stack, Text } from '@/components';
import { durationLabel } from '@/lib/sittings';
import { tapFeedback } from '@/lib/haptics';

const FACES = ['😶', '🌱', '🌗', '🌖', '✅'] as const;
const faceFor = (share: number) => FACES[Math.min(4, Math.round(share * 4))];

export function ProgressPicker({
  hours, initial = 0.5, onSave, saveLabel = 'Save',
}: {
  /** How long the sitting or block was, so a share can be said in hours. */
  hours: number;
  initial?: number;
  onSave: (share: number) => void;
  saveLabel?: string;
}) {
  const [percent, setPercent] = useState(Math.round(initial * 100));
  const share = percent / 100;

  return (
    <Stack gap={3}>
      <Stack direction="row" align="center" gap={3}>
        <View className="items-center justify-center rounded-pill bg-sunken" style={{ width: 56, height: 56 }}>
          <Text variant="title">{faceFor(share)}</Text>
        </View>
        <Stack gap={0} grow>
          <Text variant="display" accessibilityLiveRegion="polite">{percent}%</Text>
          <Text variant="micro" tone="muted">{durationLabel(Math.round(hours * share * 4) / 4)} of {durationLabel(hours)}</Text>
        </Stack>
      </Stack>
      <Slider
        value={percent}
        min={0}
        max={100}
        step={5}
        tone="steady"
        label="How much got done"
        readout={`${percent}%`}
        onChange={setPercent}
      />
      <Stack direction="row" gap={2}>
        {[0, 50, 100].map((snap) => (
          <Chip
            key={snap}
            label={snap === 0 ? 'Didn’t start' : snap === 100 ? 'All of it' : 'Half'}
            tone={percent === snap ? 'selected' : 'plain'}
            onPress={() => { tapFeedback(); setPercent(snap); }}
          />
        ))}
      </Stack>
      <Button label={`${saveLabel} · ${percent}%`} kind="steady" onPress={() => onSave(share)} />
    </Stack>
  );
}
