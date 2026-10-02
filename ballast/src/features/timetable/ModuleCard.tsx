import { Pressable, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ring, Stack, Text } from '@/components';
import { DRAIN, drainTone } from '@/lib/drain';
import { color } from '@design/tokens';
import { formatShort } from '@/lib/dates';
import { successFeedback, tapFeedback } from '@/lib/haptics';
import { attendanceRate, attendanceStatus, bestCase, moduleEmoji, moduleTerm, moduleWeek } from '@/lib/timetable';
import { clockHour, hasStarted } from '@/lib/marking';
import { formatHour } from '@/lib/schedule';
import { useStore } from '@/state/store';
import type { Item, Module } from '@/lib/types';

/** Decoration only: a module's colour says which module, never how it is going. */
const HUES = [color.decor.sky, color.decor.lilac, color.decor.mint, color.decor.lemon, color.decor.candy, color.decor.blush];
const hueOf = (id: string) => HUES[[...id].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % HUES.length];

/**
 * One module: who it is and how its register stands - and, opened, this week's
 * classes to sign into. Everything set once at import lives on its settings page.
 *
 * The register used to be two buttons that added one forever, so a student
 * could "attend" the same lecture ten times. Now every class is signed into
 * once, and only once its time has come.
 */
export function ModuleCard({
  module,
  items,
  days,
  open,
  onToggle,
}: {
  module: Module;
  items: Item[];
  days: string[];
  open: boolean;
  onToggle: () => void;
}) {
  const router = useRouter();
  const { markItem, today } = useStore();
  const week = moduleWeek(items, module.id, days);
  const status = attendanceStatus(module);
  const tracked = module.requiredAttendance !== null;
  const rate = attendanceRate(module);
  const term = moduleTerm(module, today);
  const best = bestCase(module, items, days, today);
  const hour = clockHour(today);
  const hue = hueOf(module.id);
  const ringColor = status === 'below' ? color.band.heavy.fill : status === 'close' ? color.band.busy.fill : color.band.steady.fill;

  return (
    <View
      className={`overflow-hidden rounded-xl border-2 bg-raised ${status === 'below' ? 'border-heavy-fill' : open ? 'border-inverse' : 'border-line-hairline'}`}
    >
      {/* Closed: the picture, the name, the register, and three short facts. */}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${module.name}, ${week.hours} hours this week, ${DRAIN[module.dread].word}${tracked ? `, ${rate}% attended` : ''}`}
        onPress={onToggle}
        className="active:opacity-80"
      >
        <Stack gap={3} className="px-4 py-4">
          <Stack direction="row" gap={3} align="center">
            <View className="items-center justify-center rounded-pill" style={{ width: 52, height: 52, backgroundColor: hue }}>
              <Text variant="title">{moduleEmoji(module)}</Text>
            </View>
            <Stack gap={1} grow>
              <Text variant="micro" tone="subtle">{module.code}</Text>
              <Text variant="heading" numberOfLines={1}>{module.name}</Text>
            </Stack>
            {tracked ? (
              <Ring
                size={54}
                stroke={6}
                label={`${rate}% attended, ${module.requiredAttendance}% required`}
                segments={[{ value: rate / 100, color: ringColor }]}
              >
                <Text variant="caption" weight="bold">{rate}%</Text>
              </Ring>
            ) : null}
            <Text variant="heading" tone="subtle">{open ? '⌃' : '⌄'}</Text>
          </Stack>

          <Stack direction="row" gap={2} wrap>
            <Fact text={`🗓 ${week.sessions.length} class${week.sessions.length === 1 ? '' : 'es'} · ${week.hours}h`} />
            <Fact text={`${DRAIN[module.dread].word}`} tone={drainTone(module.dread)} />
            {term ? <Fact text={`Week ${term.week} of ${term.weeks}`} /> : null}
            {status === 'below' ? <Fact text={`Below ${module.requiredAttendance}%`} tone="heavy" /> : null}
            {status === 'close' ? <Fact text="1 miss from the line" tone="busy" /> : null}
            {!tracked ? <Fact text="No register" /> : null}
          </Stack>
        </Stack>
      </Pressable>

      {open ? (
        <Stack gap={5} className="border-t border-line-hairline px-4 pb-5 pt-4">
          {/* This week's register: each class signed into once, once it has started. */}
          {tracked ? (
            <Stack gap={2}>
              <Stack direction="row" justify="between" align="center">
                <Text variant="micro" tone="subtle">THIS WEEK’S REGISTER</Text>
                <Text variant="micro" tone="subtle">{module.attended}/{module.held}</Text>
              </Stack>
              {week.sessions.length ? week.sessions.map((session) => {
                const started = hasStarted(session, today, hour);
                return (
                  <Stack key={session.id} direction="row" gap={2} align="center" className="rounded-md bg-sunken py-2 pl-3 pr-2">
                    <Stack gap={1} grow>
                      <Text variant="callout" weight="semibold">{formatShort(session.date).slice(0, 3)} {formatHour(session.startHour ?? 0)}</Text>
                      <Text variant="micro" tone="subtle">{session.sessionKind ?? 'class'}{session.room ? ` · ${session.room}` : ''}</Text>
                    </Stack>
                    {session.outcome === 'done' ? (
                      <Mark label="✓ Signed in" tone="steady" onPress={() => { markItem(session.id, undefined); tapFeedback(); }} />
                    ) : session.outcome === 'missed' ? (
                      <Mark label="✕ Missed" tone="plain" onPress={() => { markItem(session.id, undefined); tapFeedback(); }} />
                    ) : started ? (
                      <>
                        <Mark label="Sign in" tone="action" onPress={() => { markItem(session.id, 'done'); successFeedback(); }} />
                        <Mark label="Missed" tone="plain" onPress={() => { markItem(session.id, 'missed'); tapFeedback(); }} />
                      </>
                    ) : (
                      <Text variant="micro" tone="subtle">Opens {formatShort(session.date).slice(0, 3)}</Text>
                    )}
                  </Stack>
                );
              }) : (
                <Text variant="footnote" tone="muted">No classes this week.</Text>
              )}
              {best !== null ? (
                <Text variant="micro" tone={best < (module.requiredAttendance ?? 0) ? 'heavy' : 'subtle'}>
                  Best you can still finish on: {best}%
                </Text>
              ) : null}
            </Stack>
          ) : null}

          {/* The rest - how long it runs, what it needs, how draining - is set
              once and changed rarely, so it lives on a page of its own. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Change settings for ${module.name}`}
            onPress={() => { tapFeedback(); router.push(`/module/${module.id}` as Href); }}
            className="min-h-row flex-row items-center justify-center gap-2 rounded-pill border-2 border-line-strong bg-raised px-4 py-3 active:opacity-70"
          >
            <Text variant="callout">⚙</Text>
            <Text variant="callout" weight="bold">Change settings</Text>
          </Pressable>
        </Stack>
      ) : null}
    </View>
  );
}

function Fact({ text, tone }: { text: string; tone?: 'steady' | 'busy' | 'heavy' }) {
  const wash = tone === 'heavy' ? 'bg-heavy-wash' : tone === 'busy' ? 'bg-busy-wash' : tone === 'steady' ? 'bg-steady-wash' : 'bg-sunken';
  return (
    <View className={`rounded-pill px-3 py-1 ${wash}`}>
      <Text variant="micro" weight="semibold" tone={tone ?? 'muted'}>{text}</Text>
    </View>
  );
}

function Mark({ label, tone, onPress }: { label: string; tone: 'steady' | 'action' | 'plain'; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label.replace(/^[^\w]+/, '')}
      onPress={onPress}
      className={`min-h-min items-center justify-center rounded-pill px-3 py-2 active:opacity-70 ${
        tone === 'steady' ? 'bg-steady-fill' : tone === 'action' ? 'bg-inverse' : 'border border-line-strong bg-raised'
      }`}
    >
      <Text variant="caption" weight="bold" tone={tone === 'plain' ? 'default' : 'inverse'}>{label}</Text>
    </Pressable>
  );
}
