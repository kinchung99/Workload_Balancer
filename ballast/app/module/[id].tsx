import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Chip, DrainPicker, PageHeader, Screen, Section, Stack, Text } from '@/components';
import { color } from '@design/tokens';
import { addDays, startOfWeek } from '@/lib/dates';
import { drainCosts } from '@/lib/drain';
import { tapFeedback } from '@/lib/haptics';
import { weekDays } from '@/lib/schedule';
import { MODULE_EMOJIS, moduleEmoji, moduleTerm, moduleWeek } from '@/lib/timetable';
import { FlagMaker } from '@/features/timetable/FlagMaker';
import { useStore } from '@/state/store';
import { useItemsWithLogs } from '@/state/selectors';
import { modules as seededModules } from '@/data/seed';

const IMPORTANCE = ['Background', 'Normal', 'Really matters'] as const;
const REQUIRED = [null, 70, 80, 90] as const;

/** The seeded modules, so `/module/...` renders in the static export. */
export async function generateStaticParams() {
  return seededModules.map((module) => ({ id: module.id }));
}

/**
 * A module's settings - the things set once, at import, and rarely touched.
 *
 * How long it runs and which week it is now, whether attendance is counted and
 * at what line, how much it matters, how draining its classes are, its picture
 * and its own flags. The module card keeps only what changes week to week -
 * this week's register - and opens this when something here needs changing.
 */
