import { useEffect, useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  AreaDial, AreaIcon, Battery, Burst, Button, Card, Chip, DatePicker, Reveal,
  Screen, Stack, StepDots, Sticker, Text, type StickerName,
} from '@/components';
import { color } from '@design/tokens';
import { parse, titleFrom } from '@/lib/parser';
import {
  BAND_LABEL, BUCKET_LABEL, COMMITMENT_LABEL,
  bandFor, describeMix, dominantArea, dreadFromMix, loadOf, mixShares,
} from '@/lib/load';
import { addDays, formatShort } from '@/lib/dates';
import { formatHour, startOptions } from '@/lib/schedule';
import { successFeedback, tapFeedback } from '@/lib/haptics';
import type { BucketKey, CommitmentKind, Item, Mix } from '@/lib/types';
import { useStore } from '@/state/store';
import { categorise } from '@/lib/errands';
import { WANT_CHOICES } from '@/lib/swap';
import { readingFrom, useItemsWithLogs, useReading } from '@/state/selectors';

const HOUR_OPTIONS = [0.5, 1, 2, 3, 4, 6, 8];
const PREP_OPTIONS = [2, 4, 6, 9, 12, 16, 20, 30];
const PREP_STEP = 2;
const STEPS = ['What', 'How big', 'What it takes', 'When'];

/** The four pages, as URL segments. `/add/takes` opens straight on the dials. */
export const STEP_SLUGS = ['what', 'size', 'takes', 'when'] as const;
const IMPORTANCE: Array<[1 | 2 | 3, string]> = [[1, 'Nice to do'], [2, 'Normal'], [3, 'Really matters']];
const EMPTY_MIX: Record<BucketKey, number> = { mental: 0, time: 0, physical: 0, social: 0, errands: 0 };

/**
 * One thing people often start with, with the answers already in it.
 *
 * Not templates so much as a running start: every value they set is still on a
 * page you are about to walk through, so the shortcut never hides a decision.
 */
const QUICK: Array<{
  sticker: StickerName; label: string; text: string;
  mix: Mix; hours: number; prep: boolean;
}> = [
  { sticker: 'assignment', label: 'Assignment', text: 'Assignment', mix: { mental: 4, time: 3 }, hours: 6, prep: true },
  { sticker: 'class', label: 'Class', text: 'Lecture', mix: { mental: 2, time: 2 }, hours: 2, prep: false },
  { sticker: 'shift', label: 'Shift', text: 'Shift at work', mix: { time: 4, physical: 3, social: 2 }, hours: 6, prep: false },
  { sticker: 'move', label: 'Exercise', text: 'Gym session', mix: { physical: 3 }, hours: 1, prep: false },
  { sticker: 'people', label: 'See people', text: 'Seeing friends', mix: { social: 3, time: 2 }, hours: 3, prep: false },
  { sticker: 'chore', label: 'Chore', text: 'Laundry', mix: { errands: 2, time: 1 }, hours: 1, prep: false },
];

/** One drawing, one question and one colour per page. */
const ART: Record<number, { sticker: StickerName; title: string; sub: string; wash: string }> = {
  0: { sticker: 'wave', title: "What's on?", sub: "However you'd say it out loud.", wash: color.decor.lemon },
  1: { sticker: 'clock', title: 'How big is it?', sub: 'Turn up, or work first?', wash: color.decor.sky },
  2: { sticker: 'sparkle', title: 'What does it take?', sub: 'Drag the faces. Five parts of you.', wash: color.decor.candy },
  3: { sticker: 'calendar', title: 'When?', sub: 'Pick a day. A time if you know it.', wash: color.decor.mint },
};

/**
 * The dials, in the order a person thinks about themselves - head, hours, body,
 * people, admin. BUCKETS keeps its own order because the readings elsewhere are
 * built on it; this is presentation.
 */
const DIAL_ORDER: BucketKey[] = ['mental', 'time', 'physical', 'social', 'errands'];

