import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import {
  AreaIcon, Button, Card, Chip, DrainBadge, PageHeader, Ring, Screen, Section, Stack, Sticker, Text,
} from '@/components';
import { color, radius } from '@design/tokens';
import { FAMILY } from '@design/families';
import { BUCKET_LABEL, bandFor } from '@/lib/load';
import {
  hoursNeeded, nextFit, prioritise, rowWeight, weekAhead, whyFirst, type Push, type Ranked,
} from '@/lib/priority';
import { weightsFrom } from '@/lib/review';
import { DAY_LETTER, addDays, dayIndex, daysBetween, formatShort, parseISO } from '@/lib/dates';
import { formatHour } from '@/lib/schedule';
import { percentUndone, remaining, scheduledHours } from '@/lib/prep';
import { isProtectedClass } from '@/lib/timetable';
import { batteryCost, costLabel } from '@/lib/drain';
import { nowHourFor } from '@/lib/sittings';
import { tapFeedback } from '@/lib/haptics';
import { restOwedFrom, useStore } from '@/state/store';
import { useItemsWithLogs, useReading } from '@/state/selectors';
import { prescriptions } from '@/data/seed';
import { api } from '@/lib/api';
import { priorityContext } from '@/lib/coach';
import { clockHour } from '@/lib/marking';
import { useAiAnswer } from '@/lib/ai';

const TONE = { steady: 'steady', busy: 'busy', heavy: 'heavy' } as const;

/** What pressing a row should do, given what kind of thing it is. */
const ACTION: Record<Ranked['kind'], string> = {
  owing: 'Plan the sittings',
  loose: 'Give it a time',
  fixed: 'Open that day',
};

/** A fixed thing that may not move - a class, a hard deadline - can only be looked at. */
const lockedIn = (row: Ranked) => isProtectedClass(row.item) || row.item.commitment === 'hard';

/** Where its button goes: sittings for owing work, a time for loose work, the day or the time for fixed. */
const actionFor = (row: Ranked): { label: string; to: string } =>
  row.kind === 'owing'
    ? { label: '✍️ Plan sittings', to: `/item/${row.item.id}/sittings` }
    : row.kind === 'loose'
      ? { label: '🕒 Plan time', to: `/item/${row.item.id}` }
      : lockedIn(row)
        ? { label: '📅 Open day', to: `/plan?day=${row.item.date}` }
        : { label: '🕒 Change time', to: `/item/${row.item.id}` };

/** "Today", "Tomorrow", "Thu 13 Nov" - the due day as a person says it. */
const dayWord = (date: string, today: string): string =>
  date === today ? 'Today' : date === addDays(today, 1) ? 'Tomorrow' : formatShort(date);

/** "today", "tomorrow", "on Thu 13 Nov" - for the middle of a sentence. */
const onDay = (date: string, today: string): string =>
  date === today ? 'today' : date === addDays(today, 1) ? 'tomorrow' : `on ${formatShort(date)}`;

const hoursWord = (hours: number): string => (hours < 1 ? `${Math.round(hours * 60)}m` : `${Math.round(hours * 10) / 10}h`);

/**
 * What to do first — the question a to-do list never answers.
 *
 * A list sorts by the order things were typed; a calendar sorts by clock time.
 * Neither knows that a two-hour job due tomorrow beats a nine-hour job due next
 * week. This scores everything on one scale and then answers, for the thing at
 * the top, the questions a student asks next: why this, how long, what will it
 * take out of me, and when could I actually do it?
 *
 * Below it, the next seven days as one picture - free time per day, what lands
 * on which - and a blunt verdict on whether the hours still needed fit in the
 * hours still free. Everything else is kept short on purpose: one hero, a strip,
 * and a list you can read in one pass.
 */
