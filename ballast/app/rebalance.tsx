import { useMemo, useState } from 'react';
import { successFeedback } from '@/lib/haptics';
import { useRouter } from 'expo-router';
import {
  Battery, Button, Card, Divider, Screen, Stack, Text, Toggle,
} from '@/components';
import { bandFor, overallPercent, percentByBucket } from '@/lib/load';
import { CHARGE_LABEL, chargeOf } from '@/lib/battery';
import { applySelection, buildTrades, totalSaved } from '@/lib/rebalance';
import { itemsInWeek, nextWeek, useStore, weekReading } from '@/state/store';

/**
 * Screen 4 — Trading, not deleting.
 *
 * Every flag in Ballast leads here, to a list of specific things you could
 * actually put down and the exact price of each one.
 *
 * "Not this week" sits at the same weight as the primary action. Declining the
 * plan is a legitimate answer and is never followed by a second ask.
 */
export default function Rebalance() {
  const router = useRouter();
  const { items, ceilings, today, applyTrades } = useStore();

  const anchor = nextWeek(today);
  const week = useMemo(() => itemsInWeek(items, anchor), [items, anchor]);
  const trades = useMemo(() => buildTrades(week), [week]);

  const [selected, setSelected] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(trades.map((t) => [t.id, t.selected])),
  );
  /** Set once changes are applied, so the screen can report what it did. */
  const [applied, setApplied] = useState<{ count: number; saved: number; charge: number } | null>(null);

  const before = weekReading(items, anchor, ceilings).overall;
  const after = overallPercent(percentByBucket(applySelection(week, trades, selected), ceilings));
  const saved = totalSaved(trades, selected);
  const chosen = trades.filter((t) => selected[t.id] && !t.locked).length;

  const toggle = (id: string) => setSelected((prev) => ({ ...prev, [id]: !prev[id] }));

  if (applied) {
    return (
      <Screen
        footer={
          <>
            <Button label="See the fortnight" onPress={() => router.replace('/plan')} />
            <Button label="Back home" kind="secondary" onPress={() => router.replace('/')} />
          </>
        }
      >
        <Stack gap={6} className="pt-8">
          <Text variant="micro" tone="steady">DONE</Text>
          <Text variant="title" accessibilityRole="header" accessibilityLiveRegion="polite">
            {applied.count} change{applied.count === 1 ? '' : 's'} applied.
          </Text>

          <Card tone="steady" gap={5}>
            <Stack direction="row" gap={5} align="center">
              <Battery
                charge={applied.charge}
                loadPercent={100 - applied.charge}
                width={140}
                height={68}
                label={`Now at ${applied.charge} percent`}
              />
              <Stack gap={1} grow>
                <Text variant="display" tone="steady">{applied.charge}%</Text>
                <Text variant="micro" tone="subtle">of next week left</Text>
              </Stack>
            </Stack>
            <Text variant="callout" tone="muted">You got {applied.saved} load back.</Text>
          </Card>

          <Card gap={3}>
            <Text variant="heading">Wednesday evening is free.</Text>
            <Text variant="footnote" tone="muted">Your first free evening in eleven days.</Text>
          </Card>

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
              setApplied({ count: chosen, saved, charge: chargeOf(after) });
              applyTrades(trades.map((t) => ({ ...t, selected: !!selected[t.id] })));
              successFeedback();
            }}
          />
          {/* Declining the plan is a legitimate answer, at the same weight. */}
          <Button label="Not this week" kind="secondary" onPress={() => router.back()} />
        </>
      }
    >
      <Stack gap={5} className="pt-4">
        <Text variant="footnote" tone="muted">Rebalancing next week</Text>

        {/* a. The meter moves as you toggle, updating live. You can see what a
            trade buys you before you commit to it, which is the difference
            between a decision and a guess. */}
        <Stack gap={4}>
          <Stack direction="row" gap={4} align="center">
            <Text variant="display" tone="subtle" className="line-through">{chargeOf(before)}%</Text>
            <Text variant="display" tone={bandFor(after) === 'heavy' ? 'heavy' : bandFor(after) === 'busy' ? 'busy' : 'steady'}>
              {chargeOf(after)}%
            </Text>
          </Stack>
          <Battery
            charge={chargeOf(after)}
            loadPercent={after}
            width={200}
            height={78}
            label={`${chargeOf(after)} percent charge after these changes. ${CHARGE_LABEL[bandFor(after)]}.`}
          />
          <Text
            variant="footnote"
            tone="muted"
            accessibilityLiveRegion="polite"
            accessibilityLabel={`${chosen} changes selected, saving ${saved} load. Charge would go from ${chargeOf(before)} to ${chargeOf(after)} percent.`}
          >
            {chosen} change{chosen === 1 ? '' : 's'} selected, saving {saved} load.
          </Text>
        </Stack>

        <Card pad={0} gap={0} className="px-5">
          {trades.map((trade, index) => (
            <Stack key={trade.id}>
              {index > 0 ? <Divider /> : null}
              <Stack direction="row" gap={4} align="center" justify="between" className="min-h-row py-4">
                <Stack gap={2} grow>
                  <Text variant="body" weight="semibold">{trade.title}</Text>
                  <Text variant="footnote" tone={trade.locked ? 'subtle' : 'muted'}>{trade.detail}</Text>
                </Stack>
                <Toggle
                  label={trade.title}
                  state={
                    trade.locked ? 'locked'
                    : trade.protected && !selected[trade.id] ? 'protected'
                    : selected[trade.id] ? 'on' : 'off'
                  }
                  onPress={() => toggle(trade.id)}
                />
              </Stack>
            </Stack>
          ))}
        </Card>

        {/* The consequence, in the student's own terms rather than in load units. */}
        {chosen > 0 ? (
          <Card tone="recovery" gap={2}>
            <Text variant="callout">
              <Text variant="callout" weight="semibold" tone="recovery">Wednesday evening opens up.</Text>{' '}
              <Text variant="callout" tone="muted">Your first free evening in eleven days.</Text>
            </Text>
          </Card>
        ) : null}

        <Text variant="footnote" tone="subtle">
          Drafts the messages. Never sends them.
        </Text>
      </Stack>
    </Screen>
  );
}
