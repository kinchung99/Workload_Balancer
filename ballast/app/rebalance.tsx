import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Battery, Button, Card, Chip, Divider, PageHeader, Screen, Stack, Text, Toggle, WeekStrip,
} from '@/components';
import { SCREEN } from '@design/screens';
import { bandFor, overallPercent, percentByBucket } from '@/lib/load';
import { CHARGE_LABEL, chargeOf } from '@/lib/battery';
import { applySelection, buildTrades, totalSaved } from '@/lib/rebalance';
import { CLUSTER_MIN_ITEMS, clusterCount, findCollision } from '@/lib/forecast';
import { endHour, formatHour, weekDays } from '@/lib/schedule';
import { formatShort } from '@/lib/dates';
import { successFeedback } from '@/lib/haptics';
import { itemsInWeek, nextWeek, useStore, weekReading } from '@/state/store';
import { useItemsWithLogs } from '@/state/selectors';
import { bestSwap, firstRefusal } from '@/lib/swap';
import { SwapCard } from '@/features/rebalance/SwapCard';

const TONE = { steady: 'steady', busy: 'busy', heavy: 'heavy' } as const;

/**
 * Trading, not deleting.
 *
 * Two things were wrong here. Applying did nothing at all — the selection lived
 * in the screen and the store read a field nobody wrote to — and the screen told
 * you almost nothing about what a trade would actually change. Each row now says
 * which day and hour it touches, the week strip shows the days that get lighter,
 * and the confirmation says whether the wall it was called to fix is still there.
 */
