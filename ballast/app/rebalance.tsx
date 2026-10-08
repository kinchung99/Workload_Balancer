import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Battery, Button, Card, Disclosure, Mascot, PageHeader, Screen, Section, Stack, Text,
} from '@/components';
import { color, radius } from '@design/tokens';
import { SCREEN } from '@design/screens';
import { bandFor, capacityOf, loadOf, overallOf } from '@/lib/load';
import { chargeOf } from '@/lib/battery';
import { applySelection, buildTrades } from '@/lib/rebalance';
import { CLUSTER_MIN_ITEMS, clusterCount, findCollision } from '@/lib/forecast';
import { DAY_LETTER, dayIndex, formatShort } from '@/lib/dates';
import { formatHour, weekDays } from '@/lib/schedule';
import { SPEND, spendKey } from '@/lib/breakdown';
import { itemsInWeek, nextWeek, useStore, weekReading } from '@/state/store';
import { useItemsWithLogs } from '@/state/selectors';
import { bestSwap, firstRefusal } from '@/lib/swap';
import { countedOnce } from '@/lib/prep';
import { SwapCard } from '@/features/rebalance/SwapCard';
import { api } from '@/lib/api';
import { rebalanceContext } from '@/lib/coach';
import { successFeedback, tapFeedback } from '@/lib/haptics';
import { useAiAnswer } from '@/lib/ai';
import type { Item, Trade } from '@/lib/types';

const TONE = { steady: 'steady', busy: 'busy', heavy: 'heavy' } as const;

/** "Ask Jo to take it, saves 14" → "Ask Jo to take it": the action, not the arithmetic. */
const actionOf = (trade: Trade): string => trade.detail.replace(/,?\s*saves\s+[\d.]+$/, '');

/**
 * Lighten next week - trading, not deleting.
 *
 * One picture first: next week's battery now, and after what you pick, with
 * the seven days underneath showing which ones get lighter. Then the things
 * you could put down, each a card you tap, each wearing the battery it gives
 * back. Hard deadlines cannot move, so they are folded away at the bottom
 * rather than taking up the list.
 */
