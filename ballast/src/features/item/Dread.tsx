import { useRef } from 'react';
import { View } from 'react-native';
import { Card, DreadSlider, Stack, Text } from '@/components';
import { formatShort, isSameWeek, startOfWeek } from '@/lib/dates';
import { loadOf } from '@/lib/load';
import { tapFeedback } from '@/lib/haptics';
import { useStore } from '@/state/store';
import { readingFrom } from '@/state/selectors';
import type { Dread, Item } from '@/lib/types';

/**
 * How much you mind it - and, now, what that does.
 *
 * "Changing this re-prices the whole week" was a promise the screen never
 * showed being kept. The two tiles under the slider keep it: this task's load
 * and the week's battery, each against what it was when you opened the page.
 */
export function DreadCard({ item, items }: { item: Item; items: Item[] }) {
  const { setDread, ceilings, today } = useStore();
  // What it was when you arrived, so every change reads as a change.
  const opened = useRef(item.dread).current;

  const anchor = item.deadline ?? item.date;
  const asOpened = items.map((i) =>
    i.id === item.id || (i.parentId === item.id && !i.sessionDone) ? { ...i, dread: opened } : i,
  );
  const chargeNow = readingFrom(items, anchor, ceilings).charge;
  const chargeThen = readingFrom(asOpened, anchor, ceilings).charge;
  const loadNow = loadOf(item);
  const loadThen = loadOf({ ...item, dread: opened });
  const week = isSameWeek(anchor, today) ? 'THIS WEEK' : `WEEK OF ${formatShort(startOfWeek(anchor)).toUpperCase()}`;

  return (
    <Card gap={4}>
      <Stack gap={2}>
        <Text variant="heading">How much are you dreading it?</Text>
        <Text variant="footnote" tone="muted">Changing this re-prices the whole week.</Text>
      </Stack>
      <DreadSlider value={item.dread} onChange={(next: Dread) => { setDread(item.id, next); tapFeedback(); }} />
      <Stack direction="row" gap={3}>
        <Tile label="THIS TASK" value={`${loadNow} load`} was={`${loadThen}`} delta={Math.round((loadNow - loadThen) * 10) / 10} worseWhen="up" />
        <Tile label={`${week} · BATTERY`} value={`${chargeNow}%`} was={`${chargeThen}%`} delta={chargeNow - chargeThen} unit="%" worseWhen="down" />
      </Stack>
    </Card>
  );
}

/** A reading and how far it has moved since you opened the page. */
function Tile({
  label, value, was, delta, unit = '', worseWhen,
}: {
  label: string;
  value: string;
  was: string;
  delta: number;
  unit?: string;
  /** Load going up is bad; battery going down is bad. */
  worseWhen: 'up' | 'down';
}) {
  const worse = worseWhen === 'up' ? delta > 0 : delta < 0;
  const box = delta === 0 ? 'bg-sunken' : worse ? 'bg-heavy-wash' : 'bg-steady-wash';
  return (
    <View className={`flex-1 gap-1 rounded-md px-3 py-3 ${box}`}>
      <Text variant="micro" tone="subtle">{label}</Text>
      <Text variant="heading">{value}</Text>
      <Text variant="micro" tone={delta === 0 ? 'subtle' : worse ? 'heavy' : 'steady'}>
        {delta === 0 ? 'NO CHANGE' : `${delta > 0 ? '▲' : '▼'} ${Math.abs(delta)}${unit} · WAS ${was}`}
      </Text>
    </View>
  );
}
