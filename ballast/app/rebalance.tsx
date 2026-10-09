import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import {
  Battery, Button, Card, Chip, Disclosure, Mascot, PageHeader, Screen, Section, Stack, Text,
} from '@/components';
import { color, radius } from '@design/tokens';
import { SCREEN } from '@design/screens';
import { bandFor, capacityOf, loadOf } from '@/lib/load';
import { chargeOf } from '@/lib/battery';
import { askFor, buildTrades } from '@/lib/rebalance';
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


/**
 * Lighten next week - trading, not deleting, and never in bulk.
 *
 * One picture first: next week's battery before, and now, with the seven days
 * underneath showing which ones got lighter. Then the things you could put
 * down, one at a time: what it is, what it gives back, who should hear first.
 * Write to them, put it down (after one step that says what will happen), or
 * keep it. Hard deadlines cannot move, so they are folded away at the bottom.
 */
export default function Rebalance() {
  const router = useRouter();
  const { items, ceilings, today, modules, applyTrades, dropSwap } = useStore();
  const withLogs = useItemsWithLogs();
  const capacity = capacityOf(ceilings);
  const pct = (load: number) => (load / capacity) * 100;
  const anchor = nextWeek(today);
  const days = weekDays(anchor);

  /*
   * The week as it was when you opened this, and the trades priced from it.
   * Held still while you decide: each one taken changes the week underneath,
   * but the list you are working through should not reshuffle under your thumb.
   */
  const [start] = useState(() => {
    const week = itemsInWeek(countedOnce(items), anchor);
    return {
      week,
      trades: buildTrades(week),
      byId: Object.fromEntries(items.map((item) => [item.id, item])) as Record<string, Item>,
      overall: weekReading(items, anchor, ceilings).overall,
      wall: findCollision(items, today),
    };
  });
  const open = start.trades.filter((t) => !t.locked);
  const locked = start.trades.filter((t) => t.locked);
  const itemOf = (trade: Trade): Item | undefined => start.byId[trade.itemId.split(',')[0]];

  /** What you said to each: put down, or kept. And who you already wrote to. */
  const [decided, setDecided] = useState<Record<string, 'down' | 'kept'>>({});
  const [wrote, setWrote] = useState<Record<string, boolean>>({});
  const [confirming, setConfirming] = useState(false);
  const current = open.find((t) => !decided[t.id]);
  const done = open.filter((t) => decided[t.id]);

  const now = weekReading(items, anchor, ceilings).overall;
  const gain = chargeOf(now) - chargeOf(start.overall);
  const downCount = open.filter((t) => decided[t.id] === 'down').length;

  const swap = useMemo(() => bestSwap(withLogs, days, modules), [withLogs, days, modules]);
  const refusal = useMemo(() => (swap ? null : firstRefusal(withLogs, days, modules)), [swap, withLogs, days, modules]);

  /*
   * The trades are the app's, priced from your week. The AI says, for each,
   * what putting it down buys or why it should stay, and leans one way - shown
   * on the card as a suggestion, never taken for you.
   */
  const advice = useAiAnswer(
    start.trades.length ? `rebalance:${anchor}:${start.trades.map((t) => t.id).join(',')}:${swap ? swap.drop.id : ''}` : null,
    async () => {
      const res = await api.suggestRebalance(rebalanceContext(start.trades, start.byId, chargeOf(start.overall), swap
        ? { keep: swap.keep.title, drop: swap.drop.title, day: formatShort(swap.date) }
        : undefined));
      return res.ok && res.data.picks.length ? res.data : null;
    },
  );
  const pick = (id: string) => advice?.picks.find((p) => p.id === id);

  /** Each day's cost: as it was, and as it is now. */
  const dayCost = useMemo(() => {
    const week = itemsInWeek(countedOnce(items), anchor);
    const of = (list: Item[]) =>
      Object.fromEntries(days.map((d) => [d, pct(list.filter((i) => i.date === d).reduce((t, i) => t + loadOf(i), 0))]));
    return { now: of(start.week), next: of(week) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, items, start.week, capacity]);
  const freed = days
    .map((date) => ({ date, percent: Math.round(dayCost.now[date] - dayCost.next[date]) }))
    .filter((day) => day.percent >= 1);

  const putDown = (trade: Trade) => {
    applyTrades([{ ...trade, selected: true }]);
    setDecided((d) => ({ ...d, [trade.id]: 'down' }));
    setConfirming(false);
    successFeedback();
  };
  const keep = (trade: Trade) => {
    tapFeedback();
    setDecided((d) => ({ ...d, [trade.id]: 'kept' }));
    setConfirming(false);
  };
  const write = (trade: Trade) => {
    tapFeedback();
    setWrote((w) => ({ ...w, [trade.id]: true }));
    router.push(`/decline/${trade.itemId.split(',')[0]}` as Href);
  };

  const finished = open.length > 0 && !current;
  const wallGone = !start.wall || clusterCount(items, start.wall.from, start.wall.to) < CLUSTER_MIN_ITEMS;

  return (
    <Screen
      back="/plan"
      backLabel="Plan"
      footer={
        finished || !open.length ? (
          <>
            <Button label="See the fortnight" onPress={() => router.replace('/plan')} />
            <Button label="Back home" kind="secondary" onPress={() => router.replace('/')} />
          </>
        ) : (
          <Button label="Not this week" kind="quiet" onPress={() => (router.canGoBack() ? router.back() : router.replace('/plan'))} />
        )
      }
    >
      <Stack gap={5} className="pt-2">
        <PageHeader
          {...SCREEN.rebalance}
          eyebrow="Next week"
          title="Lighten next week"
          sub={advice ? `✨ ${advice.headline}` : undefined}
        />

        {/* Then → now, and the seven days it has bought back so far. */}
        <Card gap={4}>
          <Stack direction="row" align="center" justify="between">
            <Gauge label="BEFORE" charge={chargeOf(start.overall)} overall={start.overall} faded />
            <Stack gap={1} align="center">
              <View className="rounded-pill px-3 py-1" style={{ backgroundColor: gain > 0 ? color.band.steady.fill : color.surface.sunken }}>
                <Text variant="callout" weight="bold" tone={gain > 0 ? 'inverse' : 'subtle'}>{gain > 0 ? `+${gain}%` : '±0%'}</Text>
              </View>
              <Text variant="title" tone="subtle">→</Text>
            </Stack>
            <Gauge label="NOW" charge={chargeOf(now)} overall={now} />
          </Stack>
          <WeekBars days={days} now={dayCost.now} next={dayCost.next} />
        </Card>

        {finished ? (
          // Every one answered: what it came to.
          <Card tone={wallGone ? 'steady' : 'busy'} gap={3} align="center">
            <Mascot charge={chargeOf(now)} loadPercent={now} size={96} />
            <Text variant="heading" className="text-center">
              {downCount ? `${downCount} put down · ⚡ +${Math.max(0, gain)}%` : 'Kept everything'}
            </Text>
            <Text variant="footnote" tone={wallGone ? 'steady' : 'busy'} weight="semibold">
              {wallGone ? '✅ Pile-up cleared' : '⚠️ Lighter, still busy'}
            </Text>
            {freed.length ? (
              <Stack direction="row" gap={2} wrap justify="center">
                {freed.map((day) => (
                  <View key={day.date} className="rounded-pill px-3 py-1" style={{ backgroundColor: color.band.steady.wash }}>
                    <Text variant="caption" weight="bold" tone="steady">{formatShort(day.date)} · +{day.percent}%</Text>
                  </View>
                ))}
              </Stack>
            ) : null}
          </Card>
        ) : null}

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

        {/* One at a time: what it is, what it gives back, who should hear first. */}
        {current ? (
          <Section family="focus" title="Put down?" sticker="scales" meta={`${done.length + 1} of ${open.length}`}>
            <Stack direction="row" gap={1}>
              {open.map((t) => (
                <View
                  key={t.id}
                  className="flex-1 rounded-pill"
                  style={{
                    height: 5,
                    backgroundColor: decided[t.id] === 'down' ? color.band.steady.fill
                      : decided[t.id] === 'kept' ? color.line.strong
                        : t.id === current.id ? color.surface.inverse : color.surface.raised,
                  }}
                />
              ))}
            </Stack>
            <Decision
              key={current.id}
              trade={current}
              item={itemOf(current)}
              percent={pct(current.saves)}
              suggest={pick(current.id)}
              wrote={!!wrote[current.id]}
              confirming={confirming}
              onWrite={() => write(current)}
              onAsk={() => { tapFeedback(); setConfirming(true); }}
              onBack={() => { tapFeedback(); setConfirming(false); }}
              onDown={() => putDown(current)}
              onKeep={() => keep(current)}
            />
          </Section>
        ) : null}

        {/* What you have answered so far. */}
        {done.length ? (
          <Stack gap={2}>
            {done.map((trade) => {
              const down = decided[trade.id] === 'down';
              return (
                <Stack key={trade.id} direction="row" gap={3} align="center" className="rounded-lg bg-raised px-4 py-3" style={{ borderWidth: 1, borderColor: color.line.hairline, opacity: down ? 1 : 0.7 }}>
                  <Text variant="heading">{trade.protected ? '🌿' : SPEND[spendKey(itemOf(trade) ?? ({} as Item))]?.emoji ?? '📌'}</Text>
                  <Text variant="callout" weight="semibold" numberOfLines={1} className="flex-1" style={down ? { textDecorationLine: 'line-through' } : undefined}>{trade.title}</Text>
                  <View className="rounded-pill px-3 py-1" style={{ backgroundColor: down ? color.band.steady.wash : color.surface.sunken }}>
                    <Text variant="micro" weight="bold" tone={down ? 'steady' : 'subtle'}>
                      {down ? `✓ Down${wrote[trade.id] ? ' · ✉️' : ''}` : 'Kept'}
                    </Text>
                  </View>
                </Stack>
              );
            })}
          </Stack>
        ) : null}

        {/* Hard deadlines: named, never offered. */}
        {locked.length ? (
          <Disclosure lead="🔒" title={`${locked.length} can’t move`} summary="Hard deadlines">
            <Stack gap={2}>
              {locked.map((trade) => (
                <Stack key={trade.id} direction="row" gap={3} align="center">
                  <Text variant="callout">{SPEND[spendKey(itemOf(trade) ?? ({} as Item))]?.emoji ?? '📌'}</Text>
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

/**
 * One thing that could come off, and the three honest answers to it.
 *
 * Write first (when somebody is waiting on it), put it down, or keep it.
 * Putting it down is a second step that says what is about to happen - who
 * has been told, when it leaves, what comes back - so nothing goes on a tap.
 */
function Decision({
  trade, item, percent, suggest, wrote, confirming, onWrite, onAsk, onBack, onDown, onKeep,
}: {
  trade: Trade; item?: Item; percent: number; suggest?: { why: string; take?: boolean }; wrote: boolean; confirming: boolean;
  onWrite: () => void; onAsk: () => void; onBack: () => void; onDown: () => void; onKeep: () => void;
}) {
  const ask = askFor(trade, item);
  const info = item ? SPEND[spendKey(item)] : SPEND.errand;
  const value = Math.round(percent);
  const costs = trade.protected || value < 0;
  const back = costs ? `🌿 −${Math.max(1, Math.abs(value))}%` : `⚡ +${Math.max(1, value)}%`;
  const when = item
    ? `${formatShort(item.deadline ?? item.date)}${item.startHour !== undefined && !item.deadline ? ` · ${formatHour(item.startHour)}` : ''}`
    : '';
  const shouldTell = !!ask.tell;

  return (
    <Stack gap={4} className="rounded-xl bg-raised px-4 py-4" style={{ borderWidth: 2, borderColor: color.line.hairline }}>
      {/* What it is. */}
      <Stack direction="row" gap={3} align="center">
        <View className="items-center justify-center rounded-lg" style={{ width: 56, height: 56, backgroundColor: costs ? color.band.recovery.wash : color.band.busy.wash }}>
          <Text variant="title">{trade.protected ? '🌿' : info.emoji}</Text>
        </View>
        <Stack gap={0} grow>
          <Text variant="micro" tone="subtle">{ask.kind.toUpperCase()}</Text>
          <Text variant="heading" numberOfLines={2}>{trade.title}</Text>
          {when ? <Text variant="caption" weight="semibold" tone="muted">{item?.deadline ? `Due ${when}` : when}</Text> : null}
        </Stack>
        <View className="items-center rounded-lg px-3 py-2" style={{ backgroundColor: costs ? color.band.heavy.wash : color.band.steady.wash }}>
          <Text variant="heading" tone={costs ? 'heavy' : 'steady'}>{back.slice(3)}</Text>
          <Text variant="micro" tone={costs ? 'heavy' : 'steady'}>{costs ? 'costs' : 'back'}</Text>
        </View>
      </Stack>

      {/* What the app knows about it, as chips. */}
      <Stack direction="row" gap={2} wrap>
        {item ? <Chip label={`${{ hard: '🔒 Hard', soft: '↔️ Can move', self: '🙋 Your own goal' }[item.commitment]}`} readOnly /> : null}
        {shouldTell ? <Chip label={`✉️ ${ask.tell} should hear first`} tone="busy" readOnly /> : null}
        {item?.want ? <Chip label={item.want >= 4 ? '💛 You want to be there' : item.want <= 2 ? '🤷 You don’t mind missing it' : '😐 Either way'} readOnly /> : null}
        {suggest ? <Chip label={suggest.take ? '✨ Worth putting down' : '✨ Worth keeping'} tone={suggest.take ? 'steady' : 'plain'} readOnly /> : null}
      </Stack>
      {suggest?.why ? <Text variant="footnote" tone="muted">✨ {suggest.why}</Text> : null}
      {trade.protected ? <Text variant="footnote" tone="heavy" weight="semibold">This is rest. Putting it down takes battery, not gives it.</Text> : null}

      {confirming ? (
        // The step before: what is about to happen, said out loud.
        <Stack gap={3} className="rounded-lg px-4 py-3" style={{ backgroundColor: color.surface.sunken }}>
          <Text variant="callout" weight="bold">Before you {ask.verb.toLowerCase()}</Text>
          {shouldTell ? (
            <Stack direction="row" gap={3} align="center">
              <Text variant="callout">{wrote ? '✅' : '✉️'}</Text>
              <Text variant="callout" className="flex-1">{wrote ? `Message to ${ask.tell} written` : `${ask.tell} hasn’t heard yet`}</Text>
              {!wrote ? (
                <Pressable accessibilityRole="button" accessibilityLabel={`Write to ${ask.tell}`} onPress={onWrite} className="min-h-min justify-center active:opacity-60">
                  <Text variant="caption" weight="bold" className="underline">Write now ›</Text>
                </Pressable>
              ) : null}
            </Stack>
          ) : null}
          <Stack direction="row" gap={3} align="center">
            <Text variant="callout">📅</Text>
            <Text variant="callout" className="flex-1">
              {trade.id.startsWith('batch-') ? 'They become one trip' : `Leaves your week${when ? ` · ${when}` : ''}`}
            </Text>
          </Stack>
          <Stack direction="row" gap={3} align="center">
            <Text variant="callout">{costs ? '🌿' : '⚡'}</Text>
            <Text variant="callout" weight="semibold" tone={costs ? 'heavy' : 'steady'} className="flex-1">
              {costs ? `Costs ${back.slice(3)} of next week` : `${back.slice(3)} back next week`}
            </Text>
          </Stack>
          <Stack direction="row" gap={2}>
            <Button label="Not yet" kind="secondary" className="flex-1" onPress={onBack} />
            <Button label={`Yes, ${ask.verb.toLowerCase()}`} kind="steady" className="flex-[2]" onPress={onDown} />
          </Stack>
        </Stack>
      ) : (
        <Stack gap={2}>
          {shouldTell && !wrote ? (
            <Button label={`✉️ Write to ${ask.tell} first`} onPress={onWrite} />
          ) : null}
          <Stack direction="row" gap={2}>
            <Button
              label={shouldTell && wrote ? `✓ Told · ${ask.verb}` : ask.verb}
              kind={shouldTell && !wrote ? 'secondary' : 'steady'}
              className="flex-[3]"
              onPress={onAsk}
            />
            <Button label="Keep it" kind="secondary" className="flex-[2]" onPress={onKeep} />
          </Stack>
        </Stack>
      )}
    </Stack>
  );
}
