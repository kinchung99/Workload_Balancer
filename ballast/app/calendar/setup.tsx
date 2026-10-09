import { useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Burst, Button, Card, Chip, DrainPicker, Screen, Stack, Sticker, Text } from '@/components';
import { color } from '@design/tokens';
import { KIND, KINDS, itemFrom, moduleFor, repeatOf, templateFor, whenOf } from '@/lib/gcal';
import { costLabel, drainCosts, withDrain } from '@/lib/drain';
import { addDays, formatShort } from '@/lib/dates';
import { COMMITMENT_LABEL } from '@/lib/load';
import { WANT_CHOICES } from '@/lib/swap';
import { successFeedback, tapFeedback } from '@/lib/haptics';
import type { CalTemplate, CommitmentKind, Dread } from '@/lib/types';
import { useStore } from '@/state/store';
import { useCalendar } from '@/features/calendar/useCalendar';
import { CalendarDot, KIND_STICKER, KIND_WASH } from '@/features/calendar/EventCard';

const PREP_OPTIONS = [2, 4, 6, 9, 12, 16, 20];
const FINISH: Array<[number, string]> = [[0, 'On the day'], [1, 'Day before'], [2, '2 days before'], [7, 'A week before']];
const IMPORTANCE: Array<[1 | 2 | 3, string]> = [[1, 'Nice to do'], [2, 'Normal'], [3, 'Really matters']];
const EMPTY = { mental: 0, time: 0, physical: 0, social: 0, errands: 0 };

/**
 * Setting up one calendar event - or every week of a repeating one.
 *
 * Add anything, with the calendar's half already done: the title, the day, the
 * time, the length and the room come from Google, and the kind is guessed from
 * the title. What is left is what only the student knows - how draining it is,
 * whether it can move, and for a deadline how much work it needs and by when.
 */