export default function Rebalance() {
  const router = useRouter();
  const { items, ceilings, today, modules, applyTrades, dropSwap } = useStore();
  const withLogs = useItemsWithLogs();
  const capacity = capacityOf(ceilings);
  const pct = (load: number) => (load / capacity) * 100;

  const anchor = nextWeek(today);
  const week = useMemo(() => itemsInWeek(countedOnce(items), anchor), [items, anchor]);
  const trades = useMemo(() => buildTrades(week), [week]);
  const byId = useMemo(() => Object.fromEntries(items.map((item) => [item.id, item])), [items]);

  const [selected, setSelected] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(trades.map((t) => [t.id, t.selected])),
  );
  const [applied, setApplied] = useState<{
    count: number; charge: number; gain: number; wallGone: boolean; freed: Array<{ date: string; percent: number }>; nextWall: string | null;
  } | null>(null);

  /** The collision this screen was opened to fix, so we can check that one. */
  const target = useMemo(() => findCollision(items, today), [items, today]);

  const before = weekReading(items, anchor, ceilings).overall;
  const afterItems = useMemo(() => applySelection(week, trades, selected), [week, trades, selected]);
  const after = overallOf(afterItems, ceilings);
  const gain = chargeOf(after) - chargeOf(before);
  const chosen = trades.filter((t) => selected[t.id] && !t.locked).length;
  const open = trades.filter((t) => !t.locked);
  const locked = trades.filter((t) => t.locked);

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

  /*
   * The trades are the app's, priced from your week. The AI says, for each, what
   * putting it down buys or why it should stay, picks which to take, and gives
   * the swap its reason - and its picks become the starting selection until you
   * tap a card yourself.
   */
  const touched = useRef(false);
  const advice = useAiAnswer(
    trades.length ? `rebalance:${anchor}:${trades.map((t) => t.id).join(',')}:${swap ? swap.drop.id : ''}` : null,
    async () => {
      const res = await api.suggestRebalance(rebalanceContext(trades, byId, chargeOf(before), swap
        ? { keep: swap.keep.title, drop: swap.drop.title, day: formatShort(swap.date) }
        : undefined));
      return res.ok && res.data.picks.length ? res.data : null;
    },
  );
  useEffect(() => {
    if (!advice || touched.current) return;
    setSelected(Object.fromEntries(trades.map((t) => [
      t.id, !t.locked && !!advice.picks.find((pick) => pick.id === t.id)?.take,
    ])));
  }, [advice, trades]);
  const aiWhy = (id: string): string | undefined => advice?.picks.find((pick) => pick.id === id)?.why;

  /** Each day's cost to the battery, now and after the picks. */
  const dayCost = useMemo(() => {
    const of = (list: Item[]) =>
      Object.fromEntries(days.map((d) => [d, pct(list.filter((i) => i.date === d).reduce((t, i) => t + loadOf(i), 0))]));
    return { now: of(week), next: of(afterItems) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, week, afterItems, capacity]);
  const freed = days
    .map((date) => ({ date, percent: Math.round(dayCost.now[date] - dayCost.next[date]) }))
    .filter((day) => day.percent >= 1);

  const toggle = (trade: Trade) => {
    tapFeedback();
    touched.current = true;
    setSelected((prev) => ({ ...prev, [trade.id]: !prev[trade.id] }));
  };

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
        <Stack gap={5} className="pt-6">
          {/* The win, as a face and a number. */}
          <Card tone="steady" gap={3} align="center">
            <Mascot charge={applied.charge} loadPercent={100 - applied.charge} size={120} />
            <Text variant="hero" tone="steady" accessibilityLiveRegion="polite">{applied.charge}%</Text>
            <View className="rounded-pill px-4 py-1" style={{ backgroundColor: color.band.steady.fill }}>
              <Text variant="callout" weight="bold" tone="inverse">⚡ +{applied.gain}% next week</Text>
            </View>
          </Card>

          {/* Did the pile-up it was opened for go? */}
          <Card tone={applied.wallGone ? 'steady' : 'busy'} gap={2}>
            <Stack direction="row" gap={3} align="center">
              <Text variant="title">{applied.wallGone ? '✅' : '⚠️'}</Text>
              <Text variant="heading" className="flex-1">
                {applied.wallGone ? 'Pile-up cleared' : 'Lighter, still busy'}
              </Text>
            </Stack>
            {applied.nextWall ? <Text variant="footnote" tone="busy">Next one: {applied.nextWall}</Text> : null}
          </Card>

          {applied.freed.length ? (
            <Stack direction="row" gap={2} wrap>
              {applied.freed.map((day) => (
                <View key={day.date} className="rounded-pill px-3 py-2" style={{ backgroundColor: color.band.steady.wash }}>
                  <Text variant="caption" weight="bold" tone="steady">{formatShort(day.date)} · +{day.percent}%</Text>
                </View>
              ))}
            </Stack>
          ) : null}
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
            label={chosen ? `Apply ${chosen} · ⚡ +${gain}%` : 'Pick something to put down'}
            kind={chosen ? 'primary' : 'secondary'}
            accessibilityState={{ disabled: !chosen }}
            onPress={() => {
              if (!chosen) return;
              const picked = trades.map((t) => ({ ...t, selected: !!selected[t.id] }));
              const nextItems = [...items.filter((i) => !week.some((w) => w.id === i.id)), ...afterItems];
              // Did *this* wall clear, and did another surface elsewhere?
              const stillClustered =
                target !== null && clusterCount(nextItems, target.from, target.to) >= CLUSTER_MIN_ITEMS;
              const elsewhere = findCollision(nextItems, today);
              setApplied({
                count: chosen,
                charge: chargeOf(after),
                gain,
                wallGone: !stillClustered,
                nextWall:
                  !stillClustered && elsewhere && elsewhere.from !== target?.from ? elsewhere.headline : null,
                freed,
              });
              applyTrades(picked);
              successFeedback();
            }}
          />
          <Button label="Not this week" kind="quiet" onPress={() => (router.canGoBack() ? router.back() : router.replace('/plan'))} />
        </>
      }
    >
      <Stack gap={5} className="pt-2">
        <PageHeader
          {...SCREEN.rebalance}
          eyebrow="Next week"
          title="Lighten next week"
          sub={advice ? `✨ ${advice.headline}` : undefined}
        />

        {/* Now → after, and the seven days it buys back. */}
        <Card gap={4}>
          <Stack direction="row" align="center" justify="between">
            <Gauge label="NOW" charge={chargeOf(before)} overall={before} faded />
            <Stack gap={1} align="center">
              <View className="rounded-pill px-3 py-1" style={{ backgroundColor: gain > 0 ? color.band.steady.fill : color.surface.sunken }}>
                <Text variant="callout" weight="bold" tone={gain > 0 ? 'inverse' : 'subtle'}>+{gain}%</Text>
              </View>
              <Text variant="title" tone="subtle">→</Text>
            </Stack>
            <Gauge label="AFTER" charge={chargeOf(after)} overall={after} />
          </Stack>
          <WeekBars days={days} now={dayCost.now} next={dayCost.next} />
        </Card>

        <SwapCard
          swap={swap}
          refusal={refusal}
          why={advice?.swap}
          capacity={capacity}
          onSwap={() => {
            if (!swap) return;
            dropSwap(swap.drop.id);
            successFeedback();
          }}
        />

        {/* What could come off: one card each, tap to put it down. */}
        {open.length ? (
          <Section family="focus" title="Put down" sticker="scales" meta={`${chosen} of ${open.length}`}>
            {open.map((trade) => (
              <TradeCard
                key={trade.id}
                trade={trade}
                item={byId[trade.itemId.split(',')[0]]}
                on={!!selected[trade.id]}
                percent={pct(trade.saves)}
                why={aiWhy(trade.id)}
                onPress={() => toggle(trade)}
              />
            ))}
          </Section>
        ) : null}

        {/* Hard deadlines: named, never offered. */}
        {locked.length ? (
          <Disclosure lead="🔒" title={`${locked.length} can’t move`} summary="Hard deadlines">
            <Stack gap={2}>
              {locked.map((trade) => (
                <Stack key={trade.id} direction="row" gap={3} align="center">
                  <Text variant="callout">{SPEND[spendKey(byId[trade.itemId.split(',')[0]] ?? ({} as Item))]?.emoji ?? '📌'}</Text>
                  <Text variant="body" className="flex-1" numberOfLines={1}>{trade.title}</Text>
                </Stack>
              ))}
            </Stack>
          </Disclosure>
        ) : null}

        <View className="h-2" />
      </Stack>
    </Screen>
  );
}