export default function ModuleSettings() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    modules, today, ceilings, customFlags, removeCustomFlag,
    setModuleDread, setModuleImportance, setModuleWeeks, setModuleRequired, updateModule,
  } = useStore();
  const items = useItemsWithLogs();
  const [making, setMaking] = useState(false);
  const module = modules.find((m) => m.id === id);
  const days = weekDays(today);

  const costs = useMemo(() => {
    if (!module) return null;
    const base = items.filter((i) => i.moduleId !== module.id);
    const classes = items.filter((i) => i.moduleId === module.id);
    return drainCosts(base, (level) => classes.map((i) => ({ ...i, dread: level })), days[0], ceilings);
  }, [items, module, days, ceilings]);

  if (!module || !costs) {
    return (
      <Screen back="/timetable/modules" backLabel="Modules">
        <Stack gap={4} className="pt-6">
          <Text variant="title">That module is gone.</Text>
        </Stack>
      </Screen>
    );
  }

  const term = moduleTerm(module, today);
  const weeks = module.weeks ?? 12;
  const weekNow = term?.week ?? 1;
  const mine = customFlags.filter((flag) => flag.moduleId === module.id);
  const week = moduleWeek(items, module.id, days);

  return (
    <Screen
      back="/timetable/modules"
      backLabel="Modules"
      footer={<Button label="Done" onPress={() => router.navigate('/timetable/modules')} />}
    >
      <Stack gap={5} className="pt-2">
        <PageHeader sticker="class" wash={color.decor.lilac} eyebrow={module.code} title={module.name} sub="Settings" />

        {/* Its picture: one row, the current one ringed. */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {MODULE_EMOJIS.map((emoji) => {
            const on = moduleEmoji(module) === emoji;
            return (
              <Pressable
                key={emoji}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`Picture ${emoji}`}
                onPress={() => { tapFeedback(); updateModule(module.id, { emoji }); }}
                className="items-center justify-center rounded-pill active:opacity-60"
                style={{
                  width: 46, height: 46,
                  backgroundColor: on ? color.decor.lemon : color.surface.sunken,
                  borderWidth: on ? 2 : 0, borderColor: color.ink.default,
                }}
              >
                <Text variant="heading">{emoji}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* When it runs. */}
        <Section family="week" title="Term" sticker="calendar" meta={term ? `Week ${term.week} of ${term.weeks}` : undefined}>
          <View className="gap-3 rounded-lg bg-raised px-4 py-3">
            <Stepper
              label="Runs for"
              value={`${weeks} weeks`}
              onLess={() => setModuleWeeks(module.id, weeks - 1)}
              onMore={() => setModuleWeeks(module.id, weeks + 1)}
            />
            <Stepper
              label="Week now"
              value={`Week ${weekNow}`}
              onLess={() => updateModule(module.id, { startDate: addDays(startOfWeek(today), -Math.max(0, weekNow - 2) * 7) })}
              onMore={() => updateModule(module.id, { startDate: addDays(startOfWeek(today), -Math.min(weeks - 1, weekNow) * 7) })}
            />
          </View>
        </Section>

        {/* Whether anyone counts, and how much it matters. */}
        <Section family="focus" title="Register" sticker="star">
          <View className="gap-3 rounded-lg bg-raised px-4 py-3">
            <Text variant="callout" weight="semibold">Attendance needed</Text>
            <Stack direction="row" gap={2}>
              {REQUIRED.map((value) => (
                <Chip
                  key={String(value)}
                  label={value === null ? 'None' : `${value}%`}
                  tone={module.requiredAttendance === value ? 'selected' : 'plain'}
                  onPress={() => { tapFeedback(); setModuleRequired(module.id, value); }}
                />
              ))}
            </Stack>
            <Stack direction="row" gap={2} align="center">
              <Text variant="callout" weight="semibold" className="flex-1">How much it matters</Text>
              {([1, 2, 3] as const).map((level) => (
                <Pressable
                  key={level}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: module.importance === level }}
                  accessibilityLabel={IMPORTANCE[level - 1]}
                  onPress={() => { tapFeedback(); setModuleImportance(module.id, level); }}
                  className="min-h-min min-w-min items-center justify-center active:opacity-60"
                >
                  <Text variant="title" style={{ opacity: level <= module.importance ? 1 : 0.25 }}>⭐</Text>
                </Pressable>
              ))}
            </Stack>
          </View>
        </Section>

        {/* How much its classes take out of you. */}
        <View className="rounded-xl border border-line-hairline bg-raised px-4 py-4">
          <DrainPicker
            question="How draining are its classes?"
            value={module.dread}
            onChange={(next) => setModuleDread(module.id, next)}
            costs={costs}
            hours={week.hours}
            costOf="of this week’s battery"
          />
        </View>

        {/* Its own reasons for a class to matter. Offered on its classes and nowhere else. */}
        <Section family="people" title="Its own flags" sticker="sparkle" meta={mine.length ? `${mine.length}` : undefined}>
          <Stack direction="row" gap={2} wrap>
            {mine.map((flag) => (
              <Chip
                key={flag.id}
                label={`${flag.emoji} ${flag.label}${flag.protect ? ' 🔒' : ''} ✕`}
                tone={flag.protect ? 'heavy' : 'plain'}
                accessibilityHint="Delete the flag"
                onPress={() => { tapFeedback(); removeCustomFlag(flag.id); }}
              />
            ))}
            {making ? null : <Chip label="＋ New flag" tone="selected" onPress={() => { tapFeedback(); setMaking(true); }} />}
          </Stack>
          {making ? (
            <FlagMaker moduleId={module.id} moduleCode={module.code} onMade={() => setMaking(false)} onCancel={() => setMaking(false)} />
          ) : null}
        </Section>

        <View className="h-2" />
      </Stack>
    </Screen>
  );
}

function Stepper({ label, value, onLess, onMore }: { label: string; value: string; onLess: () => void; onMore: () => void }) {
  return (
    <Stack direction="row" align="center" gap={3}>
      <Text variant="callout" weight="semibold" className="flex-1">{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: less`}
        onPress={() => { tapFeedback(); onLess(); }}
        className="items-center justify-center rounded-pill border-2 border-line-hairline bg-raised active:opacity-60"
        style={{ width: 36, height: 36 }}
      >
        <Text variant="heading">−</Text>
      </Pressable>
      <Text variant="callout" weight="bold" className="text-center" style={{ minWidth: 76 }}>{value}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: more`}
        onPress={() => { tapFeedback(); onMore(); }}
        className="items-center justify-center rounded-pill border-2 border-line-hairline bg-raised active:opacity-60"
        style={{ width: 36, height: 36 }}
      >
        <Text variant="heading">+</Text>
      </Pressable>
    </Stack>
  );
}
