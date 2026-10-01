import { useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Button, Card, Chip, Screen, Sticker, Stack, Text,
  PageHeader, StepDots,
} from '@/components';
import { SCREEN } from '@design/screens';
import { color } from '@design/tokens';
import {
  BUILT_IN_FLAGS, FLAG_EMOJI, FLAG_LABEL, FLAG_SHORT, attendanceRate, attendanceStatus, classesOn,
  flagInfo, parseTimetable, toItems,
} from '@/lib/timetable';
import { ModuleCard } from './ModuleCard';
import { FlagMaker } from './FlagMaker';
import { formatHour, weekDays } from '@/lib/schedule';
import { DAY_LETTER, dayIndex, formatShort } from '@/lib/dates';
import { loadOf } from '@/lib/load';
import { successFeedback, tapFeedback } from '@/lib/haptics';
import type { CustomFlag, Dread, FlagId, Item, Module } from '@/lib/types';
import { useStore } from '@/state/store';
import { useItemsWithLogs } from '@/state/selectors';

const KIND_TONE = { lecture: 'busy', lab: 'steady', tutorial: 'recovery', seminar: 'heavy' } as const;

const SAMPLE = `Mon 09:00-11:00 CS2040 Operating Systems Lecture Kilburn LT1
Tue 14:00-16:00 CS2011 Algorithms Lab in Lab A
Thu 8-10am CS2035 Networks Lecture Stopford TH2`;

/**
 * The timetable.
 *
 * Fourteen hours a week that every other planner either ignores or dumps in as
 * undifferentiated blocks. Here each class belongs to a module, carries that
 * module's dread, and can be marked for *why it matters* — the lecture where the
 * hints get given is the one a stressed student skips first and can least afford
 * to.
 */
const TABS = ['Week', 'Modules', 'Import'];

/** The three pages, as URL segments. `/timetable/modules` opens on the list. */
export const STEP_SLUGS = ['week', 'modules', 'import'] as const;

const TITLE = ['This week', 'Your modules', 'Import'] as const;
const SUB = [
  'Tap a class to say why it matters.',
  'Dread once, and every class re-prices.',
  'Paste it. Nothing is scanned or uploaded.',
] as const;

