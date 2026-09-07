import { useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Button, Card, Chip, Divider, DreadPicker, Screen, Stack, Text,
} from '@/components';
import { color } from '@design/tokens';
import { parse, titleFrom } from '@/lib/parser';
import { BUCKETS, BUCKET_LABEL, COMMITMENT_LABEL, loadOf } from '@/lib/load';
import { addDays, dayName, formatShort } from '@/lib/dates';
import { formatHour, startOptions } from '@/lib/schedule';
import { successFeedback, tapFeedback } from '@/lib/haptics';
import type { BucketKey, CommitmentKind, Dread } from '@/lib/types';
import { useStore } from '@/state/store';
import { useItemsWithLogs } from '@/state/selectors';

const PLACEHOLDER = 'OS assignment due thurs, about 8 hours, really not looking forward to it';
const HOUR_OPTIONS = [0.5, 1, 2, 4, 8];
const RANGES: Array<[string, number]> = [['Under an hour', 0.5], ['An hour or two', 1.5], ['Half a day', 4], ['A full day', 8]];

type Field = 'bucket' | 'hours' | 'date' | 'commitment' | 'time';

/**
 * Screen 2 — if adding a task feels like a task, nobody adds the task.
 *
 * One field, plain language, and every guess the parser makes is shown back as a
 * chip you can tap to change. That is what makes the parser safe to be wrong:
 * nothing is applied silently and a bad guess costs one tap, not a form.
 */
