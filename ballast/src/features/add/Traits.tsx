/**
 * The two questions that decide where something lands in the lists, asked the
 * same way everywhere it is asked: when it is added, when a calendar event is
 * set up, and on its own page.
 *
 * Tiles rather than words, so the answer is a tap on a picture: a pin for a set
 * time, a lock for a deadline, arrows for something that can move, a hand for
 * your own idea - and a leaf to a flame for how much it matters.
 */
import { Pressable } from 'react-native';
import { Stack, Text } from '@/components';
import { COMMITMENTS, COMMITMENT_EMOJI, COMMITMENT_LABEL, COMMITMENT_NOTE } from '@/lib/load';
import { IMPORTANCE_LEVELS } from '@/lib/importance';
import { tapFeedback } from '@/lib/haptics';
import type { CommitmentKind, Importance } from '@/lib/types';

function Tile({
  emoji, title, note, selected, onPress, label,
}: { emoji: string; title: string; note?: string; selected: boolean; onPress: () => void; label: string }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={() => { tapFeedback(); onPress(); }}
      className={`min-h-min flex-1 items-center gap-1 rounded-lg border-2 px-1 py-3 active:opacity-70 ${
        selected ? 'border-inverse bg-decor-cream' : 'border-line-hairline bg-raised'
      }`}
    >
      <Text variant="title">{emoji}</Text>
      <Text variant="caption" weight="bold" className="text-center">{title}</Text>
      {note ? <Text variant="micro" tone="muted" className="text-center">{note}</Text> : null}
    </Pressable>
  );
}

/** Can it move? Fixed, hard deadline, soft, or your own idea. */
export function CommitmentPicker({ value, onChange }: { value: CommitmentKind; onChange: (next: CommitmentKind) => void }) {
  return (
    <Stack gap={2} accessibilityRole="radiogroup">
      <Stack direction="row" gap={2}>
        {COMMITMENTS.slice(0, 2).map((kind) => (
          <Tile
            key={kind}
            emoji={COMMITMENT_EMOJI[kind]}
            title={COMMITMENT_LABEL[kind]}
            note={COMMITMENT_NOTE[kind]}
            selected={value === kind}
            label={`${COMMITMENT_LABEL[kind]}. ${COMMITMENT_NOTE[kind]}`}
            onPress={() => onChange(kind)}
          />
        ))}
      </Stack>
      <Stack direction="row" gap={2}>
        {COMMITMENTS.slice(2).map((kind) => (
          <Tile
            key={kind}
            emoji={COMMITMENT_EMOJI[kind]}
            title={COMMITMENT_LABEL[kind]}
            note={COMMITMENT_NOTE[kind]}
            selected={value === kind}
            label={`${COMMITMENT_LABEL[kind]}. ${COMMITMENT_NOTE[kind]}`}
            onPress={() => onChange(kind)}
          />
        ))}
      </Stack>
    </Stack>
  );
}

/** How important is it? Optional, normal, important, must. */
export function ImportancePicker({ value, onChange }: { value: Importance; onChange: (next: Importance) => void }) {
  return (
    <Stack direction="row" gap={2} accessibilityRole="radiogroup">
      {IMPORTANCE_LEVELS.map((level) => (
        <Tile
          key={level.value}
          emoji={level.emoji}
          title={level.word}
          selected={value === level.value}
          label={`${level.word}. ${level.note}`}
          onPress={() => onChange(level.value)}
        />
      ))}
    </Stack>
  );
}
