/**
 * Building a timetable by tapping, not typing.
 *
 * Each module is a block. Open one and add its classes with buttons - which
 * days, what time, how long, what kind - and they stack up under it. Add the
 * next module and do the same, until the week is there. The one thing that has
 * to be typed is a module's name. A paste from the student portal is still on
 * offer, folded at the bottom, for anyone who has one to hand.
 */
import { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { Button, Chip, Disclosure, DrainPicker, Stack, Text } from '@/components';
import { color, radius } from '@design/tokens';
import { addDays, startOfWeek } from '@/lib/dates';
import { formatHour } from '@/lib/schedule';
import {
  MODULE_EMOJIS, SESSION_KINDS, moduleEmoji, modulesFrom, parseTimetable, slotsOf, toItems,
} from '@/lib/timetable';
import { successFeedback, tapFeedback } from '@/lib/haptics';
import { useStore } from '@/state/store';
import type { Dread, Module, SessionKind } from '@/lib/types';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const STARTS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
const LENGTHS = [1, 1.5, 2, 3];
const KIND_EMOJI: Record<SessionKind, string> = { lecture: '🎤', lab: '🧪', tutorial: '✏️', seminar: '💬' };
const REQUIRED = [null, 70, 80, 90] as const;

const SAMPLE = `Mon 09:00-11:00 CS2040 Operating Systems Lecture Kilburn LT1
Tue 14:00-16:00 CS2011 Algorithms Lab in Lab A`;

const inputStyle = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : undefined;
const hoursLabel = (hours: number) => (hours % 1 ? `${Math.floor(hours)}h 30m` : `${hours}h`);

export function ClassBuilder() {
  const { modules, items, today } = useStore();
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(modules.length === 0);

  return (
    <Stack gap={3}>
      {modules.map((module) => (
        <ModuleBlock
          key={module.id}
          module={module}
          classes={slotsOf(items, module.id, today)}
          open={open === module.id}
          onToggle={() => { tapFeedback(); setOpen(open === module.id ? null : module.id); }}
        />
      ))}

      {adding ? (
        <NewModule
          onCancel={modules.length ? () => setAdding(false) : undefined}
          onMade={(id) => { setAdding(false); setOpen(id); }}
        />
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add a module"
          onPress={() => { tapFeedback(); setAdding(true); setOpen(null); }}
          className="min-h-row flex-row items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line-strong bg-raised px-4 py-4 active:opacity-70"
        >
          <Text variant="heading">＋</Text>
          <Text variant="callout" weight="bold">Add a module</Text>
        </Pressable>
      )}

      <Disclosure lead="📋" title="Paste from your portal" summary="Replace everything with a pasted timetable">
        <PasteImport />
      </Disclosure>
    </Stack>
  );
}

/* ------------------------------------------------------------- one module */

function ModuleBlock({ module, classes, open, onToggle }: {
  module: Module;
  classes: ReturnType<typeof slotsOf>;
  open: boolean;
  onToggle: () => void;
}) {
  const { addClass, removeClass, removeModule } = useStore();
  // One day per class: a Monday lecture and a Thursday one are two classes, each with its own time.
  const [day, setDay] = useState<number | null>(null);
  const [start, setStart] = useState(9);
  const [hours, setHours] = useState(2);
  const [kind, setKind] = useState<SessionKind>('lecture');
  const [room, setRoom] = useState('');

  const add = () => {
    if (day === null) return;
    addClass(module.id, { day, startHour: start, hours, kind, room });
    successFeedback();
    setDay(null);
    setRoom('');
  };

  return (
    <View className={`overflow-hidden rounded-xl border-2 bg-raised ${open ? 'border-inverse' : 'border-line-hairline'}`}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${module.name}, ${classes.length} classes a week`}
        onPress={onToggle}
        className="min-h-row flex-row items-center gap-3 px-4 py-3 active:opacity-70"
      >
        <View className="items-center justify-center rounded-pill bg-sunken" style={{ width: 44, height: 44 }}>
          <Text variant="heading">{moduleEmoji(module)}</Text>
        </View>
        <Stack gap={0} grow>
          <Text variant="micro" tone="subtle">{module.code}</Text>
          <Text variant="body" weight="semibold" numberOfLines={1}>{module.name}</Text>
        </Stack>
        <View className={`rounded-pill px-3 py-1 ${classes.length ? 'bg-steady-wash' : 'bg-busy-wash'}`}>
          <Text variant="micro" weight="bold" tone={classes.length ? 'steady' : 'busy'}>
            {classes.length ? `${classes.length} a week` : 'No classes yet'}
          </Text>
        </View>
        <Text variant="heading" tone="subtle">{open ? '⌃' : '⌄'}</Text>
      </Pressable>

      {open ? (
        <Stack gap={4} className="border-t border-line-hairline px-4 pb-4 pt-3">
          {/* What it has so far, stacked. */}
          {classes.length ? (
            <Stack gap={2}>
              {classes.map((slot) => (
                <Stack key={`${slot.day}-${slot.startHour}`} direction="row" gap={3} align="center" className="rounded-lg bg-sunken py-2 pl-3 pr-2">
                  <Text variant="callout">{KIND_EMOJI[slot.kind]}</Text>
                  <Stack gap={0} grow>
                    <Text variant="callout" weight="semibold">{DAYS[slot.day]} · {formatHour(slot.startHour)}–{formatHour(slot.startHour + slot.hours)}</Text>
                    <Text variant="micro" tone="subtle">{slot.kind}{slot.room ? ` · ${slot.room}` : ''}</Text>
                  </Stack>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${DAYS[slot.day]} ${formatHour(slot.startHour)}`}
                    onPress={() => { tapFeedback(); removeClass(module.id, slot.day, slot.startHour); }}
                    className="items-center justify-center rounded-pill bg-raised active:opacity-60"
                    style={{ width: 32, height: 32 }}
                  >
                    <Text variant="caption" tone="muted">✕</Text>
                  </Pressable>
                </Stack>
              ))}
            </Stack>
          ) : null}

          {/* The next class, all buttons. */}
          <Stack gap={3} className="rounded-lg border border-line-hairline px-3 py-3">
            <Text variant="callout" weight="bold">＋ Add a class</Text>
            {/* Three different questions, three different looks: day tiles, time pills, length blocks. */}
            <Label emoji="📅" text="DAY" />
            <Stack direction="row" gap={1}>
              {DAYS.map((_, index) => {
                const on = day === index;
                return (
                  <Pressable
                    key={index}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={DAYS[index]}
                    onPress={() => { tapFeedback(); setDay(on ? null : index); }}
                    className={`min-h-min flex-1 items-center justify-center rounded-md py-3 active:opacity-70 ${on ? 'bg-inverse' : 'bg-sunken'}`}
                  >
                    <Text variant="caption" weight="bold" tone={on ? 'inverse' : 'default'}>{DAYS[index]}</Text>
                  </Pressable>
                );
              })}
            </Stack>

            <Label emoji="🕒" text="STARTS AT" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {STARTS.map((hour) => {
                const on = hour === start;
                return (
                  <Pressable
                    key={hour}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={`Starts ${formatHour(hour)}`}
                    onPress={() => { tapFeedback(); setStart(hour); }}
                    className="min-h-min items-center justify-center rounded-pill px-4 active:opacity-70"
                    style={{ backgroundColor: on ? color.band.recovery.fill : color.band.recovery.wash, borderWidth: 1.5, borderColor: on ? color.band.recovery.ink : color.band.recovery.wash }}
                  >
                    <Text variant="caption" weight="bold" tone={on ? 'inverse' : 'recovery'}>{formatHour(hour)}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Label emoji="⏱" text="LASTS" />
            <Stack direction="row" gap={2}>
              {LENGTHS.map((length) => {
                const on = length === hours;
                return (
                  <Pressable
                    key={length}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={`Lasts ${hoursLabel(length)}`}
                    onPress={() => { tapFeedback(); setHours(length); }}
                    className="min-h-min flex-1 items-center justify-center gap-1 rounded-md py-2 active:opacity-70"
                    style={{ backgroundColor: on ? color.band.steady.wash : color.surface.sunken, borderWidth: 2, borderColor: on ? color.band.steady.fill : 'transparent' }}
                  >
                    {/* A bar as long as the class, so a length reads as a length. */}
                    <View style={{ height: 6, width: `${(length / 3) * 80}%`, borderRadius: radius.pill, backgroundColor: on ? color.band.steady.fill : color.line.strong }} />
                    <Text variant="caption" weight="bold" tone={on ? 'steady' : 'muted'}>{hoursLabel(length)}</Text>
                  </Pressable>
                );
              })}
            </Stack>

            <Label emoji="🏷" text="KIND" />
            <Stack direction="row" gap={2} wrap>
              {SESSION_KINDS.map((option) => (
                <Chip
                  key={option}
                  label={`${KIND_EMOJI[option]} ${option[0].toUpperCase()}${option.slice(1)}`}
                  tone={option === kind ? 'selected' : 'plain'}
                  onPress={() => { tapFeedback(); setKind(option); }}
                />
              ))}
            </Stack>
            <TextInput
              value={room}
              onChangeText={setRoom}
              placeholder="Room (optional)"
              placeholderTextColor={color.ink.subtle}
              accessibilityLabel="Room"
              className="min-h-min rounded-pill bg-sunken px-4 py-2 text-callout text-ink-default"
              style={inputStyle}
            />
            <Button
              label={day !== null
                ? `Add ${DAYS[day]} · ${formatHour(start)}–${formatHour(start + hours)}`
                : 'Pick a day first'}
              kind={day !== null ? 'primary' : 'secondary'}
              onPress={add}
            />
          </Stack>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove ${module.name}`}
            onPress={() => { tapFeedback(); removeModule(module.id); }}
            className="min-h-min items-center justify-center self-center px-3 py-1 active:opacity-60"
          >
            <Text variant="caption" tone="subtle" className="underline">Remove this module</Text>
          </Pressable>
        </Stack>
      ) : null}
    </View>
  );
}

/* -------------------------------------------------------------- new module */

function NewModule({ onMade, onCancel }: { onMade: (id: string) => void; onCancel?: () => void }) {
  const { addModule, today } = useStore();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [emoji, setEmoji] = useState(MODULE_EMOJIS[0]);
  const [weeks, setWeeks] = useState(12);
  const [weekNow, setWeekNow] = useState(1);
  const [required, setRequired] = useState<number | null>(null);
  const [dread, setDread] = useState<Dread>(2);

  const make = () => {
    if (!name.trim()) return;
    const id = addModule({
      name, code, emoji, weeks, requiredAttendance: required, dread,
      startDate: addDays(startOfWeek(today), -(weekNow - 1) * 7),
    });
    successFeedback();
    onMade(id);
  };

  return (
    <Stack gap={3} className="rounded-xl border-2 border-inverse bg-raised px-4 py-4">
      <Text variant="heading">New module</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {MODULE_EMOJIS.map((option) => (
          <Pressable
            key={option}
            accessibilityRole="radio"
            accessibilityState={{ selected: option === emoji }}
            accessibilityLabel={`Picture ${option}`}
            onPress={() => { tapFeedback(); setEmoji(option); }}
            className="items-center justify-center rounded-pill active:opacity-60"
            style={{
              width: 42, height: 42, borderRadius: radius.pill,
              backgroundColor: option === emoji ? color.decor.lemon : color.surface.sunken,
              borderWidth: option === emoji ? 2 : 0, borderColor: color.ink.default,
            }}
          >
            <Text variant="heading">{option}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Module name"
        placeholderTextColor={color.ink.subtle}
        accessibilityLabel="Module name"
        className="min-h-row rounded-pill border-2 border-line-hairline bg-sunken px-5 py-3 text-body text-ink-default"
        style={inputStyle}
      />
      <TextInput
        value={code}
        onChangeText={setCode}
        placeholder="Code (optional)"
        placeholderTextColor={color.ink.subtle}
        autoCapitalize="characters"
        accessibilityLabel="Module code"
        className="min-h-min rounded-pill bg-sunken px-5 py-2 text-callout text-ink-default"
        style={inputStyle}
      />
      <Stepper label="Runs for" value={`${weeks} weeks`} onLess={() => setWeeks(Math.max(1, weeks - 1))} onMore={() => setWeeks(Math.min(30, weeks + 1))} />
      <Stepper label="Week now" value={`Week ${weekNow}`} onLess={() => setWeekNow(Math.max(1, weekNow - 1))} onMore={() => setWeekNow(Math.min(weeks, weekNow + 1))} />
      <Stack gap={2}>
        <Text variant="micro" tone="subtle">ATTENDANCE NEEDED</Text>
        <Stack direction="row" gap={2}>
          {REQUIRED.map((value) => (
            <Chip
              key={String(value)}
              label={value === null ? 'None' : `${value}%`}
              tone={required === value ? 'selected' : 'plain'}
              onPress={() => { tapFeedback(); setRequired(value); }}
            />
          ))}
        </Stack>
      </Stack>
      {/* Sets the drain on every class in it - what the priority list runs on. */}
      <Stack gap={2}>
        <Text variant="micro" tone="subtle">HOW DRAINING</Text>
        <DrainPicker compact value={dread} onChange={setDread} />
      </Stack>
      <Stack direction="row" gap={2}>
        {onCancel ? <Button label="Cancel" kind="quiet" className="flex-1" onPress={onCancel} /> : null}
        <Button
          label={name.trim() ? 'Add module' : 'Name it first'}
          kind={name.trim() ? 'primary' : 'secondary'}
          className="flex-[2]"
          onPress={make}
        />
      </Stack>
    </Stack>
  );
}

function Label({ emoji, text }: { emoji: string; text: string }) {
  return <Text variant="micro" tone="subtle">{emoji} {text}</Text>;
}

function Stepper({ label, value, onLess, onMore }: { label: string; value: string; onLess: () => void; onMore: () => void }) {
  const nudge = (sign: '−' | '+', press: () => void) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${sign === '+' ? 'more' : 'less'}`}
      onPress={() => { tapFeedback(); press(); }}
      className="items-center justify-center rounded-pill border border-line-strong bg-raised active:opacity-60"
      style={{ width: 32, height: 32 }}
    >
      <Text variant="callout" weight="bold">{sign}</Text>
    </Pressable>
  );
  return (
    <Stack direction="row" align="center" gap={2}>
      <Text variant="callout" weight="semibold" className="flex-1">{label}</Text>
      {nudge('−', onLess)}
      <Text variant="callout" weight="bold" className="text-center" style={{ minWidth: 70 }}>{value}</Text>
      {nudge('+', onMore)}
    </Stack>
  );
}

/* ------------------------------------------------------------------- paste */

function PasteImport() {
  const { today, importTimetable } = useStore();
  const [paste, setPaste] = useState('');
  const preview = useMemo(() => (paste.trim() ? parseTimetable(paste) : null), [paste]);
  const importing = useMemo(() => (preview?.classes.length ? toItems(preview.classes, today, 2) : []), [preview, today]);
  const found = useMemo(() => modulesFrom(importing, {}, {}, startOfWeek(today)), [importing, today]);

  return (
    <Stack gap={3}>
      <TextInput
        value={paste}
        onChangeText={setPaste}
        multiline
        placeholder={SAMPLE}
        placeholderTextColor={color.ink.subtle}
        accessibilityLabel="Paste your timetable"
        className="rounded-lg bg-sunken px-4 py-3 text-footnote text-ink-default"
        style={[{ minHeight: 110 }, inputStyle as object]}
      />
      {preview ? (
        <Stack gap={2}>
          <Text variant="micro" tone="subtle">
            {preview.classes.length} CLASSES · {found.length} MODULES{preview.skipped.length ? ` · ${preview.skipped.length} NOT READ` : ''}
          </Text>
          {preview.classes.length ? (
            <Button
              label={`Replace my timetable with these ${preview.classes.length}`}
              onPress={() => { importTimetable(importing, found); successFeedback(); setPaste(''); }}
            />
          ) : null}
        </Stack>
      ) : (
        <Text variant="micro" tone="subtle">One class per line.</Text>
      )}
    </Stack>
  );
}