export default function CalendarSetup() {
  const router = useRouter();
  const { key, done: doneParam } = useLocalSearchParams<{ key?: string; done?: string }>();
  const done = Number(doneParam ?? 0) || 0;
  const { picture } = useCalendar();
  const { items, ceilings, modules, setUpCalendar, skipCalendar } = useStore();
  const detected = [...picture.fresh, ...picture.skipped].find((d) => d.key === key);
  const left = picture.fresh.filter((d) => d.key !== key);

  const [template, setTemplate] = useState<CalTemplate | null>(detected?.guess ?? null);
  const [celebrate, setCelebrate] = useState(false);

  const first = detected?.events[0] ?? detected?.first;
  const count = detected?.events.length ?? 0;

  /** Battery cost at each drain level, for the first week it lands in. */
  const costs = useMemo(() => {
    if (!template || !first) return null;
    return drainCosts(
      items,
      (level: Dread) => [itemFrom(first, { ...template, dread: level, mix: withDrain({ ...EMPTY, ...template.mix }, level, template.bucket) })],
      first.date,
      ceilings,
    );
  }, [template, first, items, ceilings]);

  if (!detected || !template || !first) {
    return (
      <Screen back={"/calendar" as Href} backLabel="Calendar">
        <Stack gap={4} align="center" className="pt-10">
          <Sticker name="star" size={64} wiggle />
          <Text variant="heading">Already set up</Text>
          <Button label="Back to your calendar" onPress={() => router.replace('/calendar' as Href)} />
        </Stack>
      </Screen>
    );
  }

  const update = (patch: Partial<CalTemplate>) => setTemplate((t) => (t ? { ...t, ...patch } : t));
  const pickKind = (kind: CalTemplate['kind']) => {
    tapFeedback();
    // A new kind is a new starting point; the title stays the student's.
    setTemplate(templateFor(kind, template.title, moduleFor(template.title, modules)));
  };
  const prep = template.prep;
  const cost = costs?.[template.dread] ?? 0;
  const next = () => {
    const after = left[0];
    router.replace((after ? `/calendar/setup?key=${encodeURIComponent(after.key)}&done=${done + 1}` : '/calendar') as Href);
  };

  const add = () => {
    setUpCalendar(detected.key, { ...template, title: template.title.trim() || detected.title }, detected.events.length ? detected.events : [detected.first]);
    successFeedback();
    setCelebrate(true);
    setTimeout(next, 650);
  };

  return (
    <Screen
      back={"/calendar" as Href}
      backLabel="Calendar"
      footer={
        <Stack direction="row" gap={3}>
          <Button label="Skip" kind="secondary" className="flex-1" onPress={() => { tapFeedback(); skipCalendar([detected.key]); next(); }} />
          <Button
            label={`${count > 1 ? `Add all ${count}` : 'Add it'} · 🔋 ${costLabel(cost)}`}
            className="flex-[2]"
            onPress={add}
          />
        </Stack>
      }
    >
      <Stack gap={5} className="pt-2">
        {/* Like stories: one bar per event, filled up to this one. */}
        {done + picture.fresh.length > 1 ? (
          <Stack direction="row" gap={1}>
            {Array.from({ length: done + picture.fresh.length }, (_, i) => (
              <View key={i} className="flex-1 rounded-pill" style={{ height: 4, backgroundColor: i <= done ? color.surface.inverse : color.line.hairline }} />
            ))}
          </Stack>
        ) : null}
        {celebrate ? <Burst show label="Added" /> : null}

        {/* The calendar's half: already done. */}
        <View className="flex-row overflow-hidden rounded-xl" style={{ borderWidth: 2, borderColor: color.line.hairline, backgroundColor: color.decor.cream }}>
          <View style={{ width: 6, backgroundColor: first.color ?? color.line.strong }} />
          <Stack gap={3} grow className="px-4 py-4">
            <Stack direction="row" gap={2} align="center">
              <CalendarDot tint={first.color} />
              <Text variant="micro" tone="subtle">FROM {first.calendar.toUpperCase()}</Text>
            </Stack>
            <TextInput
              value={template.title}
              onChangeText={(title) => update({ title })}
              accessibilityLabel="Title"
              className="text-title font-bold text-ink-default"
              style={{ padding: 0 }}
            />
            <Stack direction="row" gap={2} wrap>
              <Tag label={`🗓️ ${whenOf(first)}`} />
              {repeatOf(detected.repeat) ? <Tag label={`🔁 ${repeatOf(detected.repeat)}`} /> : null}
              {first.location ? <Tag label={`📍 ${first.location}`} /> : null}
            </Stack>
            <Text variant="micro" tone="steady" weight="bold">🔒 Time stays in step with Google</Text>
          </Stack>
        </View>

        {/* What it is: guessed, one tap to change. */}
        <Stack gap={3}>
          <Text variant="heading">What is it?</Text>
          <Stack direction="row" gap={2} wrap>
            {KINDS.map((kind) => {
              const on = template.kind === kind;
              return (
                <Pressable
                  key={kind}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={KIND[kind].label}
                  onPress={() => pickKind(kind)}
                  className="items-center gap-1 rounded-lg border-2 px-1 py-3 active:opacity-70"
                  style={{ width: '23%', borderColor: on ? color.surface.inverse : color.line.hairline, backgroundColor: on ? KIND_WASH[kind] : color.surface.raised }}
                >
                  <Sticker name={KIND_STICKER[kind]} size={30} wiggle={on} />
                  <Text variant="micro" weight="bold" numberOfLines={1}>{KIND[kind].label}</Text>
                  {kind === detected.guess.kind ? (
                    <View className="absolute rounded-pill px-1" style={{ top: 4, right: 4, backgroundColor: color.surface.raised }}>
                      <Text variant="micro">✨</Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </Stack>
        </Stack>

        {/* Work before the day: how much, by when, how much it matters. */}
        {prep ? (
          <Card gap={4}>
            <Stack direction="row" justify="between" align="center">
              <Text variant="heading">Hours of work</Text>
              <Text variant="heading" tone="recovery">{prep.hours}h</Text>
            </Stack>
            <Stack direction="row" gap={2} wrap>
              {PREP_OPTIONS.map((hours) => (
                <Chip key={hours} label={`${hours}h`} tone={hours === prep.hours ? 'selected' : 'plain'} onPress={() => { tapFeedback(); update({ prep: { ...prep, hours } }); }} />
              ))}
            </Stack>
            <Stack direction="row" justify="between" align="center">
              <Text variant="heading">Finish by</Text>
              <Text variant="heading" tone="recovery">{formatShort(addDays(first.date, -prep.daysBefore))}</Text>
            </Stack>
            <Stack direction="row" gap={2} wrap>
              {FINISH.map(([days, word]) => (
                <Chip key={days} label={word} tone={days === prep.daysBefore ? 'selected' : 'plain'} onPress={() => { tapFeedback(); update({ prep: { ...prep, daysBefore: days } }); }} />
              ))}
            </Stack>
            <Stack direction="row" gap={2} wrap>
              {IMPORTANCE.map(([value, word]) => (
                <Chip key={value} label={word} tone={value === prep.importance ? 'selected' : 'plain'} onPress={() => { tapFeedback(); update({ prep: { ...prep, importance: value } }); }} />
              ))}
            </Stack>
          </Card>
        ) : null}

        {/* The one thing a calendar can never know. */}
        <Card gap={4}>
          <DrainPicker
            question="How draining is it?"
            value={template.dread}
            onChange={(level) => update({ dread: level, mix: withDrain({ ...EMPTY, ...template.mix }, level, template.bucket) })}
            costs={costs ?? undefined}
            hours={prep ? prep.hours : first.allDay ? 1 : first.hours}
          />
        </Card>

        {!prep ? (
          <Card gap={4}>
            <Stack gap={3}>
              <Text variant="heading">Can it move?</Text>
              <Stack direction="row" gap={2} wrap>
                {(['hard', 'soft', 'self'] as CommitmentKind[]).map((option) => (
                  <Chip
                    key={option}
                    label={`${{ hard: '🔒', soft: '↔️', self: '🙋' }[option]} ${COMMITMENT_LABEL[option]}`}
                    tone={option === template.commitment ? 'selected' : 'plain'}
                    onPress={() => { tapFeedback(); update({ commitment: option }); }}
                  />
                ))}
              </Stack>
            </Stack>
            <Stack gap={3}>
              <Text variant="heading">Want to be there?</Text>
              <Stack direction="row" gap={2} wrap>
                {WANT_CHOICES.map(([value, word]) => (
                  <Chip key={value} label={word} tone={value === template.want ? 'selected' : 'plain'} onPress={() => { tapFeedback(); update({ want: value }); }} />
                ))}
              </Stack>
            </Stack>
          </Card>
        ) : null}

        <View className="h-2" />
      </Stack>
    </Screen>
  );
}

function Tag({ label }: { label: string }) {
  return (
    <View className="rounded-pill bg-raised px-3 py-1" style={{ borderWidth: 1, borderColor: color.line.hairline }}>
      <Text variant="micro" weight="bold" numberOfLines={1}>{label}</Text>
    </View>
  );
}