/**
 * Screen 2 — capture, as four short pages instead of one long form.
 *
 * Two changes carry this screen. The first is shape: everything used to be on
 * one scroll, which sounds efficient and reads as homework, because you cannot
 * answer the first question without seeing the other six waiting. Four pages ask
 * one thing each and say how many are left.
 *
 * The second is the model. A task used to land in ONE of the five areas, which
 * is the assumption that lets a week read sixty percent while the person is
 * finished — a group presentation is not "mental", it is mental and time and a
 * social cost nobody would have thought to name. Page three asks all five, with
 * a face on each, and the load lands in the proportions you give.
 */
export function Capture({ initialStep = 0 }: { initialStep?: number }) {
  const router = useRouter();
  // Prefilled when you arrive from a gap in a day: "add something here" should
  // mean here, not "somewhere on Tuesday".
  const params = useLocalSearchParams<{ date?: string; start?: string }>();
  const { today, ceilings, addItem, addErrand } = useStore();
  const scheduleItems = useItemsWithLogs();
  const reading = useReading();

  const [step, setStep] = useState(initialStep);
  const [text, setText] = useState('');
  const [celebrate, setCelebrate] = useState(false);

  // What the sentence suggests, until the student says otherwise.
  const parsed = useMemo(() => parse(text, today), [text, today]);

  const [mix, setMix] = useState<Record<BucketKey, number>>(EMPTY_MIX);
  const [mixTouched, setMixTouched] = useState(false);
  const [needsPrep, setNeedsPrep] = useState(false);
  const [hours, setHours] = useState<number | null>(null);
  const [prepHours, setPrepHours] = useState(4);
  const [importance, setImportance] = useState<1 | 2 | 3>(2);
  const [commitment, setCommitment] = useState<CommitmentKind | null>(null);
  const [date, setDate] = useState<string | null>(params.date ?? null);
  const [time, setTime] = useState<number | null>(params.start ? Number(params.start) : null);
  const [deadline, setDeadline] = useState<string | null>(null);
  /**
   * The one thing the app cannot work out for itself.
   *
   * Everything else a swap needs is already here or derivable - hours, dread,
   * whether it can move, and for a class whether the attendance arithmetic says
   * you can afford to miss it. Whether you *want* to be there is not in any of
   * that, so it is asked once, in three words, and never asked again.
   */
  const [want, setWant] = useState<Item['want']>(3);

  /**
   * The parser's guess, as a mix: everything it found, in the one area it
   * picked. Seeded into state rather than layered over it, so there is exactly
   * one copy of the answer. Deriving `liveMix` as `touched ? mix : guess` meant
   * the dial's callback could write a value computed from the *guess* back into
   * `mix`, which is half of why dragging one dial cleared the others.
   */
  useEffect(() => {
    if (!mixTouched) setMix({ ...EMPTY_MIX, [parsed.bucket]: parsed.dread });
  }, [parsed.bucket, parsed.dread, mixTouched]);
  const liveMix = mix;

  const dread = dreadFromMix(liveMix);
  const bucket = dominantArea(liveMix, parsed.bucket);
  const shares = mixShares(liveMix);
  const spentHours = needsPrep ? prepHours : hours ?? parsed.hours;
  const load = loadOf({ hours: spentHours, dread });
  const due = deadline ?? parsed.date ?? addDays(today, 3);
  const day = date ?? parsed.date ?? today;
  const commit = commitment ?? parsed.commitment;
  const timeOptions = startOptions(scheduleItems, day, spentHours);
  const ready = text.trim().length > 0;
  const areasChosen = DIAL_ORDER.filter((key) => liveMix[key] > 0);

  /** What the week's battery becomes with this in it. Nothing is written yet. */
  const after = useMemo(() => {
    if (!ready) return null;
    const candidate: Item = {
      id: 'preview-add',
      title: titleFrom(text),
      bucket, hours: spentHours, dread, commitment: commit,
      date: needsPrep ? due : day,
      mix: liveMix, want,
      ...(time === null || needsPrep ? {} : { startHour: time }),
    };
    return readingFrom([...scheduleItems, candidate], today, ceilings);
  }, [ready, text, bucket, spentHours, dread, commit, needsPrep, due, day, liveMix, want, time, scheduleItems, today, ceilings]);

  /** The reading on show: with the new thing folded in once there is one. */
  const shown = after ?? reading;

  const setArea = (area: BucketKey, value: number) => {
    setMixTouched(true);
    // Functional: several drag events can land before React re-renders, and
    // each one must build on the last rather than on a stale copy.
    setMix((prev) => ({ ...prev, [area]: value }));
  };

  const go = (next: number) => { tapFeedback(); setStep(next); };

  const canAdvance = step === 0 ? ready : step === 2 ? areasChosen.length > 0 : true;

  const commitIt = () => {
    if (!ready) return;
    if (needsPrep) {
      addItem({
        title: titleFrom(text),
        bucket, dread, commitment: commit, date: day,
        hours: prepHours,
        deadline: due, prepHours, prepDone: 0, importance,
        mix: liveMix, want,
      });
    } else {
      // Something you only turn up to is the same kind of object as an errand,
      // so it goes in the one list rather than a parallel one.
      addErrand(
        titleFrom(text),
        categorise(text),
        spentHours,
        (Math.min(3, Math.max(1, Math.round(dread * 0.6))) as 1 | 2 | 3),
        { date: day, ...(time === null ? {} : { startHour: time }) },
        bucket,
        liveMix,
        want,
      );
    }
    successFeedback();
    setCelebrate(true);
    setTimeout(() => router.back(), 650);
  };

  const art = ART[step];

  return (
    <Screen
      back="/"
      backLabel="Home"
      footer={
        <Stack direction="row" gap={3}>
          {step > 0 ? (
            <Button label="Back" kind="secondary" onPress={() => go(step - 1)} className="flex-1" />
          ) : null}
          <Button
            label={
              step < 3
                ? step === 0 && !ready
                  ? 'Type something first'
                  : step === 2 && areasChosen.length === 0
                    ? 'Pick at least one'
                    : 'Next'
                : needsPrep
                  ? `Add it · due ${formatShort(due)}`
                  : `Add it · ${label(day, today)}${time === null ? '' : ` ${formatHour(time)}`}`
            }
            kind={canAdvance ? 'primary' : 'secondary'}
            accessibilityState={{ disabled: !canAdvance }}
            onPress={() => {
              if (!canAdvance) return;
              if (step < 3) go(step + 1);
              else commitIt();
            }}
            className="flex-[2]"
          />
        </Stack>
      }
    >
      <Stack gap={5} className="pt-2">
        <Stack direction="row" justify="between" align="center">
          <StepDots labels={STEPS} current={step} onJump={go} />
          <Pressable accessibilityRole="button" onPress={() => router.back()} className="min-h-min justify-center pl-4">
            <Text variant="caption" tone="subtle">Cancel</Text>
          </Pressable>
        </Stack>

        {/* One drawing, one question. The same shape on all four pages. */}
        <Stack direction="row" gap={4} align="center">
          <View
            className="items-center justify-center rounded-pill"
            style={{ width: 68, height: 68, backgroundColor: art.wash }}
          >
            <Sticker name={art.sticker} size={46} wiggle />
          </View>
          <Stack gap={1} grow>
            <Text variant="title" accessibilityRole="header">{art.title}</Text>
            <Text variant="footnote" tone="muted">{art.sub}</Text>
          </Stack>
        </Stack>

        {celebrate ? <Burst show label="Added" /> : null}

        {/* ---------------------------------------------------------------- */}
        {step === 0 ? (
          <Stack gap={5}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Networks lab report, Thursday…"
              placeholderTextColor={color.ink.subtle}
              multiline
              autoFocus
              accessibilityLabel="What is it"
              className="min-h-row rounded-lg border-2 border-line-strong bg-decor-cream px-5 py-4 text-body text-ink-default"
            />

            <Stack gap={3}>
              <Text variant="micro" tone="subtle">OR START FROM ONE OF THESE</Text>
              <Stack direction="row" gap={3} wrap>
                {QUICK.map((pick) => {
                  const picked = text === pick.text;
                  return (
                    <Pressable
                      key={pick.label}
                      accessibilityRole="button"
                      accessibilityLabel={pick.label}
                      onPress={() => {
                        tapFeedback();
                        setText(pick.text);
                        setMix({ ...EMPTY_MIX, ...pick.mix });
                        setMixTouched(true);
                        setHours(pick.hours);
                        setPrepHours(pick.hours);
                        setNeedsPrep(pick.prep);
                      }}
                      className={`min-h-row grow items-center gap-2 rounded-md border-2 p-4 active:opacity-70 ${
                        picked ? 'border-inverse bg-decor-cream' : 'border-line-hairline bg-raised'
                      }`}
                      style={{ flexBasis: '28%' }}
                    >
                      <Sticker name={pick.sticker} size={38} />
                      <Text variant="caption" weight="semibold">{pick.label}</Text>
                    </Pressable>
                  );
                })}
              </Stack>
            </Stack>

            {ready ? (
              <Card tone="sunken" gap={2}>
                <Text variant="micro" tone="subtle">IT'LL BE CALLED</Text>
                <Text variant="heading">{titleFrom(text)}</Text>
                {parsed.dateLabel ? (
                  <Text variant="footnote" tone="muted">Heard a date in there: {parsed.dateLabel}</Text>
                ) : null}
              </Card>
            ) : null}
          </Stack>
        ) : null}

        {/* ---------------------------------------------------------------- */}
        {step === 1 ? (
          <Stack gap={5}>
            <Stack direction="row" gap={3}>
              {[
                { prep: false, sticker: 'clock' as StickerName, title: 'Just turn up', sub: 'An hour you attend' },
                { prep: true, sticker: 'assignment' as StickerName, title: 'Work first', sub: 'Hours before the day' },
              ].map((option) => (
                <Pressable
                  key={option.title}
                  accessibilityRole="button"
                  accessibilityState={{ selected: needsPrep === option.prep }}
                  accessibilityLabel={`${option.title}. ${option.sub}`}
                  onPress={() => { tapFeedback(); setNeedsPrep(option.prep); }}
                  className={`flex-1 items-center gap-3 rounded-lg border-2 p-5 active:opacity-70 ${
                    needsPrep === option.prep ? 'border-inverse bg-decor-cream' : 'border-line-hairline bg-raised'
                  }`}
                >
                  <Sticker name={option.sticker} size={46} wiggle={needsPrep === option.prep} />
                  <Stack gap={1} align="center">
                    <Text variant="body" weight="semibold" className="text-center">{option.title}</Text>
                    <Text variant="micro" tone="subtle" className="text-center">{option.sub}</Text>
                  </Stack>
                </Pressable>
              ))}
            </Stack>

            <Card gap={4}>
              <Stack direction="row" justify="between" align="center">
                <Text variant="heading">{needsPrep ? 'Hours of work' : 'How long'}</Text>
                <Text variant="heading" tone="recovery">{fmtHours(spentHours)}</Text>
              </Stack>
              <Stack direction="row" gap={2} wrap>
                {(needsPrep ? PREP_OPTIONS : HOUR_OPTIONS).map((option) => (
                  <Chip
                    key={option}
                    label={fmtHours(option)}
                    tone={option === spentHours ? 'selected' : 'plain'}
                    onPress={() => { tapFeedback(); needsPrep ? setPrepHours(option) : setHours(option); }}
                  />
                ))}
                {needsPrep ? (
                  <>
                    {/* No ceiling: a dissertation is not a twelve-hour job. */}
                    <Chip label="−" onPress={() => { tapFeedback(); setPrepHours((h) => Math.max(1, h - PREP_STEP)); }} accessibilityHint="Fewer hours" />
                    <Chip label="+" onPress={() => { tapFeedback(); setPrepHours((h) => h + PREP_STEP); }} accessibilityHint="More hours" />
                  </>
                ) : null}
              </Stack>
              {needsPrep && prepHours > 12 ? (
                <Text variant="footnote" tone="muted">
                  {Math.ceil(prepHours / 2)} sittings at two hours. Check the deadline gives you that many days.
                </Text>
              ) : null}
            </Card>

            {needsPrep ? (
              <Card gap={3}>
                <Text variant="heading">How much it matters</Text>
                <Stack direction="row" gap={2} wrap>
                  {IMPORTANCE.map(([value, text2]) => (
                    <Chip
                      key={value}
                      label={text2}
                      tone={value === importance ? 'selected' : 'plain'}
                      onPress={() => { tapFeedback(); setImportance(value); }}
                    />
                  ))}
                </Stack>
                <Text variant="footnote" tone="subtle">Decides what gets a slot first when the week is full.</Text>
              </Card>
            ) : null}

          </Stack>
        ) : null}

        {/* ---------------------------------------------------------------- */}
        {step === 2 ? (
          <Stack gap={4}>
            {/* The live consequence, pinned above the controls so every drag
                visibly does something. */}
            <Card tone={load === 0 ? 'sunken' : bandTone(after?.overall ?? 0)} gap={3}>
              <Stack direction="row" align="center" justify="between">
                <Stack gap={1}>
                  <Text variant="micro" tone="subtle">THIS ONE WEIGHS</Text>
                  <Text variant="display">{load}</Text>
                </Stack>
                <Stack gap={2} align="end">
                  <Text variant="caption" tone="muted">{fmtHours(spentHours)} × dread {dread}</Text>
                  {areasChosen.length > 1 ? (
                    <Text variant="footnote" weight="semibold">{describeMix(liveMix, bucket)}</Text>
                  ) : null}
                </Stack>
              </Stack>

              {shares ? (
                <Stack direction="row" gap={2} wrap>
                  {areasChosen.map((key) => (
                    <View key={key} className="flex-row items-center gap-2 rounded-pill px-3 py-2" style={{ backgroundColor: color.area[key].wash }}>
                      <AreaIcon area={key} size={15} />
                      <Text variant="micro">{BUCKET_LABEL[key]} {Math.round(load * shares[key] * 10) / 10}</Text>
                    </View>
                  ))}
                </Stack>
              ) : (
                <Text variant="footnote" tone="muted">Nothing set yet — drag at least one face.</Text>
              )}
            </Card>

            {DIAL_ORDER.map((area) => (
              <AreaDial key={area} area={area} value={liveMix[area]} onChange={(next) => setArea(area, next)} />
            ))}

          </Stack>
        ) : null}

        {/* ---------------------------------------------------------------- */}
        {step === 3 ? (
          <Stack gap={4}>
            {needsPrep ? (
              <Card gap={3}>
                <Stack direction="row" justify="between" align="center">
                  <Text variant="heading">Due by</Text>
                  <Text variant="heading" tone="recovery">{formatShort(due)}</Text>
                </Stack>
                <DatePicker value={due} min={addDays(today, 1)} onChange={setDeadline} />
                <Text variant="footnote" tone="subtle">
                  On every day's list until then, with the sittings plannable for you.
                </Text>
              </Card>
            ) : (
              <Card gap={4}>
                <Text variant="heading">Which day</Text>
                <Stack direction="row" gap={2} wrap>
                  {Array.from({ length: 7 }, (_, offset) => addDays(today, offset)).map((option) => (
                    <Chip
                      key={option}
                      label={label(option, today)}
                      tone={option === day ? 'selected' : 'plain'}
                      onPress={() => { tapFeedback(); setDate(option); setTime(null); }}
                    />
                  ))}
                </Stack>

                <Stack gap={2}>
                  <Text variant="micro" tone="subtle">
                    WHAT TIME · {timeOptions.length} FREE ON {label(day, today).toUpperCase()}
                  </Text>
                  <Stack direction="row" gap={2} wrap>
                    <Chip label="Anytime that day" tone={time === null ? 'selected' : 'plain'} onPress={() => { tapFeedback(); setTime(null); }} />
                    {timeOptions.map((option) => (
                      <Chip key={option} label={formatHour(option)} tone={option === time ? 'selected' : 'plain'} onPress={() => { tapFeedback(); setTime(option); }} />
                    ))}
                  </Stack>
                  {timeOptions.length === 0 ? (
                    <Text variant="footnote" tone="muted">
                      No gap on {label(day, today).toLowerCase()} is {fmtHours(spentHours)} long. Leave it anytime, or
                      make it work-first and have the sittings spread.
                    </Text>
                  ) : null}
                </Stack>
              </Card>
            )}

            <Card gap={5}>
              <Stack gap={3}>
                <Text variant="heading">Can it move?</Text>
                <Stack direction="row" gap={2} wrap>
                  {(['hard', 'soft', 'self'] as CommitmentKind[]).map((option) => (
                    <Chip
                      key={option}
                      label={COMMITMENT_LABEL[option]}
                      tone={option === commit ? 'selected' : 'plain'}
                      onPress={() => { tapFeedback(); setCommitment(option); }}
                    />
                  ))}
                </Stack>
              </Stack>

              {/* Asked next to "can it move" on purpose: together they are what
                  turns a full day into a decision instead of a list. */}
              <Stack gap={3}>
                <Text variant="heading">Want to be there?</Text>
                <Stack direction="row" gap={2} wrap>
                  {WANT_CHOICES.map(([value, word]) => (
                    <Chip
                      key={value}
                      label={word}
                      tone={value === want ? 'selected' : 'plain'}
                      onPress={() => { tapFeedback(); setWant(value); }}
                    />
                  ))}
                </Stack>
                <Text variant="footnote" tone="subtle">Lets the app swap things, not just drop them.</Text>
              </Stack>
            </Card>

            {/* What it does to you, before you commit to it. With nothing typed
                yet it still shows where the week stands, which is the context
                you would want while picking a day anyway. */}
            <Card tone={bandTone(shown.overall)} gap={4}>
              <Text variant="micro" tone="subtle">
                {after ? 'YOUR WEEK, WITH THIS IN IT' : 'YOUR WEEK RIGHT NOW'}
              </Text>
              <Stack direction="row" gap={5} align="center">
                <Battery
                  charge={shown.charge}
                  loadPercent={shown.overall}
                  label={after ? `${shown.charge} percent left with this added, was ${reading.charge}` : `${shown.charge} percent left`}
                  width={72}
                  height={108}
                />
                <Stack gap={2} grow>
                  <Text variant="display">{shown.charge}%</Text>
                  <Text variant="footnote" weight="semibold">
                    {!after
                      ? 'Before you add anything'
                      : reading.charge === after.charge
                        ? 'No change to the battery'
                        : `${after.charge - reading.charge}% from ${reading.charge}%`}
                  </Text>
                  <Text variant="footnote" tone="muted">{BAND_LABEL[bandFor(shown.overall)]} week</Text>
                </Stack>
              </Stack>
              {after ? (
                <Stack direction="row" gap={2} wrap>
                  {areasChosen.map((key) => (
                    <View key={key} className="flex-row items-center gap-2 rounded-pill px-3 py-2" style={{ backgroundColor: color.area[key].wash }}>
                      <AreaIcon area={key} size={15} />
                      <Text variant="micro">{BUCKET_LABEL[key]} {after.percents[key]}%</Text>
                    </View>
                  ))}
                </Stack>
              ) : null}
            </Card>
          </Stack>
        ) : null}

        <View className="h-2" />
      </Stack>
    </Screen>
  );
}

/** "Today" and "Tomorrow" read better than a date on the two days people mean. */
function label(date: string, today: string): string {
  if (date === today) return 'Today';
  if (date === addDays(today, 1)) return 'Tomorrow';
  return formatShort(date);
}

const fmtHours = (h: number): string => (h < 1 ? `${Math.round(h * 60)}m` : `${h}h`);

const bandTone = (percent: number) => bandFor(percent);
