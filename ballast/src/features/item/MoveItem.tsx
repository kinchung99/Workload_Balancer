/**
 * Moving one thing, by looking at the days rather than reading about them.
 *
 * The same picker the sittings use: this week and next, each day with how much
 * of the battery it already takes, a ribbon of the chosen day to drag the block
 * along, and what the move does to that day. Nothing changes until the button
 * says where it is going - and that button names the day and the time.
 *
 * Inline on an item's page, and as a sheet wherever a list offers "Move it", so
 * moving something never means leaving the list it was found in.
 */
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Stack, Text } from '@/components';
import { color, radius } from '@design/tokens';
import { formatShort } from '@/lib/dates';
import { bestStart, bookingDays, sittingStarts } from '@/lib/prep';
import { clockHour } from '@/lib/marking';
import { spanLabel, type Draft } from '@/lib/sittings';
import { successFeedback, tapFeedback } from '@/lib/haptics';
import { useStore } from '@/state/store';
import { useItemsWithLogs } from '@/state/selectors';
import { SittingEditor } from './SittingEditor';
import { CancelTask } from './CancelTask';
import { displacedBy } from '@/lib/replace';
import type { Item } from '@/lib/types';

/** Where it starts in the picker: its own day and time, or the first day and time that fit. */
function startingDraft(item: Item, busy: Item[], today: string, nowHour: number): Draft {
  const days = bookingDays(today);
  const notBefore = (date: string) => (date === today ? nowHour : undefined);
  const own = days.includes(item.date) ? item.date : days[0];
  // Its own time, only while that time is still free: after making room, the old slot is someone else's.
  const keep = own === item.date && item.startHour !== undefined
    && sittingStarts(busy, own, item.hours, notBefore(own)).includes(item.startHour);
  if (keep) return { date: own, hours: item.hours, startHour: item.startHour };
  // Its own day if it has room, otherwise the first day from there that does.
  const from = days.indexOf(own);
  for (const date of [...days.slice(from), ...days.slice(0, from)]) {
    const startHour = bestStart(busy, date, item.hours, notBefore(date));
    if (startHour !== undefined) return { date, hours: item.hours, startHour };
  }
  return { date: own, hours: item.hours, startHour: undefined };
}

export function MoveItem({
  item, onDone, suggest, replace = true,
}: {
  item: Item;
  onDone?: (where: string) => void;
  suggest?: { date: string; startHour: number };
  /** Let it land on a block you could give up, and move that block next. Off when re-homing, so it never chains. */
  replace?: boolean;
}) {
  const { today, moveItem, scheduleItem } = useStore();
  const items = useItemsWithLogs();
  const nowHour = clockHour(today);
  // Everything else in the week: what this has to fit around, and what each day carries without it.
  const busy = items.filter((other) => other.id !== item.id);
  const [origin] = useState<Draft>(() => startingDraft(item, busy, today, nowHour));
  // A suggested lighter slot, when the list that opened this had one.
  const [draft, setDraft] = useState<Draft>(() => (suggest ? { ...origin, ...suggest } : origin));
  // Blocks this pushed out, still to be given a new time - one at a time.
  const [queue, setQueue] = useState<string[]>([]);
  const [placed, setPlaced] = useState<string | null>(null);

  const unchanged = draft.date === item.date && draft.startHour === item.startHour;
  const where = `${formatShort(draft.date)} · ${spanLabel(draft)}`;
  const pushed = replace ? displacedBy(busy, draft) : [];

  const apply = () => {
    if (draft.startHour === undefined) return;
    if (draft.date !== item.date) moveItem(item.id, draft.date);
    scheduleItem(item.id, draft.startHour);
    successFeedback();
    if (pushed.length) {
      setPlaced(where);
      setQueue(pushed.map((block) => block.id));
      return;
    }
    onDone?.(where);
  };

  // Re-homing what was pushed out: the next block in the queue, with its own picker.
  const next = queue.length ? items.find((candidate) => candidate.id === queue[0]) : undefined;
  const advance = () => {
    const rest = queue.slice(1);
    setQueue(rest);
    if (!rest.length) onDone?.(placed ?? where);
  };
  if (placed && next) {
    return (
      <Stack gap={3}>
        <Stack direction="row" gap={2} align="center" className="rounded-md px-3 py-2" style={{ backgroundColor: color.band.steady.wash }}>
          <Text variant="callout">✓</Text>
          <Text variant="footnote" weight="semibold" tone="steady" className="flex-1">{item.title} · {placed}</Text>
        </Stack>
        <Text variant="heading">Now, where does {next.title} go?</Text>
        <MoveItem key={next.id} item={next} replace={false} onDone={advance} />
        <CancelTask item={next} kind="quiet" label="🗑 Drop it instead" onCancelled={advance} />
      </Stack>
    );
  }

  return (
    <Stack gap={3}>
      <SittingEditor
        mode="item"
        item={item}
        busy={busy}
        base={busy}
        today={today}
        nowHour={nowHour}
        value={draft}
        origin={origin}
        maxHours={item.hours}
        onChange={setDraft}
        calendar
        replace={replace}
      />
      <Button
        label={draft.startHour === undefined
          ? 'No gap that long on this day'
          : unchanged
            ? `✓ Already ${where}`
            : pushed.length ? `Put it here · then move ${pushed[0].title}` : `Move it to ${where}`}
        kind={unchanged || draft.startHour === undefined ? 'secondary' : 'primary'}
        disabled={unchanged || draft.startHour === undefined}
        onPress={apply}
      />
    </Stack>
  );
}