export default function Priority() {
  const router = useRouter();
  const { today, booked, recovery, dayReports, ceilings } = useStore();
  const items = useItemsWithLogs();
  const reading = useReading();

  const weights = useMemo(() => weightsFrom(dayReports), [dayReports]);
  const { first, couldMove } = useMemo(() => prioritise(items, today, 7, weights), [items, today, weights]);
  const ahead = useMemo(() => weekAhead(first, items, today), [first, items, today]);

  const [showAll, setShowAll] = useState(false);
  const top = first[0];
  const rest = first.slice(1);
  const shown = showAll ? rest : rest.slice(0, 5);
  const restOwed = restOwedFrom(recovery);
  const restIdea = prescriptions.filter((entry) => !booked.includes(entry.id))[0];
  /**
   * When rest stops being optional and joins the list. Charge alone was the
   * wrong test: at 45% you have room today, but the ledger can still say you are
   * eleven hours down and have been for nine days.
   */
  const restFirst = reading.charge < 30 || restOwed >= 8;

  /*
   * The order is the app's, from what you entered. The AI only says why each
   * thing sits where it does, and how to take the day - the reasons arrive a
   * moment after the list and slot into it.
   */
  const ranked = first.slice(0, 10);
  const advice = useAiAnswer(
    ranked.length ? `priority:${today}:${reading.charge}:${ranked.map((row) => row.item.id).join(',')}` : null,
    async () => {
      const res = await api.suggestPriority(priorityContext(ranked, today, clockHour(today), reading.charge, restOwed));
      return res.ok && res.data.picks.length ? res.data : null;
    },
  );
  const aiWhy = (id: string): string | undefined => advice?.picks.find((pick) => pick.id === id)?.why;

  const go = (row: Ranked) => {
    tapFeedback();
    router.push(actionFor(row).to as Href);
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
          sub={advice ? `✨ ${advice.headline}` : undefined}
        />

        {/* Under a quarter, rest is not the reward for finishing the list. */}
        {restFirst && restIdea ? (
          <Card tone="recovery" gap={4}>
            <Stack direction="row" gap={4} align="center">
              <Sticker name="leaf" size={44} wiggle />
              <Stack gap={1} grow>
                <Text variant="micro" tone="recovery">BEFORE ANY OF IT</Text>
                <Text variant="heading">{restIdea.title}</Text>
                <Text variant="footnote" tone="muted">{restOwed}h of rest owed · {reading.charge}% battery</Text>
              </Stack>
            </Stack>
            <Button label="Book it" kind="secondary" onPress={() => router.push('/prescription')} />
          </Card>
        ) : null}

        {top ? (
          <Hero
            row={top}
            pushes={whyFirst(top, items, today, Math.max(...first.map(rowWeight), 1))}
            cost={batteryCost(items, top.item, ceilings)}
            fit={nextFit(top, items, today, nowHourFor(today))}
            needs={hoursNeeded(top, items)}
            booked={scheduledHours(top.item, items)}
            today={today}
            why={aiWhy(top.item.id)}
            onGo={() => go(top)}
          />
        ) : (
          <Card gap={4}>
            <Stack direction="row" gap={4} align="center">
              <Sticker name="sun" size={44} />
              <Text variant="callout" tone="muted" className="flex-1">Nothing is due in the next week. Genuinely.</Text>
            </Stack>
          </Card>
        )}

        {first.length ? (
          <WeekAhead
            ahead={ahead}
            today={today}
            charge={reading.charge}
            band={bandFor(reading.overall)}
            shownRanks={shown.length + 1}
            onDay={(date) => { tapFeedback(); router.push(`/plan?day=${date}`); }}
          />
        ) : null}

        {/* Then: one line each, in order, with how hard each one presses. */}
        {rest.length ? (
          <Section family="focus" title="Then" meta={`${shown.length + 1} of ${first.length} · next 7 days`}>
            {shown.map((row, index) => (
              <Row
                key={row.item.id}
                row={row}
                rank={index + 2}
                pressure={top ? row.score / top.score : 0}
                today={today}
                why={aiWhy(row.item.id)}
                onOpen={() => { tapFeedback(); router.push(`/item/${row.item.id}` as Href); }}
                onAction={() => go(row)}
              />
            ))}

            {rest.length > shown.length ? (
              <Chip label={`Show the other ${rest.length - shown.length}`} onPress={() => { tapFeedback(); setShowAll(true); }} />
            ) : null}
          </Section>
        ) : null}

        {/* The half nobody asks: what are you allowed to move, and what would it give back? */}
        {couldMove.length ? (
          <Section family="rest" title="Could move" sticker="scales" meta="battery back">
            {couldMove.slice(0, 3).map((row) => (
              <Stack key={row.item.id} gap={3} className="rounded-lg border border-line-hairline bg-raised px-4 py-3">
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
                      {dayWord(row.item.date, today)} · {row.item.commitment === 'self' ? 'your own idea' : 'soft, can move'}
                    </Text>
                  </Stack>
                  <Chip label={`+${Math.max(1, batteryCost(items, row.item, ceilings))}% back`} tone="recovery" readOnly />
                </Stack>
                <Stack direction="row" gap={2} wrap>
                  <Chip label="Write the message" onPress={() => router.push(`/decline/${row.item.id}`)} />
                  <Chip label="Move it" onPress={() => router.push(`/plan?day=${row.item.date}`)} />
                </Stack>
              </Stack>
            ))}
          </Section>
        ) : null}


        <View className="h-2" />
      </Stack>
    </Screen>
  );
}