/** One battery, a word over it and its number under it. */
function Gauge({ label, charge, overall, faded = false }: { label: string; charge: number; overall: number; faded?: boolean }) {
  return (
    <Stack gap={1} align="center" style={{ opacity: faded ? 0.55 : 1 }}>
      <Text variant="micro" tone="subtle">{label}</Text>
      <Battery charge={charge} loadPercent={overall} width={92} height={46} label={`${label.toLowerCase()} ${charge} percent`} />
      <Text variant="title" tone={TONE[bandFor(overall)]}>{charge}%</Text>
    </Stack>
  );
}

/** Seven columns: each day's cost, with what the picks take off it in green. */
function WeekBars({ days, now, next }: { days: string[]; now: Record<string, number>; next: Record<string, number> }) {
  const tallest = Math.max(1, ...days.map((d) => now[d]));
  const HEIGHT = 64;
  return (
    <Stack direction="row" gap={2} align="end">
      {days.map((date) => {
        const freed = Math.round(now[date] - next[date]);
        const keep = (next[date] / tallest) * HEIGHT;
        const off = Math.max(0, ((now[date] - next[date]) / tallest) * HEIGHT);
        return (
          <Stack key={date} gap={1} align="center" className="flex-1" accessible accessibilityLabel={`${formatShort(date)}: ${freed >= 1 ? `${freed} percent lighter` : 'unchanged'}`}>
            <Text variant="micro" tone="steady" style={{ opacity: freed >= 1 ? 1 : 0 }}>+{Math.max(0, freed)}</Text>
            <View className="w-full justify-end overflow-hidden" style={{ height: HEIGHT, borderRadius: radius.sm, backgroundColor: color.surface.sunken }}>
              {off > 0 ? <View style={{ height: off, backgroundColor: color.band.steady.wash, borderWidth: 1.5, borderStyle: 'dashed', borderColor: color.band.steady.fill }} /> : null}
              <View style={{ height: keep, backgroundColor: color.band.busy.fill }} />
            </View>
            <Text variant="micro" tone="muted">{DAY_LETTER[dayIndex(date)]}</Text>
          </Stack>
        );
      })}
    </Stack>
  );
}

/** One thing that could come off, as a card: tap to put it down. */
function TradeCard({
  trade, item, on, percent, why, onPress,
}: { trade: Trade; item?: Item; on: boolean; percent: number; why?: string; onPress: () => void }) {
  const info = item ? SPEND[spendKey(item)] : SPEND.errand;
  // Putting down rest costs battery rather than giving it back: say so in red.
  const value = Math.round(percent);
  const costs = value < 0;
  const accent = costs ? color.band.heavy : color.band.steady;
  const when = item ? `${formatShort(item.date)}${item.startHour !== undefined ? ` · ${formatHour(item.startHour)}` : ''}` : '';
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      accessibilityLabel={`${trade.title}. ${actionOf(trade)}. ${costs ? `Costs ${-value}` : `Gives back ${Math.max(1, value)}`} percent.`}
      onPress={onPress}
      className="rounded-xl border-2 px-4 py-3 active:opacity-80"
      style={{
        borderColor: on ? accent.fill : color.line.hairline,
        backgroundColor: on ? accent.wash : color.surface.raised,
      }}
    >
      <Stack direction="row" gap={3} align="center">
        <View className="items-center justify-center rounded-pill bg-raised" style={{ width: 44, height: 44 }}>
          <Text variant="title">{trade.protected ? '🌿' : info.emoji}</Text>
        </View>
        <Stack gap={1} grow>
          <Text variant="body" weight="semibold" numberOfLines={1}>{trade.title}</Text>
          <Text variant="micro" tone="subtle" numberOfLines={1}>{[when, actionOf(trade)].filter(Boolean).join(' · ')}</Text>
          {why ? <Text variant="footnote" tone="muted" numberOfLines={2}>✨ {why}</Text> : null}
        </Stack>
        <Stack gap={2} align="center">
          <Text variant="heading" tone={costs ? 'heavy' : 'steady'}>{costs ? `−${-value}` : `+${Math.max(1, value)}`}%</Text>
          <View
            className="items-center justify-center rounded-pill"
            style={{
              width: 26, height: 26,
              backgroundColor: on ? accent.fill : color.surface.raised,
              borderWidth: 2, borderColor: on ? accent.fill : color.line.strong,
            }}
          >
            {on ? <Text variant="micro" tone="inverse">✓</Text> : null}
          </View>
        </Stack>
      </Stack>
    </Pressable>
  );
}
