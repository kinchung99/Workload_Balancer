import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  AreaIcon, Battery, Button, Card, Chip, PageHeader, Reveal, Screen, Stack, Sticker, Text,
} from '@/components';
import { color } from '@design/tokens';
import { SCREEN } from '@design/screens';
import { BUCKET_LABEL, bandFor } from '@/lib/load';
import { CHARGE_NOTE } from '@/lib/battery';
import { prioritise, rankedDetail, type Ranked } from '@/lib/priority';
import { formatShort } from '@/lib/dates';
import { formatHour } from '@/lib/schedule';
import { restOwedFrom, useStore } from '@/state/store';
import { useItemsWithLogs, useReading } from '@/state/selectors';
import { prescriptions } from '@/data/seed';

const TONE = { steady: 'steady', busy: 'busy', heavy: 'heavy' } as const;

/** What pressing the button on a row should do, given what kind of thing it is. */
const ACTION: Record<Ranked['kind'], string> = {
  owing: 'Plan the sittings',
  loose: 'Give it a time',
  fixed: 'Open that day',
};

/**
 * What to do first — the question a to-do list never answers.
 *
 * A list sorts by the order things were typed; a calendar sorts by clock time.
 * Neither knows that a two-hour job due tomorrow beats a nine-hour job due next
 * week. This scores everything on one scale — how close the deadline is, who
 * you promised, how much it matters, how much is left, and whether it can still
 * be finished at all — and then answers the other half of the same question:
 * of all this, what are you actually allowed to move?
 */