/**
 * Number one, answered in full: when it is due, how long it needs, what it
 * will take out of you, why it is first, and when it could actually happen.
 */
function Hero({
  row, pushes, cost, fit, needs, booked, today, why, onGo,
}: {
  row: Ranked;
  pushes: Push[];
  cost: number;
  fit: ReturnType<typeof nextFit>;
  needs: number;
  booked: number;
  today: string;
  /** The AI's reason, in a line, when it has given one. */
  why?: string;
  onGo: () => void;
}) {
  const { item } = row;
  const due = item.deadline ?? item.date;
  const days = Math.max(0, daysBetween(today, due));
  const risky = pushes.some((p) => p.key === 'risk');

  return (
    <View className="overflow-hidden rounded-xl border-2 border-inverse" style={{ backgroundColor: FAMILY.focus.wash }}>
      <Stack gap={4} className="px-5 py-5">
        <Stack direction="row" align="center" gap={3}>
          <View className="items-center justify-center rounded-pill bg-inverse" style={{ width: 30, height: 30 }}>
            <Text variant="callout" weight="bold" tone="inverse">1</Text>
          </View>
          <Text variant="micro" className="flex-1">START HERE</Text>
          <View className="flex-row items-center gap-1 rounded-pill px-3 py-1" style={{ backgroundColor: color.area[item.bucket].wash }}>
            <AreaIcon area={item.bucket} size={14} />
            <Text variant="micro">{BUCKET_LABEL[item.bucket]}</Text>
          </View>
        </Stack>

        <Text variant="title">{item.title}</Text>
        {why ? <Text variant="callout" weight="semibold">✨ {why}</Text> : null}

        {/* Three facts, as tiles: due, needs, costs. */}
        <Stack direction="row" gap={2}>
          <Fact emoji="⏰" label="DUE" value={dayWord(due, today)} sub={days <= 1 ? formatShort(due) : `in ${days} days`} hot={days <= 1} />
          <Fact
            emoji="⏳"
            label="NEEDS"
            value={row.kind === 'owing' ? `${remaining(item)}h` : hoursWord(item.hours)}
            sub={row.kind === 'owing' ? `${percentUndone(item)}% left` : row.kind === 'fixed' ? 'booked' : 'no time yet'}
          />
          <Fact emoji="🔋" label="COSTS" value={costLabel(cost)} sub="of the week" extra={<DrainBadge value={item.dread} />} />
        </Stack>

        {/* Why it is first: the three things pushing hardest, each with its strength. */}
        {pushes.length ? (
          <Stack gap={2}>
            <Text variant="micro" tone="subtle">WHY IT’S FIRST</Text>
            {pushes.map((push) => (
              <Stack key={push.key} direction="row" gap={3} align="center">
                <Text variant="callout">{push.emoji}</Text>
                <Text variant="footnote" weight="semibold" tone={push.key === 'risk' ? 'heavy' : 'default'} className="flex-1">
                  {push.label}
                </Text>
                <Stack direction="row" gap={1} accessible accessibilityLabel={`${push.strength} of 3`}>
                  {[1, 2, 3].map((dot) => (
                    <View
                      key={dot}
                      style={{
                        width: 10, height: 10, borderRadius: radius.pill,
                        backgroundColor: dot <= push.strength
                          ? (push.key === 'risk' ? color.band.heavy.fill : color.ink.default)
                          : color.surface.track,
                      }}
                    />
                  ))}
                </Stack>
              </Stack>
            ))}
          </Stack>
        ) : null}

        {/* When it could actually happen. */}
        <View
          className="flex-row items-center gap-3 rounded-md px-3 py-3"
          style={{ backgroundColor: fit ? color.band.steady.wash : color.band.heavy.wash }}
        >
          <Text variant="heading">{fit ? '🕑' : '⚠️'}</Text>
          <Stack gap={1} grow>
            <Text variant="footnote" weight="semibold" tone={fit ? 'steady' : 'heavy'}>
              {fit
                ? `${fit.booked ? 'Booked' : 'Fits'} ${onDay(fit.date, today)} at ${formatHour(fit.start)}–${formatHour(fit.start + fit.hours)}`
                : risky ? 'No gap left before it’s due' : 'No gap that fits before it’s due'}
            </Text>
            <Text variant="micro" tone="muted">
              {fit
                ? fit.booked ? 'Already in your day' : row.kind === 'owing' ? `A ${hoursWord(fit.hours)} sitting · ${hoursWord(needs)} still unplanned` : 'The first gap long enough'
                : 'Something has to move - see below'}
            </Text>
          </Stack>
        </View>

        <Button label={row.kind === 'fixed' && !lockedIn(row) ? 'Change the time' : ACTION[row.kind]} onPress={onGo} />
      </Stack>
    </View>
  );
}

