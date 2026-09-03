import { useMemo, useState } from 'react';
import { Pressable, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Button, Card, Chip, Divider, DreadPicker, Screen, Stack, Text,
} from '@/components';
import { color } from '@design/tokens';
import { parse, titleFrom } from '@/lib/parser';
import { BUCKET_LABEL, COMMITMENT_LABEL, loadOf } from '@/lib/load';
import type { Dread } from '@/lib/types';
import { useStore } from '@/state/store';

const PLACEHOLDER = 'OS assignment due thurs, about 8 hours, really not looking forward to it';

/** When the parser has no idea it says so and asks one question, not five. */
const RANGES: Array<[string, number]> = [['Under an hour', 0.5], ['An hour or two', 1.5], ['Half a day', 4], ['A full day', 8]];

/**
 * Screen 2 — If adding a task feels like a task, nobody adds the task.
 *
 * Every workload app dies at data entry. So there is one field, it takes plain
 * language, and a wrong guess costs a single tap to correct rather than a form
 * to fill in.
 */
export default function Add() {
  const router = useRouter();
  const { today, items, addItem } = useStore();
  const [text, setText] = useState('');
  const [dreadOverride, setDreadOverride] = useState<Dread | null>(null);

  const draft = useMemo(() => parse(text || PLACEHOLDER, today), [text, today]);
  const dread = dreadOverride ?? draft.dread;
  const load = loadOf({ hours: draft.hours, dread });

  const repeating = items.filter((i) => i.repeats).slice(0, 3);
  const hoursUnknown = draft.unknown.includes('hours') && text.length > 0;

  return (
    <Screen
      footer={
        <Button
          label="Add it"
          onPress={() => {
            addItem({
              title: titleFrom(text || PLACEHOLDER),
              bucket: draft.bucket,
              hours: draft.hours,
              dread,
              commitment: draft.commitment,
              date: draft.date ?? today,
            });
            router.back();
          }}
        />
      }
    >
      <Stack gap={5} className="pt-4">
        <Stack direction="row" justify="between" align="center">
          <Text variant="title" accessibilityRole="header">Add anything</Text>
          <Pressable accessibilityRole="button" onPress={() => router.back()} className="min-h-min justify-center">
            <Text variant="body" tone="muted">Cancel</Text>
          </Pressable>
        </Stack>

        {/* a. One box, no fields. An on-device parser pulls out the bucket, the
            hours, the deadline and the dread from how a student would actually
            type it at a bus stop. No dropdowns, no date picker unless you want
            one. The same field takes dictation, because a lot of this gets
            logged walking between buildings or on the bus home from a shift. */}
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={PLACEHOLDER}
          placeholderTextColor={color.ink.subtle}
          multiline
          accessibilityLabel="Describe the thing in your own words"
          className="min-h-row rounded-md border border-line-strong bg-page px-5 py-4 text-body text-ink-default"
        />

        {/* b. Guesses are shown as chips, not applied silently. Six things
            inferred from one sentence and all six are one tap from being fixed.
            This is what makes the parser safe to be wrong. */}
        <Stack gap={3}>
          <Text variant="footnote" tone="subtle">Ballast read that as — tap anything to fix it</Text>
          <Stack direction="row" gap={3} wrap>
            <Chip label={BUCKET_LABEL[draft.bucket]} tone="guess" onPress={() => {}} accessibilityHint="Change the bucket" />
            <Chip label={`${draft.hours} hours`} onPress={() => {}} accessibilityHint="Change the estimate" />
            <Chip label={draft.dateLabel ?? 'No date'} onPress={() => {}} accessibilityHint="Change the date" />
            <Chip label={COMMITMENT_LABEL[draft.commitment]} onPress={() => {}} accessibilityHint="Change the commitment type" />
            <Chip label={`Dread ${dread}`} tone="guess" onPress={() => {}} accessibilityHint="Change the dread" />
            <Chip label={`Load ${load}`} readOnly />
          </Stack>
        </Stack>

        {/* An empty state is an invitation, not an error. */}
        {hoursUnknown ? (
          <Card gap={4}>
            <Text variant="heading">How long, roughly?</Text>
            <Stack direction="row" gap={3} wrap>
              {RANGES.map(([label]) => <Chip key={label} label={label} onPress={() => {}} />)}
            </Stack>
          </Card>
        ) : null}

        {/* c. Dread is the one thing a calendar cannot know. It is a single tap
            and it is the entire reason the capacity number means anything. We
            ask for it once per task and never again. */}
        <Card gap={5}>
          <Text variant="heading">How much are you dreading it?</Text>
          <DreadPicker value={dread} onChange={setDreadOverride} />
        </Card>

        {/* d. The invisible half of the week. For a student working twelve hours
            a week this is the load that no planner has ever shown them. */}
        <Card gap={4}>
          <Stack gap={2}>
            <Text variant="heading">Already counted, set once</Text>
            <Text variant="footnote" tone="muted">You entered these in September and never again.</Text>
          </Stack>
          <Stack gap={0}>
            {repeating.map((item, index) => (
              <Stack key={item.id}>
                {index > 0 ? <Divider /> : null}
                <Stack direction="row" gap={4} align="center" justify="between" className="min-h-row py-4">
                  <Stack gap={2} grow>
                    <Text variant="body" weight="semibold">{item.title}</Text>
                    <Text variant="footnote" tone="subtle">{item.when ?? `${item.hours}h a week`}</Text>
                  </Stack>
                  <Chip label="Repeats" readOnly />
                </Stack>
              </Stack>
            ))}
          </Stack>
        </Card>

        <Text variant="footnote" tone="subtle">
          Add nothing for a fortnight and this still works. Silence is a supported state.
        </Text>
      </Stack>
    </Screen>
  );
}
