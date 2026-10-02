/**
 * The sheet a block opens: one question, asked the way this kind of thing
 * needs it asked.
 *
 * A class asks whether you signed in, and moves its module's register by one
 * session. A sitting asks how much got done, and moves its work forward by that
 * share. An errand asks done or move it. Under every one, the same row of faces
 * asks how draining it was. Big buttons, one tap each - the whole point is that
 * answering is quicker than ignoring.
 */
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, MarkBadge, Stack, Text } from '@/components';
import { DrainFace } from '@/components/primitives/AreaDial';
import { color, radius } from '@design/tokens';
import { DRAIN, drainTone } from '@/lib/drain';
import { addDays, formatShort } from '@/lib/dates';
import { formatHour, startOptions } from '@/lib/schedule';
import { remaining } from '@/lib/prep';
import { attendanceRate } from '@/lib/timetable';
import { successFeedback, tapFeedback } from '@/lib/haptics';
import {
  KIND, canMark, clockHour, markKind, markStatus, outcomeOf, outcomeWord,
} from '@/lib/marking';
import { useStore } from '@/state/store';
import { ProgressPicker } from './ProgressPicker';
import type { Dread, Item, Outcome } from '@/lib/types';


export function MarkSheet({ itemId, onClose }: { itemId: string | null; onClose: () => void }) {
  const router = useRouter();
  const { items, modules, today, markItem, setDread, moveItem, scheduleItem } = useStore();
  const item = items.find((candidate) => candidate.id === itemId) ?? null;

  return (
    <Modal visible={!!item} transparent animationType="slide" onRequestClose={onClose}>
      <View style={StyleSheet.absoluteFill}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={onClose}
          style={[StyleSheet.absoluteFill, { backgroundColor: color.ink.default, opacity: 0.35 }]}
        />
        {item ? (
          <View className="mt-auto w-full max-w-frame self-center bg-page px-5 pb-8 pt-3" style={{ borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl }}>
            <Body
              item={item}
              parent={item.parentId ? items.find((candidate) => candidate.id === item.parentId) : undefined}
              moduleRate={item.moduleId ? attendanceRateOf(modules, item.moduleId) : null}
              today={today}
              onMark={(outcome, fraction) => { markItem(item.id, outcome, fraction); successFeedback(); }}
              onDread={(level) => { setDread(item.id, level); tapFeedback(); }}
              onMove={(date) => { moveItem(item.id, date); markItem(item.id, undefined); successFeedback(); onClose(); }}
              times={startOptions(items, item.date, item.hours, 12).filter((h) => item.date !== today || h >= Math.ceil(clockHour(today)))}
              onPlan={(hour) => { scheduleItem(item.id, hour); successFeedback(); onClose(); }}
              onDetails={() => { onClose(); router.push(`/item/${item.parentId ?? item.id}`); }}
              onClose={onClose}
            />
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const attendanceRateOf = (modules: ReturnType<typeof useStore.getState>['modules'], id: string): string | null => {
  const module = modules.find((m) => m.id === id);
  if (!module) return null;
  return module.requiredAttendance === null
    ? `${module.name} · no register`
    : `${module.name} · ${module.attended}/${module.held} · ${attendanceRate(module)}%`;
};

function Body({
  item, parent, moduleRate, today, onMark, onDread, onMove, onDetails, onClose, times, onPlan,
}: {
  item: Item;
  parent?: Item;
  moduleRate: string | null;
  today: string;
  onMark: (outcome: Outcome | undefined, fraction?: number) => void;
  onDread: (level: Dread) => void;
  onMove: (date: string) => void;
  onDetails: () => void;
  onClose: () => void;
  /** Free start times on its day, for something with no time yet. */
  times: number[];
  onPlan: (hour: number) => void;
}) {
  const kind = markKind(item);
  const info = KIND[kind];
  const hour = clockHour(today);
  const status = markStatus(item, today, hour);
  const outcome = outcomeOf(item);
  const open = canMark(item, today, hour);
  const share = outcome === 'done' ? 1 : outcome === 'missed' ? 0 : outcome === 'partial' ? item.fraction ?? 0.5 : null;
  // Something with no time yet is planned first; "done" is the second option.
  const unplanned = item.startHour === undefined && !outcome && kind !== 'sitting' && kind !== 'class';
  const when = item.startHour !== undefined
    ? `${formatHour(item.startHour)}–${formatHour(item.startHour + item.hours)}`
    : 'Any time';

  return (
    <Stack gap={5}>
      <View className="h-1 w-10 self-center rounded-pill bg-track" />

      {/* What it is. */}
      <Stack direction="row" gap={3} align="center">
        <View className="items-center justify-center rounded-pill bg-sunken" style={{ width: 52, height: 52 }}>
          <Text variant="title">{info.emoji}</Text>
        </View>
        <Stack gap={1} grow>
          <Text variant="heading" numberOfLines={2}>{item.title}</Text>
          <Text variant="micro" tone="muted">
            {item.date === today ? 'Today' : formatShort(item.date)} · {when}{item.room ? ` · ${item.room}` : ''}
          </Text>
        </Stack>
        <MarkBadge status={status} word={outcomeWord(item)} auto={item.autoMarked} />
      </Stack>

      {unplanned ? (
        <Stack gap={3}>
          <Text variant="title">When will you do it?</Text>
          {times.length ? (
            <Stack direction="row" gap={2} wrap>
              {times.map((hour) => (
                <Pressable
                  key={hour}
                  accessibilityRole="button"
                  accessibilityLabel={`Plan it for ${formatHour(hour)}`}
                  onPress={() => onPlan(hour)}
                  className="min-h-min items-center justify-center rounded-pill border-2 border-line-hairline bg-raised px-4 py-2 active:opacity-70"
                >
                  <Text variant="callout" weight="semibold">🕒 {formatHour(hour)}</Text>
                </Pressable>
              ))}
            </Stack>
          ) : (
            <Text variant="footnote" tone="muted">No free time left {item.date === today ? 'today' : `on ${formatShort(item.date)}`}.</Text>
          )}
          <Stack direction="row" gap={2} wrap>
            {[1, 2, 3].map((offset) => {
              const date = addDays(item.date > today ? item.date : today, offset);
              return (
                <Pressable
                  key={date}
                  accessibilityRole="button"
                  accessibilityLabel={`Move it to ${formatShort(date)}`}
                  onPress={() => onMove(date)}
                  className="min-h-min flex-row items-center gap-1 rounded-pill bg-sunken px-4 py-2 active:opacity-70"
                >
                  <Text variant="callout" tone="muted">↪ {offset === 1 ? 'Tomorrow' : formatShort(date).slice(0, 3)}</Text>
                </Pressable>
              );
            })}
          </Stack>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Done without planning"
            onPress={() => onMark('done')}
            className="min-h-row flex-row items-center justify-center gap-2 rounded-lg border-2 border-steady-fill bg-steady-wash px-3 py-3 active:opacity-70"
          >
            <Text variant="callout" weight="bold" tone="steady">✓ Done without planning</Text>
          </Pressable>
        </Stack>
      ) : (
      <Stack gap={3}>
        <Text variant="title">{info.question}</Text>

        {!open ? (
          <View className="items-center rounded-lg bg-sunken px-4 py-4">
            <Text variant="callout" tone="muted">Sign-in opens at {formatHour(item.startHour ?? 9)}</Text>
          </View>
        ) : info.answer === 'progress' ? (
          <ProgressPicker
            key={`${item.id}-${outcome ?? 'open'}`}
            hours={item.hours}
            initial={share ?? 0.5}
            onSave={(next) => onMark(next >= 1 ? 'done' : next <= 0 ? 'missed' : 'partial', next)}
          />
        ) : (
          <Stack direction="row" gap={3}>
            <Answer
              icon="✓"
              label={info.yes}
              chosen={outcome === 'done'}
              tone="steady"
              onPress={() => onMark('done')}
            />
            {info.answer === 'errand' ? null : (
              <Answer
                icon="✕"
                label={info.no}
                chosen={outcome === 'missed'}
                tone="heavy"
                onPress={() => onMark('missed')}
              />
            )}
          </Stack>
        )}

        {/* An errand that did not happen goes to another day, not into a void. */}
        {open && info.answer === 'errand' && outcome !== 'done' ? (
          <Stack direction="row" gap={2} wrap>
            {[1, 2, 3].map((offset) => {
              const date = addDays(item.date > today ? item.date : today, offset);
              return (
                <Pressable
                  key={date}
                  accessibilityRole="button"
                  accessibilityLabel={`Move it to ${formatShort(date)}`}
                  onPress={() => onMove(date)}
                  className="min-h-min flex-row items-center gap-1 rounded-pill border-2 border-line-hairline bg-raised px-4 py-2 active:opacity-70"
                >
                  <Text variant="callout">↪</Text>
                  <Text variant="callout" weight="semibold">{offset === 1 ? 'Tomorrow' : formatShort(date).slice(0, 3)}</Text>
                </Pressable>
              );
            })}
          </Stack>
        ) : null}

        {/* What the answer moved. */}
        {moduleRate && outcome ? (
          <Text variant="footnote" tone="muted">📋 {moduleRate}</Text>
        ) : null}
        {parent && outcome ? (
          <Text variant="footnote" tone="muted">
            📈 {parent.title} · {Math.round((1 - remaining(parent) / Math.max(parent.prepHours ?? 1, 0.1)) * 100)}% done overall
          </Text>
        ) : null}
      </Stack>
      )}

      {/* How it felt - the same five faces as everywhere else. */}
      <Stack gap={2}>
        <Text variant="micro" tone="subtle">{unplanned || status === 'later' ? 'HOW DRAINING IS IT?' : 'HOW DRAINING WAS IT?'}</Text>
        <Stack direction="row" justify="between">
          {([1, 2, 3, 4, 5] as const).map((level) => {
            const chosen = item.dread === level;
            return (
              <Pressable
                key={level}
                accessibilityRole="radio"
                accessibilityState={{ selected: chosen }}
                accessibilityLabel={DRAIN[level].word}
                onPress={() => onDread(level)}
                className="min-h-min items-center gap-1 active:opacity-60"
                style={{ width: 60 }}
              >
                <View
                  className="items-center justify-center rounded-pill"
                  style={{
                    width: 44, height: 44,
                    backgroundColor: chosen ? color.band[drainTone(level)].wash : color.surface.sunken,
                    borderWidth: chosen ? 2.5 : 0,
                    borderColor: color.band[drainTone(level)].fill,
                  }}
                >
                  <DrainFace level={level} size={30} />
                </View>
                <Text variant="micro" tone={chosen ? drainTone(level) : 'subtle'}>{DRAIN[level].word}</Text>
              </Pressable>
            );
          })}
        </Stack>
      </Stack>

      <Stack direction="row" gap={3}>
        {outcome ? (
          <Button label="Clear" kind="quiet" className="flex-1" onPress={() => onMark(undefined)} />
        ) : (
          <Button label="Details" kind="secondary" className="flex-1" onPress={onDetails} />
        )}
        <Button label="Done" className="flex-[2]" onPress={onClose} />
      </Stack>
    </Stack>
  );
}

function Answer({ icon, label, chosen, tone, onPress }: {
  icon: string;
  label: string;
  chosen: boolean;
  tone: 'steady' | 'heavy';
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: chosen }}
      accessibilityLabel={label}
      onPress={onPress}
      className={`min-h-row flex-1 flex-row items-center justify-center gap-2 rounded-lg border-2 px-3 py-4 active:opacity-70 ${
        chosen
          ? tone === 'steady' ? 'border-steady-fill bg-steady-fill' : 'border-heavy-fill bg-heavy-fill'
          : tone === 'steady' ? 'border-steady-fill bg-steady-wash' : 'border-line-strong bg-raised'
      }`}
    >
      <Text variant="heading" tone={chosen ? 'inverse' : tone === 'steady' ? 'steady' : 'muted'}>{icon}</Text>
      <Text variant="callout" weight="bold" tone={chosen ? 'inverse' : tone === 'steady' ? 'steady' : 'default'}>{label}</Text>
    </Pressable>
  );
}