function Fact({
  emoji, label, value, sub, hot = false, extra,
}: { emoji: string; label: string; value: string; sub: string; hot?: boolean; extra?: ReactNode }) {
  return (
    <View className="flex-1 gap-1 rounded-md px-3 py-3" style={{ backgroundColor: hot ? color.band.heavy.wash : color.surface.raised }}>
      <Stack direction="row" justify="between" align="center">
        <Text variant="callout">{emoji}</Text>
        {extra}
      </Stack>
      <Text variant="micro" tone="subtle">{label}</Text>
      <Text variant="heading" tone={hot ? 'heavy' : 'default'}>{value}</Text>
      <Text variant="micro" tone="subtle">{sub}</Text>
    </View>
  );
}

/**
 * The next seven days as one picture: a column per day, its height the free
 * time that day, with the rank of whatever is due sitting on top of it.
 */
function WeekAhead({
  ahead, today, charge, band, shownRanks, onDay,
}: {
  ahead: ReturnType<typeof weekAhead>;
  today: string;
  /** How many ranks the list on screen shows; the strip marks only those. */
  shownRanks: number;
  charge: number;
  band: 'steady' | 'busy' | 'heavy';
  onDay: (date: string) => void;
}) {
  const spare = Math.round((ahead.free - ahead.needed) * 10) / 10;
  const verdict = {
    fits: { tone: 'steady' as const, wash: color.band.steady.wash, line: `✓ It fits · ${spare}h to spare` },
    tight: { tone: 'busy' as const, wash: color.band.busy.wash, line: `Tight · only ${spare}h to spare` },
    short: { tone: 'heavy' as const, wash: color.band.heavy.wash, line: `Short by ${Math.abs(spare)}h · something has to move` },
  }[ahead.verdict];

  return (
    <Section family="week" title="Your next 7 days">
    <Card gap={4}>
      <Stack direction="row" gap={1} align="end">
        {ahead.days.map((day) => {
          const height = 18 + (day.free / 16) * 60;
          // Only the ranks listed on this screen, so the strip and the list point at each other.
          const listed = day.due.filter((rank) => rank <= shownRanks);
          return (
            <Pressable
              key={day.date}
              accessibilityRole="button"
              accessibilityLabel={`${formatShort(day.date)}, ${day.free} hours free${listed.length ? `, number ${listed.join(' and ')} due` : ''}`}
              onPress={() => onDay(day.date)}
              className="flex-1 items-center gap-1 active:opacity-60"
            >
              {/* What is due that day, by rank. */}
              <Stack gap={1} align="center" style={{ minHeight: 44, justifyContent: 'flex-end' }}>
                {listed.slice(0, 2).map((rank) => (
                  <View
                    key={rank}
                    className="items-center justify-center rounded-pill"
                    style={{ width: 20, height: 20, backgroundColor: rank === 1 ? color.ink.default : color.decor.candy }}
                  >
                    <Text variant="micro" weight="bold" tone={rank === 1 ? 'inverse' : 'default'}>{rank}</Text>
                  </View>
                ))}
                {listed.length > 2 ? <Text variant="micro" tone="subtle">+{listed.length - 2}</Text> : null}
              </Stack>
              {/* Free time that day. */}
              <View className="w-full items-center justify-end" style={{ height: 80 }}>
                <View
                  className="items-center justify-start"
                  style={{
                    width: '78%', height,
                    borderRadius: radius.sm, backgroundColor: color.band.recovery.wash,
                    borderWidth: 1.5, borderColor: color.band.recovery.fill,
                  }}
                >
                  <Text variant="micro" tone="recovery" className="pt-1">{Math.round(day.free)}h</Text>
                </View>
              </View>
              <Text variant="micro" weight={day.date === today ? 'bold' : 'semibold'} tone={day.date === today ? 'default' : 'subtle'}>
                {day.date === today ? 'TODAY' : DAY_LETTER[dayIndex(day.date)]}
              </Text>
              <Text variant="micro" tone="subtle">{parseISO(day.date).getUTCDate()}</Text>
            </Pressable>
          );
        })}
      </Stack>

      <View className="gap-1 rounded-md px-3 py-3" style={{ backgroundColor: verdict.wash }}>
        <Stack direction="row" gap={3} align="center">
          <Text variant="footnote" weight="semibold" tone={verdict.tone} className="flex-1">{verdict.line}</Text>
          <Text variant="micro" tone={TONE[band]}>🔋 {charge}% left</Text>
        </Stack>
        <Text variant="micro" tone="muted">{ahead.needed}h still needs a slot · {ahead.free}h free</Text>
      </View>
    </Card>
    </Section>
  );
}