export function Timetable({ initialStep = 0 }: { initialStep?: number }) {
  const router = useRouter();
  const { today, modules, toggleClassFlag, importTimetable, customFlags, removeCustomFlag } = useStore();
  const items = useItemsWithLogs();

  const days = weekDays(today);
  const [selected, setSelected] = useState(today);
  const [openModule, setOpenModule] = useState<string | null>(null);
  const [step, setStep] = useState(initialStep);
  const [paste, setPaste] = useState('');
  /** Where a new flag is being made: on a class (its id), in the flag shelf, or nowhere. */
  const [making, setMaking] = useState<string | null>(null);

  const preview = useMemo(() => (paste.trim() ? parseTimetable(paste) : null), [paste]);
  const classesToday = classesOn(items, selected);
  const weekHours = days.reduce((total, date) => total + classesOn(items, date).reduce((h, c) => h + c.hours, 0), 0);
  const atRisk = modules.filter((m) => ['below', 'close'].includes(attendanceStatus(m)));

  return (
    <Screen
      back="/you"
      backLabel="You"
      footer={
        <Button
          label={step === 2 ? 'Back to the week' : 'Import from your portal'}
          kind={step === 2 ? 'secondary' : 'primary'}
          onPress={() => { tapFeedback(); setStep(step === 2 ? 0 : 2); }}
        />
      }
    >
      <Stack gap={5} className="pt-2">
        <StepDots labels={TABS} current={step} onJump={setStep} variant="tabs" />
        <PageHeader
          {...SCREEN.timetable}
          eyebrow="Timetable"
          title={TITLE[step]}
        />

        {/* Attendance, when somebody is counting. */}
        {atRisk.length ? (
          <Card tone="heavy" gap={3}>
            <Stack direction="row" gap={4} align="center">
              <Sticker name="wall" size={40} />
              <Stack gap={1} grow>
                <Text variant="callout" weight="semibold" tone="heavy">
                  {atRisk.length === 1 ? `${atRisk[0].name} attendance` : `${atRisk.length} modules near the line`}
                </Text>
                <Text variant="micro" tone="muted">
                  {atRisk.map((m) => `${m.code} ${attendanceRate(m)}%`).join(' · ')}
                </Text>
              </Stack>
            </Stack>
          </Card>
        ) : null}

        {/* Import. A paste, not a scan. */}
        {step === 2 ? (
          <Card gap={4}>
            <Stack gap={2}>
              <Text variant="heading">Paste it from your portal</Text>
              <Text variant="footnote" tone="muted">
                One class per line. Any shape works — it reads the day, the time and the room.
              </Text>
            </Stack>
            <TextInput
              value={paste}
              onChangeText={setPaste}
              multiline
              placeholder={SAMPLE}
              placeholderTextColor={color.ink.subtle}
              accessibilityLabel="Paste your timetable"
              className="min-h-row rounded-md border border-line-strong bg-page px-4 py-3 text-footnote text-ink-default"
              style={{ minHeight: 120 }}
            />

            {preview ? (
              <Stack gap={3}>
                <Text variant="micro" tone="subtle">
                  READ {preview.classes.length} CLASS{preview.classes.length === 1 ? '' : 'ES'}
                  {preview.skipped.length ? ` · ${preview.skipped.length} NOT UNDERSTOOD` : ''}
                </Text>
                {preview.classes.slice(0, 6).map((entry, index) => (
                  <Text key={index} variant="footnote" tone="muted">
                    {DAY_LETTER[entry.day]} · {formatHour(entry.startHour)}–{formatHour(entry.startHour + entry.hours)} ·{' '}
                    {entry.name} {entry.kind}{entry.room ? ` · ${entry.room}` : ''}
                  </Text>
                ))}
                {/* Nothing disappears silently. */}
                {preview.skipped.map((line) => (
                  <Text key={line} variant="micro" tone="heavy">Could not read: {line}</Text>
                ))}
                <Button
                  label={`Replace my timetable with these ${preview.classes.length}`}
                  onPress={() => {
                    const built = toItems(preview.classes, today, 2);
                    const found: Module[] = [...new Set(built.map((i) => i.moduleId!))].map((id) => {
                      const first = built.find((i) => i.moduleId === id)!;
                      return {
                        id,
                        code: id.replace('imported-', '').toUpperCase().slice(0, 8),
                        name: first.title.replace(/\s\w+$/, ''),
                        dread: 2 as Dread,
                        importance: 2 as const,
                        attended: 0,
                        held: 0,
                        requiredAttendance: null,
                      };
                    });
                    importTimetable(built, found);
                    successFeedback();
                    setStep(0);
                    setPaste('');
                  }}
                />
              </Stack>
            ) : null}
          </Card>
        ) : null}

        {/* The week, day by day. */}
        {step === 0 ? (
        <Stack gap={3}>
          <Stack direction="row" gap={2}>
            {days.map((date) => {
              const count = classesOn(items, date).length;
              const isSelected = date === selected;
              return (
                <Pressable
                  key={date}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={`${formatShort(date)}, ${count} classes`}
                  onPress={() => setSelected(date)}
                  className={`min-h-min flex-1 items-center gap-1 rounded-md py-3 active:opacity-70 ${
                    isSelected ? 'bg-inverse' : count ? 'bg-sunken' : ''
                  }`}
                >
                  <Text variant="micro" weight="semibold" tone={isSelected ? 'inverse' : 'subtle'}>
                    {DAY_LETTER[dayIndex(date)]}
                  </Text>
                  <Text variant="micro" tone={isSelected ? 'inverse' : count ? 'default' : 'subtle'}>
                    {count || '–'}
                  </Text>
                </Pressable>
              );
            })}
          </Stack>

          {/* The point of flagging a class is what it does to the rest of the
              app, which is on another screen. Say so, and take them there. */}
          <Button
            label="View these in my week"
            kind="secondary"
            onPress={() => router.push(`/plan?day=${selected}`)}
          />

          {/* The flag shelf: the three built in, and any of your own. */}
          <Card gap={3}>
            <Stack direction="row" align="center" justify="between">
              <Text variant="micro" tone="subtle">FLAGS · WHY A CLASS MATTERS</Text>
              {making === 'shelf' ? null : (
                <Chip label="＋ New flag" tone="selected" onPress={() => { tapFeedback(); setMaking('shelf'); }} />
              )}
            </Stack>
            <Stack direction="row" gap={2} wrap>
              {BUILT_IN_FLAGS.map((flag) => (
                <Chip key={flag} label={`${FLAG_EMOJI[flag]} ${FLAG_LABEL[flag]}`} readOnly />
              ))}
              {customFlags.map((flag) => (
                <Chip
                  key={flag.id}
                  label={`${flag.emoji} ${flag.label}${flag.protect ? ' 🔒' : ''}  ✕`}
                  tone={flag.protect ? 'heavy' : 'plain'}
                  accessibilityHint="Deletes this flag from every class"
                  onPress={() => { tapFeedback(); removeCustomFlag(flag.id); }}
                />
              ))}
            </Stack>
            {making === 'shelf' ? (
              <FlagMaker onMade={() => setMaking(null)} onCancel={() => setMaking(null)} />
            ) : customFlags.length ? (
              <Text variant="micro" tone="subtle">Tap one of yours to delete it. 🔒 protects the class.</Text>
            ) : (
              <Text variant="micro" tone="subtle">Make your own: “Lab sign-off”, “Groups picked”, “Bring laptop”.</Text>
            )}
          </Card>

          <Card gap={4}>
            {classesToday.length ? (
              classesToday.map((session) => (
                <ClassRow
                  key={session.id}
                  session={session}
                  customFlags={customFlags}
                  making={making === session.id}
                  onMake={() => { tapFeedback(); setMaking(making === session.id ? null : session.id); }}
                  onMade={(id) => { toggleClassFlag(session.id, id); setMaking(null); }}
                  onToggleFlag={(flag) => { tapFeedback(); toggleClassFlag(session.id, flag); }}
                  onCapture={() => router.push(`/add?date=${session.date}`)}
                />
              ))
            ) : (
              <Stack direction="row" gap={4} align="center">
                <Sticker name="sun" size={44} />
                <Text variant="callout" tone="muted" className="flex-1">No classes on {formatShort(selected)}.</Text>
              </Stack>
            )}
          </Card>
        </Stack>

        ) : null}

        {/* Modules: dread once, priced everywhere. */}
        {step === 1 ? (
          <Stack gap={4}>
            <Text variant="micro" tone="subtle">YOUR MODULES · {modules.length}</Text>
            {modules.map((module) => (
              <ModuleCard
                key={module.id}
                module={module}
                items={items}
                days={days}
                open={openModule === module.id}
                onToggle={() => { tapFeedback(); setOpenModule(openModule === module.id ? null : module.id); }}
                onJump={(date) => { setSelected(date); setStep(0); }}
              />
            ))}
          </Stack>
        ) : null}


        <View className="h-2" />
      </Stack>
    </Screen>
  );
}

