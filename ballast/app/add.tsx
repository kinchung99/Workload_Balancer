import { useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Button, Card, Chip, DatePicker, Divider, DreadPicker, Screen, Stack, Text,
} from '@/components';
import { color } from '@design/tokens';
import { parse, titleFrom } from '@/lib/parser';
import { BUCKETS, BUCKET_LABEL, COMMITMENT_LABEL, loadOf } from '@/lib/load';
import { addDays, formatShort } from '@/lib/dates';
import { formatHour, startOptions } from '@/lib/schedule';
import { successFeedback, tapFeedback } from '@/lib/haptics';
import type { BucketKey, CommitmentKind, Dread } from '@/lib/types';
import { useStore } from '@/state/store';
import { categorise } from '@/lib/errands';
import { useItemsWithLogs } from '@/state/selectors';

const PLACEHOLDER = 'OS assignment due thurs, about 8 hours, really not looking forward to it';
const HOUR_OPTIONS = [0.5, 1, 2, 4, 8];
const PREP_OPTIONS = [2, 4, 6, 9, 12, 16, 20, 30];
const PREP_STEP = 2;
const IMPORTANCE: Array<[1 | 2 | 3, string]> = [[1, 'Nice to do'], [2, 'Normal'], [3, 'Really matters']];
const RANGES: Array<[string, number]> = [['Under an hour', 0.5], ['An hour or two', 1.5], ['Half a day', 4], ['A full day', 8]];