export default function Add() {
  const router = useRouter();
  // Prefilled when you arrive from a gap in a day: "add something here" should
  // mean here, not "somewhere on Tuesday".
  const params = useLocalSearchParams<{ date?: string; start?: string }>();
  const { today, items, addItem } = useStore();
  const scheduleItems = useItemsWithLogs();

  const [text, setText] = useState('');
  const [editing, setEditing] = useState<Field | null>(null);
  const [override, setOverride] = useState<Partial<Record<Field | 'dread' | 'time', unknown>>>(() => ({
    ...(params.date ? { date: params.date } : {}),
    ...(params.start ? { time: Number(params.start) } : {}),
  }));

  const parsed = useMemo(() => parse(text || PLACEHOLDER, today), [text, today]);

  // The parse is the starting point; anything the student corrected wins.
  const bucket = (override.bucket as BucketKey) ?? parsed.bucket;
  const hours = (override.hours as number) ?? parsed.hours;
  const date = (override.date as string) ?? parsed.date ?? today;
  const commitment = (override.commitment as CommitmentKind) ?? parsed.commitment;
  const dread = (override.dread as Dread) ?? parsed.dread;
  const load = loadOf({ hours, dread });
  // `null` is a real answer here: some work genuinely has no slot yet, and
  // pretending otherwise is what makes a calendar lie.
  const time = (override.time as number | null | undefined) ?? null;
  const timeOptions = startOptions(scheduleItems, date, hours);

  const correct = (field: Field | 'dread' | 'time', value: unknown) => {
    tapFeedback();
    setOverride((prev) => ({ ...prev, [field]: value }));
    if (field !== 'dread') setEditing(null);
  };

  const toggle = (field: Field) => {
    tapFeedback();
    setEditing((current) => (current === field ? null : field));
  };

  const repeating = items.filter((item) => item.repeats).slice(0, 3);
  // The placeholder is a worked example, not a default. Submitting an empty
  // field used to add "OS assignment" - once per press - which is where the
  // repeating phantom tasks came from.
  const ready = text.trim().length > 0;
  const hoursUnknown = parsed.unknown.includes('hours') && text.length > 0 && override.hours === undefined;

  return (
    <Screen
      back="/"
      backLabel="Home"
      footer={
        <Button
          label={ready ? `Add it${time === null ? '' : ` at ${formatHour(time)}`}` : 'Type something first'}
          kind={ready ? 'primary' : 'secondary'}
          accessibilityState={{ disabled: !ready }}
          onPress={() => {
            if (!ready) return;
            addItem({
              title: titleFrom(text),
              bucket, hours, dread, commitment, date,
              ...(time === null ? {} : { startHour: time }),
            });
            successFeedback();
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

        <TextInput
          value={text}
          onChangeText={(next) => {
            setText(next);
            // A new sentence means a new parse; old corrections no longer apply.
            setOverride({});
            setEditing(null);
          }}
          placeholder={PLACEHOLDER}
          placeholderTextColor={color.ink.subtle}
          multiline
          accessibilityLabel="Describe the thing in your own words"
          className="min-h-row rounded-md border border-line-strong bg-page px-5 py-4 text-body text-ink-default"
        />

        <Stack gap={3}>
          <Text variant="footnote" tone="subtle">Ballast read that as — tap anything to fix it</Text>
          <Stack direction="row" gap={3} wrap>
            <Chip
              label={BUCKET_LABEL[bucket]}
              tone={editing === 'bucket' ? 'selected' : 'guess'}
              onPress={() => toggle('bucket')}
              accessibilityHint="Change the area"
            />
            <Chip
              label={hours < 1 ? `${Math.round(hours * 60)} minutes` : `${hours} hours`}
              tone={editing === 'hours' ? 'selected' : 'plain'}
              onPress={() => toggle('hours')}
              accessibilityHint="Change the estimate"
            />
            <Chip
              label={formatShort(date)}
              tone={editing === 'date' ? 'selected' : 'plain'}
              onPress={() => toggle('date')}
              accessibilityHint="Change the day"
            />
            <Chip
              label={time === null ? 'No time yet' : `${formatHour(time)}–${formatHour(time + hours)}`}
              tone={editing === 'time' ? 'selected' : time === null ? 'plain' : 'steady'}
              onPress={() => toggle('time')}
              accessibilityHint="Give it a time"
            />
            <Chip
              label={COMMITMENT_LABEL[commitment]}
              tone={editing === 'commitment' ? 'selected' : 'plain'}
              onPress={() => toggle('commitment')}
              accessibilityHint="Change the commitment type"
            />
            <Chip label={`Dread ${dread}`} tone="guess" readOnly />
            <Chip label={`Load ${load}`} readOnly />
          </Stack>

          {/* The correction panel. One tap to open, one tap to fix, and it closes. */}
          {editing ? (
            <Card tone="sunken" gap={3}>
              <Text variant="micro" tone="subtle">
                {editing === 'bucket'
                  ? 'WHICH AREA'
                  : editing === 'hours'
                    ? 'HOW LONG'
                    : editing === 'date'
                      ? 'WHICH DAY'
                      : editing === 'time'
                        ? `WHAT TIME ON ${dayName(date).toUpperCase()} · ${timeOptions.length} FREE`
                        : 'WHAT KIND'}
              </Text>
              <Stack direction="row" gap={3} wrap>
                {editing === 'bucket'
                  ? BUCKETS.map((option) => (
                      <Chip key={option} label={BUCKET_LABEL[option]} tone={option === bucket ? 'selected' : 'plain'} onPress={() => correct('bucket', option)} />
                    ))
                  : null}
                {editing === 'hours'
                  ? HOUR_OPTIONS.map((option) => (
                      <Chip key={option} label={option < 1 ? `${option * 60}m` : `${option}h`} tone={option === hours ? 'selected' : 'plain'} onPress={() => correct('hours', option)} />
                    ))
                  : null}
                {editing === 'date'
                  ? Array.from({ length: 7 }, (_, offset) => addDays(today, offset)).map((option) => (
                      <Chip
                        key={option}
                        label={offset0(option, today)}
                        tone={option === date ? 'selected' : 'plain'}
                        onPress={() => {
                          // A new day means the old time may not be free on it.
                          setOverride((prev) => ({ ...prev, date: option, time: null }));
                          setEditing('time');
                        }}
                      />
                    ))
                  : null}
                {editing === 'time'
                  ? [
                      <Chip key="none" label="No time yet" tone={time === null ? 'selected' : 'plain'} onPress={() => correct('time', null)} />,
                      ...timeOptions.map((option) => (
                        <Chip key={option} label={formatHour(option)} tone={option === time ? 'selected' : 'plain'} onPress={() => correct('time', option)} />
                      )),
                    ]
                  : null}
                {editing === 'commitment'
                  ? (['hard', 'soft', 'self'] as CommitmentKind[]).map((option) => (
                      <Chip key={option} label={COMMITMENT_LABEL[option]} tone={option === commitment ? 'selected' : 'plain'} onPress={() => correct('commitment', option)} />
                    ))
                  : null}
              </Stack>
            </Card>
          ) : null}
        </Stack>

        {/* When the parser has no idea it asks one question rather than guessing. */}
        {hoursUnknown ? (
          <Card gap={4}>
            <Text variant="heading">How long, roughly?</Text>
            <Stack direction="row" gap={3} wrap>
              {RANGES.map(([label, value]) => (
                <Chip key={label} label={label} onPress={() => correct('hours', value)} />
              ))}
            </Stack>
          </Card>
        ) : null}

        <Card gap={5}>
          <Text variant="heading">How much are you dreading it?</Text>
          <DreadPicker value={dread} onChange={(next) => correct('dread', next)} />
        </Card>

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
        <View className="h-2" />
      </Stack>
    </Screen>
  );
}

/** "Today" and "Tomorrow" read better than a date on the two days people mean. */
function offset0(date: string, today: string): string {
  if (date === today) return 'Today';
  if (date === addDays(today, 1)) return 'Tomorrow';
  return formatShort(date);
}