/** One class, with every reason it might matter more than its length. */
function ClassRow({
  session,
  customFlags,
  making,
  onMake,
  onMade,
  onToggleFlag,
  onCapture,
}: {
  session: Item;
  customFlags: CustomFlag[];
  making: boolean;
  onMake: () => void;
  onMade: (id: string) => void;
  onToggleFlag: (flag: FlagId) => void;
  onCapture: () => void;
}) {
  const flags = session.flags ?? [];
  const all: FlagId[] = [...BUILT_IN_FLAGS, ...customFlags.map((flag) => flag.id)];
  return (
    <Stack gap={3} className="rounded-md border border-line-hairline px-4 py-4">
      <Stack direction="row" gap={4} align="start" justify="between">
        <Stack gap={1} grow>
          <Text variant="body" weight="semibold">{session.title}</Text>
          <Text variant="micro" tone="subtle">
            {formatHour(session.startHour ?? 0)}–{formatHour((session.startHour ?? 0) + session.hours)}
            {session.room ? ` · ${session.room}` : ''} · {loadOf(session)} load
          </Text>
        </Stack>
        <Chip
          label={session.sessionKind ?? 'class'}
          tone={KIND_TONE[session.sessionKind ?? 'lecture']}
          readOnly
        />
      </Stack>

      <Stack direction="row" gap={2} wrap>
        {all.map((flag) => {
          const info = flagInfo(flag, customFlags);
          if (!info) return null;
          const on = flags.includes(flag);
          const builtIn = (BUILT_IN_FLAGS as string[]).includes(flag);
          return (
            <Chip
              key={flag}
              label={`${info.emoji} ${builtIn && on ? FLAG_LABEL[flag as keyof typeof FLAG_LABEL] : info.short}`}
              tone={on ? (info.protect ? 'heavy' : 'selected') : 'plain'}
              onPress={() => onToggleFlag(flag)}
              accessibilityHint={on ? 'Marked. Tap to clear.' : info.label}
            />
          );
        })}
        <Chip label={making ? 'Close' : '＋'} tone={making ? 'selected' : 'plain'} accessibilityHint="Make a flag of your own" onPress={onMake} />
      </Stack>

      {making ? <FlagMaker onMade={onMade} onCancel={onMake} /> : null}

      {/* Work gets announced in class, which is the moment to capture it. */}
      {flags.includes('coursework') ? (
        <Chip label="Anything set in this one?" tone="steady" onPress={onCapture} />
      ) : null}
    </Stack>
  );
}