type Field = 'bucket' | 'hours' | 'commitment';

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
  const { today, items, addItem, addErrand } = useStore();
  const scheduleItems = useItemsWithLogs();

  const [text, setText] = useState('');
  const [editing, setEditing] = useState<Field | null>(null);
  const [override, setOverride] = useState<Partial<Record<Field | 'dread' | 'date' | 'time', unknown>>>(() => ({
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

  const correct = (field: Field | 'dread' | 'date' | 'time', value: unknown) => {
    tapFeedback();
    setOverride((prev) => ({ ...prev, [field]: value }));
    if (field !== 'dread' && field !== 'time') setEditing(null);
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

  // Two different shapes of thing. An interview is an hour you turn up to; an
  // assignment is nine hours spread across the days before it. Treating them the
  // same is why a to-do list looks empty until the night it ruins.
  const [needsPrep, setNeedsPrep] = useState(false);
  const [prepHours, setPrepHours] = useState(4);
  const [importance, setImportance] = useState<1 | 2 | 3>(2);
  const [deadline, setDeadline] = useState<string | null>(null);
  const due = deadline ?? date;
  const hoursUnknown = parsed.unknown.includes('hours') && text.length > 0 && override.hours === undefined;

  return (
    <Screen
      back="/"
      backLabel="Home"
      footer={
        <Button
          label={
            !ready
              ? 'Type something first'
              : needsPrep
                ? `Add ${prepHours}h of work, due ${formatShort(due)}`
                : `Add to ${offset0(date, today).toLowerCase()}${time === null ? '' : ` at ${formatHour(time)}`}`
          }
          kind={ready ? 'primary' : 'secondary'}
          accessibilityState={{ disabled: !ready }}
          onPress={() => {
            if (!ready) return;
            if (needsPrep) {
              addItem({
                title: titleFrom(text),
                bucket, dread, commitment, date,
                hours: prepHours,
                deadline: due, prepHours, prepDone: 0, importance,
              });
            } else {
              // Something you only have to turn up to is the same kind of object
              // as an errand, so it goes in the one list rather than a parallel
              // one - and therefore shows both on its day and under Errands.
              addErrand(
                titleFrom(text),
                categorise(text),
                hours,
                (Math.min(3, Math.max(1, Math.round(dread * 0.6))) as 1 | 2 | 3),
                { date, ...(time === null ? {} : { startHour: time }) },
                bucket,
              );
            }
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
            <Chip label={`Dread ${dread}`} tone="guess" readOnly />
            <Chip label={`Load ${load}`} readOnly />
            <Chip
              label={COMMITMENT_LABEL[commitment]}
              tone={editing === 'commitment' ? 'selected' : 'plain'}
              onPress={() => toggle('commitment')}
              accessibilityHint="Change the commitment type"
            />
          </Stack>

          {/* The correction panel. One tap to open, one tap to fix, and it closes. */}
          {editing ? (
            <Card tone="sunken" gap={3}>
              <Text variant="micro" tone="subtle">
                {editing === 'bucket' ? 'WHICH AREA' : editing === 'hours' ? 'HOW LONG' : 'WHAT KIND'}
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

                {editing === 'commitment'
                  ? (['hard', 'soft', 'self'] as CommitmentKind[]).map((option) => (
                      <Chip key={option} label={COMMITMENT_LABEL[option]} tone={option === commitment ? 'selected' : 'plain'} onPress={() => correct('commitment', option)} />
                    ))
                  : null}
              </Stack>
            </Card>
          ) : null}
        </Stack>

        {/* Which day, always in view. Adding to a day that is not today is the
            normal case, not a hidden option behind a chip. */}
        {!needsPrep ? (
          <Card gap={4}>
            <Stack gap={2}>
              <Text variant="heading">Which day?</Text>
              <Text variant="footnote" tone="muted">
                It lands in that day's anytime list. Give it a time as well if you know when.
              </Text>
            </Stack>

            <Stack direction="row" gap={2} wrap>
              {Array.from({ length: 7 }, (_, offset) => addDays(today, offset)).map((option) => (
                <Chip
                  key={option}
                  label={offset0(option, today)}
                  tone={option === date ? 'selected' : 'plain'}
                  onPress={() => {
                    tapFeedback();
                    // A new day means the old time may not be free on it.
                    setOverride((prev) => ({ ...prev, date: option, time: null }));
                  }}
                />
              ))}
            </Stack>

            <Stack gap={2}>
              <Text variant="micro" tone="subtle">
                WHAT TIME ON {offset0(date, today).toUpperCase()} · {timeOptions.length} FREE
              </Text>
              <Stack direction="row" gap={2} wrap>
                <Chip
                  label="Anytime that day"
                  tone={time === null ? 'selected' : 'plain'}
                  onPress={() => correct('time', null)}
                />
                {timeOptions.map((option) => (
                  <Chip
                    key={option}
                    label={formatHour(option)}
                    tone={option === time ? 'selected' : 'plain'}
                    onPress={() => correct('time', option)}
                  />
                ))}
              </Stack>
              {/* "0 free" on its own reads as a fault. Say which of the two it is. */}
              {timeOptions.length === 0 ? (
                <Text variant="footnote" tone="muted">
                  No gap on {offset0(date, today).toLowerCase()} is {hours} hours long. Leave it anytime, shorten
                  it, or mark it as needing preparation and have the sittings planned across several days.
                </Text>
              ) : null}
            </Stack>
          </Card>
        ) : null}

        {/* Does it need doing before, or only attending? */}
        <Card gap={4}>
          <Stack gap={2}>
            <Text variant="heading">Does it need work beforehand?</Text>
            <Text variant="footnote" tone="muted">
              An interview is an hour you turn up to. An assignment is hours spread across the days before it.
            </Text>
            <Text variant="footnote" tone="subtle">
              Things you just turn up to join your tasks and errands list, and show on the day you pick.
            </Text>
          </Stack>
          <Stack direction="row" gap={3} wrap>
            <Chip
              label="Just turn up or do it"
              tone={!needsPrep ? 'selected' : 'plain'}
              onPress={() => { tapFeedback(); setNeedsPrep(false); }}
            />
            <Chip
              label="Needs preparation"
              tone={needsPrep ? 'selected' : 'plain'}
              onPress={() => { tapFeedback(); setNeedsPrep(true); }}
            />
          </Stack>

          {needsPrep ? (
            <Stack gap={4}>
              <Stack gap={2}>
                <Text variant="micro" tone="subtle">HOURS OF PREPARATION · {prepHours}h</Text>
                <Stack direction="row" gap={2} wrap>
                  {PREP_OPTIONS.map((option) => (
                    <Chip
                      key={option}
                      label={`${option}h`}
                      tone={option === prepHours ? 'selected' : 'plain'}
                      onPress={() => { tapFeedback(); setPrepHours(option); }}
                    />
                  ))}
                  {/* No ceiling: a dissertation is not a twelve-hour job. */}
                  <Chip
                    label="−"
                    onPress={() => { tapFeedback(); setPrepHours((h) => Math.max(1, h - PREP_STEP)); }}
                    accessibilityHint="Fewer hours"
                  />
                  <Chip
                    label="+"
                    onPress={() => { tapFeedback(); setPrepHours((h) => h + PREP_STEP); }}
                    accessibilityHint="More hours"
                  />
                </Stack>
                {prepHours > 12 ? (
                  <Text variant="footnote" tone="muted">
                    {prepHours}h is {Math.ceil(prepHours / 2)} sittings at two hours each. Worth checking the
                    deadline gives you that many days.
                  </Text>
                ) : null}
              </Stack>

              <Stack gap={2}>
                <Text variant="micro" tone="subtle">DUE BY · {formatShort(due)}</Text>
                <DatePicker value={due} min={addDays(today, 1)} onChange={setDeadline} />
              </Stack>

              <Stack gap={2}>
                <Text variant="micro" tone="subtle">HOW MUCH IT MATTERS</Text>
                <Stack direction="row" gap={2} wrap>
                  {IMPORTANCE.map(([value, label]) => (
                    <Chip
                      key={value}
                      label={label}
                      tone={value === importance ? 'selected' : 'plain'}
                      onPress={() => { tapFeedback(); setImportance(value); }}
                    />
                  ))}
                </Stack>
              </Stack>

              <Text variant="footnote" tone="muted">
                It will sit on every day's list until {formatShort(due)}, showing how much is left, and you can
                have the sittings planned for you.
              </Text>
            </Stack>
          ) : null}
        </Card>

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
