import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { DreadSlider, Ring, Stack, Text } from '@/components';
import { DrainFace } from '@/components/primitives/AreaDial';
import { color, radius } from '@design/tokens';
import { DAY_LETTER, dayIndex } from '@/lib/dates';
import { successFeedback, tapFeedback } from '@/lib/haptics';
import { MODULE_EMOJIS, attendanceRate, attendanceStatus, flagInfo, moduleEmoji, moduleWeek } from '@/lib/timetable';
import { formatHour } from '@/lib/schedule';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useStore } from '@/state/store';
import type { Item, Module } from '@/lib/types';

/** Decoration only: a module's colour says which module, never how it is going. */
const HUES = [color.decor.sky, color.decor.lilac, color.decor.mint, color.decor.lemon, color.decor.candy, color.decor.blush];
const hueOf = (id: string) => HUES[[...id].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % HUES.length];

const IMPORTANCE = ['Background', 'Normal', 'Really matters'] as const;
const STRIP = 44;

/**
 * One module, as a card you would want to open.
 *
 * It was a row of text: a code, a name, "4h · 8 load". The things that row was
 * describing are visual - when in the week this module sits, how close the
 * register is to the line, how much the student minds it - so they are drawn:
 * a week strip of its classes, an attendance ring, and the same face the dread
 * slider uses. Tap to open the controls; tap a class in the strip to jump to
 * that day.
 */