/**
 * One thing after the first: when it happens - or, for owing work, how much is
 * left - and one button to do something about it: plan its sittings, give it a
 * time, or change the one it has.
 */
function Row({
  row, rank, pressure, today, why, onOpen, onAction,
}: { row: Ranked; rank: number; pressure: number; today: string; why?: string; onOpen: () => void; onAction: () => void }) {
  const { item } = row;
  const due = item.deadline ?? item.date;
  const left = row.kind === 'owing' ? percentUndone(item) : null;
  const action = actionFor(row);
  const when = row.kind === 'fixed'
    ? `🕒 ${dayWord(item.date, today)} · ${formatHour(item.startHour ?? 0)}–${formatHour((item.startHour ?? 0) + item.hours)}`
    : row.kind === 'loose'
      ? `🕒 ${dayWord(item.date, today)} · no time yet · ${hoursWord(item.hours)}`
      : `⏰ Due ${dayWord(due, today)} · ${remaining(item)}h to go`;
  return (
    <View className="overflow-hidden rounded-lg border-2 border-line-hairline bg-raised">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Number ${rank}. ${item.title}. ${when.replace(/^\S+ /, '')}${left !== null ? `. ${left} percent left` : ''}.`}
        onPress={onOpen}
        className="px-4 pb-2 pt-3 active:opacity-70"
      >
        <Stack direction="row" gap={3} align="center">
          <View className="items-center justify-center rounded-pill bg-sunken" style={{ width: 30, height: 30 }}>
            <Text variant="callout" weight="bold" tone="muted">{rank}</Text>
          </View>
          <Stack gap={1} grow>
            <Text variant="body" weight="semibold">{item.title}</Text>
            <Text variant="micro" tone={row.kind === 'loose' ? 'busy' : 'subtle'}>{when}</Text>
            {why ? <Text variant="footnote" tone="muted">✨ {why}</Text> : null}
          </Stack>
          {left !== null ? (
            // How much of it is left, as a ring that fills as it gets done.
            <Ring
              size={50}
              stroke={5}
              label={`${left} percent left`}
              segments={[{ value: (100 - left) / 100, color: color.band.steady.fill }]}
            >
              <Text variant="micro" weight="bold">{left}%</Text>
              <Text variant="micro" tone="subtle">left</Text>
            </Ring>
          ) : (
            <DrainBadge value={item.dread} />
          )}
        </Stack>
      </Pressable>
      <Stack direction="row" gap={3} align="center" className="px-4 pb-3">
        {/* How hard it presses, against number one. */}
        <View className="h-1 flex-1 overflow-hidden rounded-pill bg-track">
          <View style={{ width: `${Math.max(6, Math.min(100, pressure * 100))}%`, height: '100%', backgroundColor: color.ink.subtle }} />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${action.label.replace(/^\S+ /, '')}: ${item.title}`}
          onPress={onAction}
          className="min-h-min items-center justify-center rounded-pill bg-inverse px-3 py-2 active:opacity-70"
        >
          <Text variant="micro" weight="bold" tone="inverse">{action.label}</Text>
        </Pressable>
      </Stack>
    </View>
  );
}