export default function Priority() {
  const router = useRouter();
  const { today, booked, recovery } = useStore();
  const items = useItemsWithLogs();
  const reading = useReading();

  const { first, couldMove } = useMemo(() => prioritise(items, today), [items, today]);
  /**
   * Six, then the rest behind a tap.
   *
   * The model ranks everything in the next week, which turned out to be
   * twenty-four rows - and a screen called "what to do first" that opens with
   * twenty-four things is the problem it was built to solve.
   */
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? first : first.slice(0, 6);
  const band = bandFor(reading.overall);
  const restOwed = restOwedFrom(recovery);
  const rest = prescriptions.filter((entry) => !booked.includes(entry.id))[0];
  /**
   * When rest stops being optional and joins the list.
   *
   * Charge alone was the wrong test: at 45% you have room today, but the ledger
   * can still say you are eleven hours down and have been for nine days. A debt
   * that size is the thing to do first whatever this week looks like.
   */
  const restFirst = reading.charge < 30 || restOwed >= 8;

  const go = (row: Ranked) => {
    if (row.kind === 'owing') router.push(`/plan?day=${today}`);
    else if (row.kind === 'loose') router.push(`/plan?day=${row.item.date}`);
    else router.push(`/plan?day=${row.item.date}`);
  };

  return (
    <Screen
      back="/"
      backLabel="Home"
      footer={
        <Stack direction="row" gap={3}>
          <Button label="Rebalance" kind="secondary" onPress={() => router.push('/rebalance')} className="flex-1" />
          <Button label="Open my week" onPress={() => router.push('/plan')} className="flex-[2]" />
        </Stack>
      }
    >
      <Stack gap={5} className="pt-2">
        <PageHeader
          sticker="star"
          wash={color.decor.lemon}
          eyebrow="What to do first"
          title={first.length ? 'Start with this' : 'Nothing is pressing'}
          sub="Ranked by deadline, who you promised, and what is left."
        />

        {/* Where you are starting from, because it changes the advice. */}
        <Card tone={band} gap={4}>
          <Stack direction="row" gap={5} align="center">
            <Battery
              charge={reading.charge}
              loadPercent={reading.overall}
              width={84}
              height={42}
              label={`${reading.charge} percent left`}
            />
            <Stack gap={1} grow>
              <Text variant="display" tone={TONE[band]}>{reading.charge}%</Text>
              <Text variant="footnote" tone="muted">{CHARGE_NOTE[band]}</Text>
            </Stack>
          </Stack>
        </Card>

        {/* Under a quarter, rest is not the reward for finishing the list. */}
        {restFirst && rest ? (
          <Card tone="recovery" gap={4}>
            <Stack direction="row" gap={4} align="center">
              <Sticker name="leaf" size={44} wiggle />
              <Stack gap={1} grow>
                <Text variant="micro" tone="recovery">BEFORE ANY OF IT</Text>
                <Text variant="heading">{rest.title}</Text>
                <Text variant="footnote" tone="muted">
                  {reading.charge < 30
                    ? `You are ${restOwed}h down, and at ${reading.charge}% the next hour of work costs more than it gives.`
                    : `You are ${restOwed}h down on rest. That debt outlasts any one week.`}
                </Text>
              </Stack>
            </Stack>
            <Button label="Book it" kind="secondary" onPress={() => router.push('/prescription')} />
          </Card>
        ) : null}

        {/* The list. */}
        {first.length ? (
          <Stack gap={3}>
            <Stack direction="row" gap={3} align="center" className="rounded-pill py-2 pl-2 pr-4" style={{ backgroundColor: color.decor.candy }}>
              <View className="items-center justify-center rounded-pill" style={{ width: 30, height: 30, backgroundColor: color.surface.page }}>
                <Sticker name="star" size={21} />
              </View>
              <Text variant="caption" weight="semibold" className="flex-1">Start here</Text>
              <Text variant="micro" tone="subtle">{shown.length} of {first.length} · next 7 days</Text>
            </Stack>

            {shown.map((row, index) => (
              <Stack
                key={row.item.id}
                gap={3}
                className={`rounded-lg border-2 px-4 py-4 ${
                  index === 0 ? 'border-inverse bg-decor-cream' : 'border-line-hairline bg-raised'
                }`}
              >
                <Stack direction="row" gap={3} align="center">
                  {/* The rank, so the order is the point rather than a side effect. */}
                  <View
                    className="items-center justify-center rounded-pill"
                    style={{ width: 34, height: 34, backgroundColor: index === 0 ? color.ink.default : color.surface.sunken }}
                  >
                    <Text variant="callout" weight="bold" tone={index === 0 ? 'inverse' : 'muted'}>{index + 1}</Text>
                  </View>
                  <Stack gap={1} grow>
                    <Text variant="body" weight="semibold">{row.item.title}</Text>
                    <Stack direction="row" gap={2} align="center">
                      <AreaIcon area={row.item.bucket} size={14} />
                      <Text variant="micro" tone="subtle">
                        {rankedDetail(row)}
                        {row.item.startHour !== undefined ? ` · ${formatHour(row.item.startHour)}` : ''}
                        {row.item.date !== today ? ` · ${formatShort(row.item.date)}` : ''}
                      </Text>
                    </Stack>
                  </Stack>
                </Stack>

                <Stack direction="row" gap={2} wrap>
                  {row.reasons.map((reason) => (
                    <Chip
                      key={reason}
                      label={reason}
                      tone={reason === 'Not enough time left' ? 'heavy' : reason.startsWith('Due') ? 'busy' : 'plain'}
                      readOnly
                    />
                  ))}
                </Stack>

                <Chip label={ACTION[row.kind]} tone="steady" onPress={() => go(row)} />
              </Stack>
            ))}

            {first.length > shown.length ? (
              <Chip
                label={`Show the other ${first.length - shown.length}`}
                onPress={() => setShowAll(true)}
              />
            ) : null}
          </Stack>
        ) : (
          <Card gap={4}>
            <Stack direction="row" gap={4} align="center">
              <Sticker name="sun" size={44} />
              <Text variant="callout" tone="muted" className="flex-1">
                Nothing is due in the next week. Genuinely.
              </Text>
            </Stack>
          </Card>
        )}

        {/* The half nobody asks: what are you allowed to move? */}
        {couldMove.length ? (
          <Stack gap={3}>
            <Stack direction="row" gap={3} align="center" className="rounded-pill py-2 pl-2 pr-4" style={{ backgroundColor: color.decor.sky }}>
              <View className="items-center justify-center rounded-pill" style={{ width: 30, height: 30, backgroundColor: color.surface.page }}>
                <Sticker name="scales" size={21} />
              </View>
              <Text variant="caption" weight="semibold" className="flex-1">Could move</Text>
              <Text variant="micro" tone="subtle">up to {couldMove[0].saves} back</Text>
            </Stack>

            {couldMove.slice(0, 4).map((row) => (
              <Stack key={row.item.id} gap={3} className="rounded-lg border-2 border-line-hairline bg-raised px-4 py-4">
                <Stack direction="row" gap={3} align="center">
                  <View
                    className="items-center justify-center rounded-pill"
                    style={{ width: 34, height: 34, backgroundColor: color.area[row.item.bucket].wash }}
                  >
                    <AreaIcon area={row.item.bucket} size={19} />
                  </View>
                  <Stack gap={1} grow>
                    <Text variant="body" weight="semibold">{row.item.title}</Text>
                    <Text variant="micro" tone="subtle">
                      {BUCKET_LABEL[row.item.bucket]} · {row.item.commitment === 'self' ? 'your own idea' : 'soft'}
                    </Text>
                  </Stack>
                  <Chip label={`${row.saves} back`} tone="recovery" readOnly />
                </Stack>
                <Stack direction="row" gap={2} wrap>
                  <Chip label="Write the message" tone="steady" onPress={() => router.push(`/decline/${row.item.id}`)} />
                  <Chip label="Move it" onPress={() => router.push(`/plan?day=${row.item.date}`)} />
                </Stack>
              </Stack>
            ))}
          </Stack>
        ) : null}

        <Reveal label="How this order is worked out">
          <Text variant="footnote" tone="muted">
            Size first — hours still owed for work with preparation, load for everything else. Then how close
            the deadline is, which climbs steeply inside three days and is flat after a week. Then who you
            promised: a hard deadline outranks a soft one, and both outrank a promise to yourself. Then how
            much you said it matters. Anything that can no longer be finished in the free time left jumps
            straight to the top, because that is the only genuinely alarming thing a list can tell you.
          </Text>
        </Reveal>

        <View className="h-2" />
      </Stack>
    </Screen>
  );
}