export function ModuleCard({
  module,
  items,
  days,
  open,
  onToggle,
  onJump,
}: {
  module: Module;
  items: Item[];
  days: string[];
  open: boolean;
  onToggle: () => void;
  onJump: (date: string) => void;
}) {
  const { setModuleDread, setModuleImportance, markAttendance, setModuleEmoji, customFlags } = useStore();
  const week = moduleWeek(items, module.id, days);
  const status = attendanceStatus(module);
  const tracked = module.requiredAttendance !== null;
  const rate = attendanceRate(module);
  const hue = hueOf(module.id);
  const peak = Math.max(1, ...days.map((date) => week.sessions.filter((s) => s.date === date).reduce((h, s) => h + s.hours, 0)));
  const ifMissed = Math.round((module.attended / (module.held + 1)) * 100);
  const ringColor = status === 'below' ? color.band.heavy.fill : status === 'close' ? color.band.busy.fill : color.band.steady.fill;

  return (
    <View
      className={`overflow-hidden rounded-xl border-2 ${status === 'below' ? 'border-heavy-fill' : open ? 'border-inverse' : 'border-line-hairline'}`}
      style={{ backgroundColor: color.surface.raised }}
    >
      {/* Header band: the module's own colour and picture. */}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${module.name}, ${week.hours} hours this week, dread ${module.dread}${tracked ? `, ${rate}% attended` : ''}`}
        onPress={onToggle}
        className="active:opacity-80"
      >
        <Stack direction="row" gap={4} align="center" className="px-4 py-4" style={{ backgroundColor: hue }}>
          <Bouncy trigger={module.emoji ?? ''}>
            <View className="items-center justify-center rounded-pill bg-raised" style={{ width: 56, height: 56 }}>
              <Text variant="title">{moduleEmoji(module)}</Text>
            </View>
          </Bouncy>
          <Stack gap={1} grow>
            <Text variant="micro" tone="default">{module.code}</Text>
            <Text variant="heading">{module.name}</Text>
            <Text variant="micro" tone="muted">{open ? 'Tap to close' : 'Tap for dread, importance, register'}</Text>
          </Stack>
          {tracked ? (
            <Ring
              size={58}
              stroke={7}
              label={`${rate}% attended, ${module.requiredAttendance}% required`}
              segments={[{ value: rate / 100, color: ringColor }]}
            >
              <Text variant="caption" weight="bold">{rate}%</Text>
            </Ring>
          ) : (
            <View className="rounded-pill bg-raised px-3 py-1">
              <Text variant="micro" tone="subtle">NO REGISTER</Text>
            </View>
          )}
        </Stack>
      </Pressable>

      <Stack gap={4} className="px-4 py-4">
        {/* The week, as this module sees it. */}
        <Stack direction="row" gap={1} align="end">
          {days.map((date) => {
            const sessions = week.sessions.filter((s) => s.date === date);
            return (
              <Stack key={date} gap={1} align="center" className="flex-1">
                <View className="w-full items-center justify-end" style={{ height: STRIP }}>
                  {sessions.map((session) => {
                    const flagged = (session.flags ?? []).map((f) => flagInfo(f, customFlags)).find(Boolean);
                    return (
                      <Pressable
                        key={session.id}
                        accessibilityRole="button"
                        accessibilityLabel={`${session.title}, ${formatHour(session.startHour ?? 0)}. Open that day.`}
                        onPress={() => { tapFeedback(); onJump(date); }}
                        className="w-full items-center active:opacity-60"
                      >
                        {flagged ? <Text variant="micro">{flagged.emoji}</Text> : null}
                        <View
                          style={{
                            width: '78%',
                            height: Math.max(8, (session.hours / peak) * (STRIP - 14)),
                            borderRadius: radius.sm,
                            backgroundColor: hue,
                            borderWidth: 1.5,
                            borderColor: color.ink.default,
                          }}
                        />
                      </Pressable>
                    );
                  })}
                </View>
                <Text variant="micro" tone={sessions.length ? 'default' : 'subtle'}>{DAY_LETTER[dayIndex(date)]}</Text>
              </Stack>
            );
          })}
        </Stack>

        {/* Three readings, as tiles. */}
        <Stack direction="row" gap={2}>
          <Tile label="THIS WEEK" value={`${week.hours}h`} sub={`${week.sessions.length} class${week.sessions.length === 1 ? '' : 'es'}`} />
          <Tile label="LOAD" value={`${week.load}`} sub="hours × dread" />
          <View className="flex-1 items-center gap-1 rounded-md bg-sunken px-2 py-3">
            <DrainFace level={module.dread} size={30} />
            <Text variant="micro" tone={module.dread >= 4 ? 'heavy' : module.dread >= 3 ? 'busy' : 'steady'}>Dread {module.dread}</Text>
          </View>
        </Stack>

        {status === 'close' ? (
          <Text variant="micro" tone="busy">One more absence takes you under {module.requiredAttendance}%.</Text>
        ) : status === 'below' ? (
          <Text variant="micro" tone="heavy">Below the {module.requiredAttendance}% the department expects.</Text>
        ) : null}

        {open ? (
          <Stack gap={5} className="pt-1">
            <Stack gap={2}>
              <Text variant="micro" tone="subtle">HOW MUCH YOU DREAD IT · RE-PRICES EVERY CLASS</Text>
              <DreadSlider value={module.dread} onChange={(next) => setModuleDread(module.id, next)} />
            </Stack>

            <Stack gap={2}>
              <Text variant="micro" tone="subtle">HOW MUCH IT MATTERS</Text>
              <Stack direction="row" gap={3} align="center">
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
                <Text variant="footnote" weight="semibold">{IMPORTANCE[module.importance - 1]}</Text>
              </Stack>
            </Stack>

            {tracked ? (
              <Stack gap={2}>
                <Text variant="micro" tone="subtle">REGISTER · {module.attended} OF {module.held} · NEED {module.requiredAttendance}%</Text>
                <Stack direction="row" gap={2}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => { markAttendance(module.id, true); successFeedback(); }}
                    className="min-h-min flex-1 items-center justify-center rounded-pill border border-steady-fill bg-steady-wash py-3 active:opacity-70"
                  >
                    <Text variant="callout" weight="semibold" tone="steady">✓ Went</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => { markAttendance(module.id, false); successFeedback(); }}
                    className="min-h-min flex-1 items-center justify-center rounded-pill border border-heavy-fill bg-heavy-wash py-3 active:opacity-70"
                  >
                    <Text variant="callout" weight="semibold" tone="heavy">✗ Missed it</Text>
                  </Pressable>
                </Stack>
                <Text variant="micro" tone={ifMissed < (module.requiredAttendance ?? 0) ? 'heavy' : 'subtle'}>
                  Miss the next one and it reads {ifMissed}%.
                </Text>
              </Stack>
            ) : null}

            <Stack gap={2}>
              <Text variant="micro" tone="subtle">ITS PICTURE</Text>
              <Stack direction="row" gap={2} wrap>
                {MODULE_EMOJIS.map((emoji) => {
                  const on = moduleEmoji(module) === emoji;
                  return (
                    <Pressable
                      key={emoji}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={`Picture ${emoji}`}
                      onPress={() => { tapFeedback(); setModuleEmoji(module.id, emoji); }}
                      className="items-center justify-center rounded-md active:opacity-60"
                      style={{ width: 40, height: 40, backgroundColor: on ? hue : color.surface.sunken, borderWidth: on ? 2 : 0, borderColor: color.ink.default }}
                    >
                      <Text variant="heading">{emoji}</Text>
                    </Pressable>
                  );
                })}
              </Stack>
            </Stack>
          </Stack>
        ) : null}
      </Stack>
    </View>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <View className="flex-1 gap-1 rounded-md bg-sunken px-3 py-3">
      <Text variant="micro" tone="subtle">{label}</Text>
      <Text variant="heading">{value}</Text>
      <Text variant="micro" tone="subtle">{sub}</Text>
    </View>
  );
}

/** A small hop whenever `trigger` changes - the picture reacting to being picked. */
function Bouncy({ trigger, children }: { trigger: string; children: ReactNode }) {
  const reduce = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (reduce) return;
    scale.setValue(0.7);
    Animated.spring(scale, { toValue: 1, friction: 4, tension: 160, useNativeDriver: true }).start();
  }, [trigger, reduce, scale]);
  return <Animated.View style={{ transform: [{ scale }] }}>{children}</Animated.View>;
}