/** The same picker, as a sheet over whatever list offered the move. */
export function MoveSheet({ itemId, onClose, suggest }: { itemId: string | null; onClose: () => void; suggest?: { date: string; startHour: number } }) {
  const item = useStore((state) => state.items.find((candidate) => candidate.id === itemId) ?? null);
  const [moved, setMoved] = useState<string | null>(null);
  const close = () => { setMoved(null); onClose(); };

  return (
    <Modal visible={!!itemId} transparent animationType="slide" onRequestClose={close}>
      <View style={StyleSheet.absoluteFill}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={close}
          style={[StyleSheet.absoluteFill, { backgroundColor: color.ink.default, opacity: 0.35 }]}
        />
        {item ? (
          <View
            className="mt-auto w-full max-w-frame self-center bg-page"
            style={{ borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, maxHeight: '92%' }}
          >
            <Stack direction="row" align="center" gap={3} className="px-5 pb-2 pt-4">
              <Stack gap={0} grow>
                <Text variant="micro" tone="muted">MOVE IT</Text>
                <Text variant="heading" numberOfLines={1}>{item.title}</Text>
              </Stack>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close"
                onPress={() => { tapFeedback(); close(); }}
                className="min-h-min min-w-min items-center justify-center rounded-pill bg-sunken active:opacity-60"
              >
                <Text variant="heading">✕</Text>
              </Pressable>
            </Stack>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 28 }}>
              {moved ? (
                <Stack gap={3} className="rounded-lg px-4 py-4" style={{ backgroundColor: color.band.steady.wash }}>
                  <Text variant="heading" tone="steady">✓ Moved to {moved}</Text>
                  <Button label="Done" onPress={close} />
                </Stack>
              ) : (
                <MoveItem key={item.id} item={item} onDone={setMoved} suggest={suggest} />
              )}
            </ScrollView>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

/**
 * After booking work on top of blocks you could give up: each of them, one at
 * a time, with somewhere new to go - or dropped, if it no longer matters.
 */
export function RehomeSheet({ ids, onClose }: { ids: string[]; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const item = useStore((state) => state.items.find((candidate) => candidate.id === ids[index]) ?? null);
  const finish = () => { setIndex(0); onClose(); };
  const advance = () => (index + 1 < ids.length ? setIndex(index + 1) : finish());

  return (
    <Modal visible={ids.length > 0} transparent animationType="slide" onRequestClose={finish}>
      <View style={StyleSheet.absoluteFill}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: color.ink.default, opacity: 0.35 }]} />
        {item ? (
          <View className="mt-auto w-full max-w-frame self-center bg-page" style={{ borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, maxHeight: '92%' }}>
            <Stack gap={0} className="px-5 pb-2 pt-4">
              <Text variant="micro" tone="muted">MADE ROOM · {index + 1} OF {ids.length}</Text>
              <Text variant="heading">Where does {item.title} go now?</Text>
            </Stack>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 28 }}>
              <Stack gap={3}>
                <MoveItem key={item.id} item={item} replace={false} onDone={advance} />
                <CancelTask item={item} kind="quiet" label="🗑 Drop it instead" onCancelled={advance} />
              </Stack>
            </ScrollView>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}
