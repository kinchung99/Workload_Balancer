import { useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Button, Card, Chip, MarkBadge, Screen, Section, Sticker, Stack, Text,
  PageHeader, StepDots,
} from '@/components';
import { SCREEN } from '@design/screens';
import { color } from '@design/tokens';
import {
  BUILT_IN_FLAGS, FLAG_EMOJI, FLAG_LABEL, attendanceRate, attendanceStatus, classesOn,
  flagInfo, flagsFor,
} from '@/lib/timetable';
import { ModuleCard } from './ModuleCard';
import { ClassBuilder } from './ClassBuilder';
import { clockHour, markStatus, outcomeWord, type MarkStatus } from '@/lib/marking';
import { FlagMaker } from './FlagMaker';
import { formatHour, weekDays } from '@/lib/schedule';
import { DAY_LETTER, addDays, dayIndex, formatShort, startOfWeek } from '@/lib/dates';
import { costPercent } from '@/lib/load';
import { successFeedback, tapFeedback } from '@/lib/haptics';
import type { CustomFlag, FlagId, Item } from '@/lib/types';
import { useStore } from '@/state/store';
import { useItemsWithLogs } from '@/state/selectors';

const KIND_TONE = { lecture: 'busy', lab: 'steady', tutorial: 'recovery', seminar: 'heavy' } as const;


/**
 * The timetable.
 *
 * Fourteen hours a week that every other planner either ignores or dumps in as
 * undifferentiated blocks. Here each class belongs to a module, carries that
 * module's dread, and can be marked for *why it matters* — the lecture where the
 * hints get given is the one a stressed student skips first and can least afford
 * to.
 */
const TABS = ['Week', 'Modules', 'Add'];

/** The three pages, as URL segments. `/timetable/modules` opens on the list. */
export const STEP_SLUGS = ['week', 'modules', 'import'] as const;

const TITLE = ['This week', 'Your modules', 'Add classes'] as const;

export function Timetable({ initialStep = 0 }: { initialStep?: number }) {
  const router = useRouter();
  const { today, modules, toggleClassFlag, customFlags } = useStore();
  const items = useItemsWithLogs();

  const days = weekDays(today);
  const [selected, setSelected] = useState(today);
  const [openModule, setOpenModule] = useState<string | null>(null);
  const [step, setStep] = useState(initialStep);
  /** The class a new flag is being made on, if any. */
  const [making, setMaking] = useState<string | null>(null);

  const classesToday = classesOn(items, selected);
  const weekHours = days.reduce((total, date) => total + classesOn(items, date).reduce((h, c) => h + c.hours, 0), 0);
  const atRisk = modules.filter((m) => ['below', 'close'].includes(attendanceStatus(m)));

  return (
    <Screen
      back="/you"
      backLabel="You"
      footer={
        <Button
          label={step === 2 ? 'Back to the week' : 'Add classes'}
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

        {/* Adding: modules and their classes, by tapping. */}
        {step === 2 ? <ClassBuilder /> : null}

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
                  accessibilityLabel={`${formatShort(date)}, ${count} class${count === 1 ? '' : 'es'}`}
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

          {/* The day's classes, in the week colour. The point of flagging one is
              what it does to the rest of the app, so the way there is on top. */}
          <Section
            family="week"
            title={formatShort(selected)}
            sticker="class"
            meta={`${classesToday.length} class${classesToday.length === 1 ? '' : 'es'}`}
            action={{ label: 'In my week', onPress: () => router.push(`/plan?day=${selected}`) }}
          >
            {classesToday.length ? (
              classesToday.map((session) => (
                <ClassRow
                  key={session.id}
                  session={session}
                  customFlags={flagsFor(session.moduleId, customFlags)}
                  moduleCode={modules.find((m) => m.id === session.moduleId)?.code}
                  making={making === session.id}
                  onMake={() => { tapFeedback(); setMaking(making === session.id ? null : session.id); }}
                  onMade={(id) => { toggleClassFlag(session.id, id); setMaking(null); }}
                  onToggleFlag={(flag) => { tapFeedback(); toggleClassFlag(session.id, flag); }}
                  onCapture={() => router.push(`/add?date=${session.date}`)}
                  status={markStatus(session, today, clockHour(today))}
                />
              ))
            ) : (
              <Stack direction="row" gap={4} align="center" className="rounded-lg bg-raised px-4 py-4">
                <Sticker name="sun" size={40} />
                <Text variant="callout" tone="muted" className="flex-1">No classes on {formatShort(selected)}.</Text>
              </Stack>
            )}
          </Section>
        </Stack>

        ) : null}

        {/* Modules: dread once, priced everywhere. */}
        {step === 1 ? (
          <Stack gap={4}>
            {modules.map((module) => (
              <ModuleCard
                key={module.id}
                module={module}
                items={items}
                days={days}
                open={openModule === module.id}
                onToggle={() => { tapFeedback(); setOpenModule(openModule === module.id ? null : module.id); }}
              />
            ))}
          </Stack>
        ) : null}


        <View className="h-2" />
      </Stack>
    </Screen>
  );
}

/** One class, with the built-in reasons and its own module's. */
function ClassRow({
  session,
  customFlags,
  moduleCode,
  making,
  onMake,
  onMade,
  onToggleFlag,
  onCapture,
  status,
}: {
  session: Item;
  /** Only this module's own flags - they are offered nowhere else. */
  customFlags: CustomFlag[];
  moduleCode?: string;
  making: boolean;
  onMake: () => void;
  onMade: (id: string) => void;
  onToggleFlag: (flag: FlagId) => void;
  onCapture: () => void;
  /** Signed in, missed, or waiting to be - the same badge the day's blocks wear. */
  status: MarkStatus;
}) {
  const ceilings = useStore((state) => state.ceilings);
  const flags = session.flags ?? [];
  const all: FlagId[] = [...BUILT_IN_FLAGS, ...customFlags.map((flag) => flag.id)];
  return (
    <Stack gap={3} className="rounded-lg border border-line-hairline bg-raised px-4 py-4">
      <Stack direction="row" gap={4} align="start" justify="between">
        <Stack gap={1} grow>
          <Text variant="body" weight="semibold">{session.title}</Text>
          <Text variant="micro" tone="subtle">
            {formatHour(session.startHour ?? 0)}–{formatHour((session.startHour ?? 0) + session.hours)}
            {session.room ? ` · ${session.room}` : ''} · 🔋 −{Math.max(1, Math.round(costPercent(session, ceilings)))}%
          </Text>
          {status !== 'later' ? <MarkBadge status={status} word={outcomeWord(session)} auto={session.autoMarked} /> : null}
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

      {making && session.moduleId ? (
        <FlagMaker moduleId={session.moduleId} moduleCode={moduleCode} onMade={onMade} onCancel={onMake} />
      ) : null}

      {/* Work gets announced in class, which is the moment to capture it. */}
      {flags.includes('coursework') ? (
        <Chip label="Anything set in this one?" tone="steady" onPress={onCapture} />
      ) : null}
    </Stack>
  );
}
