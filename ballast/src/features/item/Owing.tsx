import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Chip, Ring, Slider, Stack, Sticker, Text } from '@/components';
import { color, radius } from '@design/tokens';
import { formatShort } from '@/lib/dates';
import { daysLeft, isAtRisk, remaining, scheduledHours, unplanned } from '@/lib/prep';
import { durationLabel } from '@/lib/sittings';
import { successFeedback, tapFeedback } from '@/lib/haptics';
import { useStore } from '@/state/store';
import type { Item } from '@/lib/types';
import { Cheer } from './Cheer';

/**
 * Where a piece of work stands: done, booked, loose, as one ring.
 *
 * Same three numbers the bar always showed, and the same colours - steady for
 * done, blue for booked, bare track for loose - drawn big enough to read before
 * anything else on the screen.
 */
export function OwingSummary({ item, items, today }: { item: Item; items: Item[]; today: string }) {
  const total = item.prepHours ?? 0;
  const done = item.prepDone ?? 0;
  const booked = scheduledHours(item, items);
  const loose = unplanned(item, items);
  const left = daysLeft(item, today);
  const risk = isAtRisk(item, items, today);
  const percent = total ? Math.round((done / total) * 100) : 0;

  return (
    <Card tone={risk ? 'heavy' : 'plain'} gap={4}>
      <Stack direction="row" gap={5} align="center">
        <Ring
          label={`${percent}% done. ${done} hours done, ${booked} booked, ${loose} loose.`}
          segments={[
            { value: total ? done / total : 0, color: color.band.steady.fill },
            { value: total ? booked / total : 0, color: color.band.recovery.fill },
          ]}
        >
          <Text variant="title">{percent}%</Text>
          <Text variant="micro" tone="subtle">DONE</Text>
        </Ring>
        <Stack gap={2} grow>
          <Text variant="heading">{remaining(item)}h still to do</Text>
          <Legend fill={color.band.steady.fill} label={`${done}h done`} />
          <Legend fill={color.band.recovery.fill} label={`${booked}h booked`} />
          <Legend fill={color.surface.track} label={`${loose}h loose`} />
        </Stack>
      </Stack>
      <Stack direction="row" gap={2} wrap>
        <Chip label={left === 0 ? 'Due today' : `${left} day${left === 1 ? '' : 's'} left`} tone={left <= 1 ? 'heavy' : 'busy'} readOnly />
        <Chip label={`Due ${formatShort(item.deadline ?? item.date)}`} readOnly />
      </Stack>
      {risk ? (
        <Text variant="footnote" tone="heavy">Not enough free time left. Something has to move.</Text>
      ) : null}
    </Card>
  );
}

function Legend({ fill, label }: { fill: string; label: string }) {
  return (
    <Stack direction="row" gap={2} align="center">
      <View style={{ width: 10, height: 10, borderRadius: radius.pill, backgroundColor: fill }} />
      <Text variant="footnote" tone="muted">{label}</Text>
    </Stack>
  );
}

/**
 * "Did some without booking it?", as a slider rather than three chips.
 *
 * The chips offered +30m, +1h and +2h and nothing in between, logged on the
 * first tap with no way to see what it would do. Now you slide to what you did,
 * watch the bar fill with it, and log it once it is right - or take the whole
 * rest in one tap when it is finished.
 */
export function LogTime({ item }: { item: Item }) {
  const { logUnbookedHours } = useStore();
  const left = remaining(item);
  const top = Math.max(0.5, Math.floor(left * 2) / 2);
  const [hours, setHours] = useState(Math.min(1, top));
  const [cheer, setCheer] = useState<{ id: number; title: string; sub: string } | null>(null);

  useEffect(() => {
    if (!cheer) return;
    const timer = setTimeout(() => setCheer(null), 2800);
    return () => clearTimeout(timer);
  }, [cheer]);

  const value = Math.min(hours, left);
  const total = item.prepHours ?? 0;
  const done = item.prepDone ?? 0;
  const before = total ? Math.round((done / total) * 100) : 0;
  const after = total ? Math.round(((done + value) / total) * 100) : 0;
  const quick = [0.5, 1, 2].filter((h) => h < left);

  const log = (amount: number) => {
    if (amount <= 0) return;
    logUnbookedHours(item.id, amount);
    successFeedback();
    const rest = Math.max(0, Math.round((left - amount) * 10) / 10);
    setCheer({ id: Date.now(), title: `+${durationLabel(amount)} on the bar`, sub: rest ? `${durationLabel(rest)} to go` : 'All done.' });
    setHours(Math.min(1, Math.max(0.5, Math.floor(rest * 2) / 2)));
  };

  return (
    <Card gap={4}>
      <Stack direction="row" gap={3} align="center">
        <View className="items-center justify-center rounded-pill" style={{ width: 48, height: 48, backgroundColor: color.decor.lemon }}>
          <Sticker name="clock" size={32} />
        </View>
        <Stack gap={1} grow>
          <Text variant="heading">Did some without booking it?</Text>
          <Text variant="footnote" tone="muted">Slide to what you did.</Text>
        </Stack>
      </Stack>

      {cheer ? <Cheer key={cheer.id} title={cheer.title} sub={cheer.sub} /> : null}

      <Stack direction="row" align="end" justify="between">
        <Text variant="display" accessibilityLiveRegion="polite">{durationLabel(value)}</Text>
        <Stack direction="row" gap={2} align="center" className="pb-2">
          <Text variant="body" tone="subtle">{before}%</Text>
          <Text variant="body" tone="subtle">→</Text>
          <Text variant="heading" tone="steady">{after}%</Text>
        </Stack>
      </Stack>

      {/* The bar as it would be: what is done, then what you are about to add. */}
      <View className="h-4 w-full flex-row overflow-hidden rounded-pill bg-track">
        <View style={{ flexGrow: done || 0.0001, backgroundColor: color.band.steady.fill }} />
        <View style={{ flexGrow: value || 0.0001, backgroundColor: color.band.steady.fill, opacity: 0.4 }} />
        <View style={{ flexGrow: Math.max(0, total - done - value) || 0.0001 }} />
      </View>

      {left >= 0.5 ? (
        <Slider
          value={Math.min(value, top)}
          min={0.5}
          max={top}
          step={0.5}
          tone="steady"
          label="Hours you did without booking"
          readout={durationLabel(value)}
          onChange={setHours}
        />
      ) : null}

      <Stack direction="row" gap={2} wrap>
        {quick.map((h) => (
          <Chip key={h} label={durationLabel(h)} tone={h === value ? 'selected' : 'plain'} onPress={() => { tapFeedback(); setHours(h); }} />
        ))}
        <Chip label={`All of it · ${durationLabel(left)}`} tone={value === left ? 'selected' : 'steady'} onPress={() => { tapFeedback(); setHours(left); }} />
      </Stack>

      <Button label={value === left ? `Log ${durationLabel(value)} · finish it` : `Log ${durationLabel(value)}`} kind="steady" onPress={() => log(value)} />
    </Card>
  );
}
