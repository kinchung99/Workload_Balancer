import { useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Button, Card, Chip, DreadPicker, Reveal, Screen, Sticker, Stack, Text,
  PageHeader, StepDots,
} from '@/components';
import { SCREEN } from '@design/screens';
import { color } from '@design/tokens';
import {
  FLAG_LABEL, FLAG_SHORT, attendanceRate, attendanceStatus, classesOn, moduleWeek,
  parseTimetable, toItems,
} from '@/lib/timetable';
import { formatHour, weekDays } from '@/lib/schedule';
import { DAY_LETTER, dayIndex, formatShort } from '@/lib/dates';
import { loadOf } from '@/lib/load';
import { successFeedback, tapFeedback } from '@/lib/haptics';
import type { ClassFlag, Dread, Item, Module } from '@/lib/types';
import { useStore } from '@/state/store';
import { useItemsWithLogs } from '@/state/selectors';

const FLAGS: ClassFlag[] = ['tips', 'coursework', 'attendance'];
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
  const {
    today, modules, setModuleDread, setModuleImportance, toggleClassFlag, markAttendance, importTimetable,
  } = useStore();
  const items = useItemsWithLogs();

  const days = weekDays(today);
  const [selected, setSelected] = useState(today);
  const [openModule, setOpenModule] = useState<string | null>(null);
  const [step, setStep] = useState(initialStep);
  const [paste, setPaste] = useState('');

  const preview = useMemo(() => (paste.trim() ? parseTimetable(paste) : null), [paste]);
  const classesToday = classesOn(items, selected);
  const weekHours = days.reduce((total, date) => total + classesOn(items, date).reduce((h, c) => h + c.hours, 0), 0);
  const atRisk = modules.filter((m) => ['below', 'close'].includes(attendanceStatus(m)));

  return (
    <Screen
      back="/areas/time"
      backLabel="Time"
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
          sub={SUB[step]}
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

          <Card gap={4}>
            {classesToday.length ? (
              classesToday.map((session) => (
                <ClassRow
                  key={session.id}
                  session={session}
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
        <Stack gap={3}>
          <Text variant="micro" tone="subtle">YOUR MODULES</Text>
          {modules.map((module) => {
            const week = moduleWeek(items, module.id, days);
            const status = attendanceStatus(module);
            const open = openModule === module.id;
            return (
              <Card key={module.id} gap={4} tone={status === 'below' ? 'heavy' : 'plain'}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: open }}
                  accessibilityLabel={`${module.name}, ${week.hours} hours this week, dread ${module.dread}`}
                  onPress={() => { tapFeedback(); setOpenModule(open ? null : module.id); }}
                  className="active:opacity-70"
                >
                  <Stack direction="row" gap={4} align="center">
                    <Stack gap={1} grow>
                      <Text variant="body" weight="semibold">{module.name}</Text>
                      <Text variant="micro" tone="subtle">
                        {module.code} · {week.hours}h · {week.load} load
                        {module.requiredAttendance !== null ? ` · ${attendanceRate(module)}% attended` : ''}
                      </Text>
                    </Stack>
                    <Chip
                      label={`Dread ${module.dread}`}
                      tone={module.dread >= 4 ? 'heavy' : module.dread >= 3 ? 'busy' : 'steady'}
                      readOnly
                    />
                  </Stack>
                </Pressable>

                {status === 'close' ? (
                  <Text variant="micro" tone="busy">
                    One more absence takes you under {module.requiredAttendance}%.
                  </Text>
                ) : status === 'below' ? (
                  <Text variant="micro" tone="heavy">
                    Below the {module.requiredAttendance}% the department expects.
                  </Text>
                ) : null}

                {open ? (
                  <Stack gap={4}>
                    <Stack gap={2}>
                      <Text variant="micro" tone="subtle">HOW MUCH YOU DREAD IT · re-prices every class</Text>
                      <DreadPicker value={module.dread} onChange={(next) => setModuleDread(module.id, next)} />
                    </Stack>
                    <Stack gap={2}>
                      <Text variant="micro" tone="subtle">HOW MUCH IT MATTERS</Text>
                      <Stack direction="row" gap={2} wrap>
                        {([1, 2, 3] as const).map((level) => (
                          <Chip
                            key={level}
                            label={level === 1 ? 'Background' : level === 2 ? 'Normal' : 'Really matters'}
                            tone={module.importance === level ? 'selected' : 'plain'}
                            onPress={() => setModuleImportance(module.id, level)}
                          />
                        ))}
                      </Stack>
                    </Stack>
                    {module.requiredAttendance !== null ? (
                      <Stack gap={2}>
                        <Text variant="micro" tone="subtle">
                          ATTENDANCE · {module.attended} of {module.held}
                        </Text>
                        <Stack direction="row" gap={2} wrap>
                          <Chip label="Went" tone="steady" onPress={() => { markAttendance(module.id, true); successFeedback(); }} />
                          <Chip label="Missed it" tone="heavy" onPress={() => { markAttendance(module.id, false); successFeedback(); }} />
                        </Stack>
                      </Stack>
                    ) : null}
                  </Stack>
                ) : null}
              </Card>
            );
          })}
        </Stack>
        ) : null}

        {step !== 2 ? (
          <Reveal label="Why a class can be worth more than its hours">
            <Text variant="footnote" tone="muted">
              A lecture is an hour of load like any other until it is the one where the exam hints get given.
              Marking it means the rebalancer will never propose moving it, however heavy the week gets.
            </Text>
          </Reveal>
        ) : null}

        <View className="h-2" />
      </Stack>
    </Screen>
  );
}

/** One class, with the three reasons it might matter more than its length. */
function ClassRow({
  session,
  onToggleFlag,
  onCapture,
}: {
  session: Item;
  onToggleFlag: (flag: ClassFlag) => void;
  onCapture: () => void;
}) {
  const flags = session.flags ?? [];
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
        {FLAGS.map((flag) => (
          <Chip
            key={flag}
            label={flags.includes(flag) ? FLAG_LABEL[flag] : FLAG_SHORT[flag]}
            tone={flags.includes(flag) ? 'heavy' : 'plain'}
            onPress={() => onToggleFlag(flag)}
            accessibilityHint={flags.includes(flag) ? 'Marked. Tap to clear.' : FLAG_LABEL[flag]}
          />
        ))}
      </Stack>

      {/* Work gets announced in class, which is the moment to capture it. */}
      {flags.includes('coursework') ? (
        <Chip label="Anything set in this one?" tone="steady" onPress={onCapture} />
      ) : null}
    </Stack>
  );
}