export default function Rebalance() {
  const router = useRouter();
  const { items, ceilings, today, modules, applyTrades, dropSwap } = useStore();
  const withLogs = useItemsWithLogs();

  const anchor = nextWeek(today);
  const week = useMemo(() => itemsInWeek(items, anchor), [items, anchor]);
  const trades = useMemo(() => buildTrades(week), [week]);
  const byId = useMemo(() => Object.fromEntries(items.map((item) => [item.id, item])), [items]);

  const [selected, setSelected] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(trades.map((t) => [t.id, t.selected])),
  );
  const [applied, setApplied] = useState<{
    count: number; saved: number; charge: number; wallGone: boolean; freed: string[]; nextWall: string | null;
  } | null>(null);

  /** The collision this screen was opened to fix, so we can check that one. */
  const target = useMemo(() => findCollision(items, today), [items, today]);

  const before = weekReading(items, anchor, ceilings).overall;
  const afterItems = useMemo(() => applySelection(week, trades, selected), [week, trades, selected]);
  const after = overallPercent(percentByBucket(afterItems, ceilings));
  const saved = totalSaved(trades, selected);
  const chosen = trades.filter((t) => selected[t.id] && !t.locked).length;

  const days = weekDays(anchor);

  /**
   * The trade worth offering, or the reason there is none.
   *
   * Read off the list with logs in it rather than `week`, so a thing you typed
   * in yourself and only have to turn up to can take part in the trade it was
   * rated for.
   */
  const swap = useMemo(() => bestSwap(withLogs, days, modules), [withLogs, days, modules]);
  const refusal = useMemo(
    () => (swap ? null : firstRefusal(withLogs, days, modules)),
    [swap, withLogs, days, modules],
  );
  const previewWeek = useMemo(
    () => [...items.filter((i) => !week.some((w) => w.id === i.id)), ...afterItems],
    [items, week, afterItems],
  );

  /** Which days actually get lighter, and by how much. Ordered by the biggest win. */
  const freed = useMemo(() => {
    const dayOf = (list: typeof items) =>
      Object.fromEntries(days.map((d) => [d, list.filter((i) => i.date === d).reduce((t, i) => t + i.hours, 0)]));
    const now = dayOf(week);
    const next = dayOf(afterItems);
    return days
      .map((d) => ({ date: d, hours: Math.round((now[d] - next[d]) * 10) / 10 }))
      .filter((d) => d.hours > 0.1)
      .sort((a, b) => b.hours - a.hours);
  }, [days, week, afterItems]);

  if (applied) {
    return (
      <Screen
        back="/plan"
        backLabel="Plan"
        footer={
          <>
            <Button label="See the fortnight" onPress={() => router.replace('/plan')} />
            <Button label="Back home" kind="secondary" onPress={() => router.replace('/')} />
          </>
        }
      >
        <Stack gap={6} className="pt-6">
          <Text variant="micro" tone="steady">DONE</Text>
          <Text variant="title" accessibilityRole="header" accessibilityLiveRegion="polite">
            {applied.count} change{applied.count === 1 ? '' : 's'} applied.
          </Text>

          <Card tone="steady" gap={5}>
            <Stack direction="row" gap={5} align="center">
              <Battery
                charge={applied.charge}
                loadPercent={100 - applied.charge}
                width={130}
                height={64}
                label={`Next week now reads ${applied.charge} percent`}
              />
              <Stack gap={1} grow>
                <Text variant="display" tone="steady">{applied.charge}%</Text>
                <Text variant="micro" tone="subtle">of next week left</Text>
              </Stack>
            </Stack>
            <Text variant="callout" tone="muted">You got {applied.saved} load back.</Text>
          </Card>

          {/* The question the whole screen exists to answer. */}
          <Card tone={applied.wallGone ? 'steady' : 'busy'} gap={3}>
            <Text variant="micro" tone={applied.wallGone ? 'steady' : 'busy'}>THE WALL</Text>
            <Text variant="heading">
              {applied.wallGone ? 'Gone. Nothing is clustered now.' : 'Still there, but lighter.'}
            </Text>
            <Text variant="footnote" tone="muted">
              {applied.wallGone
                ? 'That three-day window no longer holds four things.'
                : 'Hard deadlines cannot move. Rebalance again or protect the days around it.'}
            </Text>
            {/* Clearing one pile-up can reveal a smaller one. Say so. */}
            {applied.nextWall ? (
              <Stack gap={2} className="rounded-sm bg-busy-wash px-4 py-3">
                <Text variant="footnote" weight="semibold" tone="busy">Next one down: {applied.nextWall}</Text>
                <Text variant="micro" tone="muted">Smaller, and it was always there — it just was not the worst.</Text>
              </Stack>
            ) : null}
          </Card>

          {applied.freed.length ? (
            <Stack gap={3}>
              <Text variant="micro" tone="subtle">DAYS THAT GOT LIGHTER</Text>
              <Card pad={0} gap={0} className="px-5">
                {applied.freed.map((line, index) => (
                  <Stack key={line}>
                    {index > 0 ? <Divider /> : null}
                    <View className="py-4">
                      <Text variant="body">{line}</Text>
                    </View>
                  </Stack>
                ))}
              </Card>
            </Stack>
          ) : null}

          <Card tone="sunken" gap={2}>
            <Text variant="footnote" weight="semibold">Two messages are drafted and waiting.</Text>
            <Text variant="footnote" tone="muted">Nothing has been sent. You read them first.</Text>
          </Card>
        </Stack>
      </Screen>
    );
  }

  return (
    <Screen
      back="/plan"
      backLabel="Plan"
      footer={
        <>
          <Button
            label={`Apply ${chosen} change${chosen === 1 ? '' : 's'}`}
            onPress={() => {
              const picked = trades.map((t) => ({ ...t, selected: !!selected[t.id] }));
              const nextItems = [...items.filter((i) => !week.some((w) => w.id === i.id)), ...afterItems];
              // Did *this* wall clear, and did another surface elsewhere?
              const stillClustered =
                target !== null && clusterCount(nextItems, target.from, target.to) >= CLUSTER_MIN_ITEMS;
              const elsewhere = findCollision(nextItems, today);
              setApplied({
                count: chosen,
                saved,
                charge: chargeOf(after),
                wallGone: !stillClustered,
                nextWall:
                  !stillClustered && elsewhere && elsewhere.from !== target?.from ? elsewhere.headline : null,
                freed: freed.map((d) => `${formatShort(d.date)} — ${d.hours}h back`),
              });
              applyTrades(picked);
              successFeedback();
            }}
          />
          <Button label="Not this week" kind="secondary" onPress={() => router.back()} />
        </>
      }
    >
      <Stack gap={6} className="pt-4">
        <PageHeader
          {...SCREEN.rebalance}
          eyebrow="Next week"
          title="Something has to come off"
          sub="Toggle a trade and watch the battery move."
        />

        <SwapCard
          swap={swap}
          refusal={refusal}
          onSwap={() => {
            if (!swap) return;
            dropSwap(swap.drop.id);
            successFeedback();
          }}
        />

        <Card gap={5}>
          <Stack direction="row" gap={4} align="center">
            <Text variant="display" tone="subtle" className="line-through">{chargeOf(before)}%</Text>
            <Text variant="display" tone={TONE[bandFor(after)]}>{chargeOf(after)}%</Text>
            <Chip label={CHARGE_LABEL[bandFor(after)]} tone={TONE[bandFor(after)]} readOnly />
          </Stack>
          <Battery
            charge={chargeOf(after)}
            loadPercent={after}
            width={200}
            height={78}
            label={`${chargeOf(after)} percent charge after these changes`}
          />
          <Text
            variant="footnote"
            tone="muted"
            accessibilityLiveRegion="polite"
            accessibilityLabel={`${chosen} changes selected, saving ${saved} load. Charge would go from ${chargeOf(before)} to ${chargeOf(after)} percent.`}
          >
            {chosen} change{chosen === 1 ? '' : 's'} selected, saving {saved} load.
          </Text>
        </Card>

        {/* Which days this actually buys you back. */}
        <Stack gap={3}>
          <Text variant="micro" tone="subtle">NEXT WEEK, IF YOU APPLY</Text>
          <Card gap={4}>
            <WeekStrip items={previewWeek} days={days} today={today} />
            {freed.length ? (
              <Stack direction="row" gap={2} wrap>
                {freed.map((day) => (
                  <Chip key={day.date} label={`${formatShort(day.date)} −${day.hours}h`} tone="steady" readOnly />
                ))}
              </Stack>
            ) : (
              <Text variant="footnote" tone="subtle">Nothing selected, so nothing changes yet.</Text>
            )}
          </Card>
        </Stack>

        <Stack gap={3}>
          <Text variant="micro" tone="subtle">WHAT YOU COULD PUT DOWN</Text>
          <Card pad={0} gap={0} className="px-5">
            {trades.map((trade, index) => {
              const item = byId[trade.itemId.split(',')[0]];
              return (
                <Stack key={trade.id}>
                  {index > 0 ? <Divider /> : null}
                  <Stack direction="row" gap={4} align="center" justify="between" className="min-h-row py-4">
                    <Stack gap={2} grow>
                      <Text variant="body" weight="semibold">{trade.title}</Text>
                      {/* When it is, so a trade is a decision about a real day. */}
                      {item ? (
                        <Text variant="micro" tone="subtle">
                          {formatShort(item.date)}
                          {item.startHour !== undefined
                            ? ` · ${formatHour(item.startHour)}–${formatHour(endHour(item))}`
                            : ' · no slot yet'}
                        </Text>
                      ) : null}
                      <Text variant="footnote" tone={trade.locked ? 'subtle' : 'muted'}>{trade.detail}</Text>
                    </Stack>
                    <Toggle
                      label={trade.title}
                      state={
                        trade.locked ? 'locked'
                        : trade.protected && !selected[trade.id] ? 'protected'
                        : selected[trade.id] ? 'on' : 'off'
                      }
                      onPress={() => setSelected((prev) => ({ ...prev, [trade.id]: !prev[trade.id] }))}
                    />
                  </Stack>
                </Stack>
              );
            })}
          </Card>
        </Stack>

        {chosen > 0 ? (
          <Card tone="recovery" gap={2}>
            <Text variant="callout">
              <Text variant="callout" weight="semibold" tone="recovery">Wednesday evening opens up.</Text>{' '}
              <Text variant="callout" tone="muted">Your first free evening in eleven days.</Text>
            </Text>
          </Card>
        ) : null}

        <Text variant="footnote" tone="subtle">Drafts the messages. Never sends them.</Text>
        <View className="h-2" />
      </Stack>
    </Screen>
  );
}
