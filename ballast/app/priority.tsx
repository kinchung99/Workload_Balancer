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
  hoursNeeded, nextFit, prioritise, rowWeight, weekAhead, whyFirst, type Push, type Ranked, startLabel,
} from '@/lib/priority';
import { weightsFrom } from '@/lib/review';
import { DAY_LETTER, addDays, dayIndex, daysBetween, formatShort, parseISO } from '@/lib/dates';
import { formatHour } from '@/lib/schedule';
import { percentUndone, remaining } from '@/lib/prep';
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
    ? { label: '✍️ Sittings', to: `/item/${row.item.id}/sittings` }
    : row.kind === 'loose'
      ? { label: '🕒 Plan time', to: `/item/${row.item.id}` }
      : lockedIn(row)
        ? { label: '📅 Open day', to: `/plan?day=${row.item.date}` }
        : { label: '🕒 Change time', to: `/item/${row.item.id}` };

/** "Today", "Tomorrow", "Thu 13 Nov" - the due day as a person says it. */
const dayWord = (date: string, today: string): string =>
  date === today ? 'Today' : date === addDays(today, 1) ? 'Tomorrow' : formatShort(date);

const WEEKDAY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

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
  const { first, couldMove } = useMemo(() => prioritise(items, today, 7, weights, clockHour(today)), [items, today, weights]);
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
          <View
            className="flex-row items-center gap-3 rounded-xl px-4 py-3"
            style={{ backgroundColor: color.band.recovery.wash, borderWidth: 2, borderColor: color.band.recovery.fill }}
          >
            <Sticker name="leaf" size={36} wiggle />
            <Stack gap={1} grow>
              <Text variant="micro" tone="recovery">REST FIRST</Text>
              <Text variant="body" weight="semibold">{restIdea.title}</Text>
              <Stack direction="row" gap={1} wrap>
                <Tag emoji="🌙" label={`${restOwed}h owed`} tone="recovery" />
                <Tag emoji="🔋" label={`${reading.charge}%`} tone={TONE[bandFor(reading.overall)]} />
              </Stack>
            </Stack>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Book ${restIdea.title}`}
              onPress={() => { tapFeedback(); router.push('/prescription'); }}
              className="min-h-min items-center justify-center rounded-pill bg-inverse px-4 py-2 active:opacity-70"
            >
              <Text variant="caption" weight="bold" tone="inverse">Book</Text>
            </Pressable>
          </View>
        ) : null}

        {top ? (
          <Hero
            row={top}
            pushes={whyFirst(top, items, today, Math.max(...first.map(rowWeight), 1))}
            cost={batteryCost(items, top.item, ceilings)}
            fit={nextFit(top, items, today, nowHourFor(today))}
            needs={hoursNeeded(top, items)}
            today={today}
            why={aiWhy(top.item.id)}
            onGo={() => go(top)}
          />
        ) : (
          <Card gap={4}>
            <Stack direction="row" gap={4} align="center">
              <Sticker name="sun" size={44} />
              <Text variant="callout" tone="muted" className="flex-1">Nothing due this week.</Text>
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

        {/* Then: one card each, in the order they have to be started. */}
        {rest.length ? (
          <Section family="focus" title="Then" meta={`${first.length} to do · by start day`}>
            {shown.map((row, index) => (
              <Row
                key={row.item.id}
                row={row}
                rank={index + 2}
                today={today}
                why={aiWhy(row.item.id)}
                onOpen={() => { tapFeedback(); router.push(`/item/${row.item.id}` as Href); }}
                onAction={() => go(row)}
              />
            ))}

            {rest.length > shown.length ? (
              <Chip label={`Show ${rest.length - shown.length} more`} onPress={() => { tapFeedback(); setShowAll(true); }} />
            ) : null}
          </Section>
        ) : null}

        {/* The other question: what are you allowed to move, and what would it give back? */}
        {couldMove.length ? (
          <Section family="rest" title="Could move" sticker="scales" meta="least important first">
            {couldMove.slice(0, 4).map((row) => (
              <Stack key={row.item.id} gap={2} className="rounded-lg border-2 border-dashed bg-raised px-4 py-3" style={{ borderColor: color.band.busy.fill }}>
                <Stack direction="row" gap={3} align="center">
                  <View
                    className="items-center justify-center rounded-pill"
                    style={{ width: 34, height: 34, backgroundColor: color.area[row.item.bucket].wash }}
                  >
                    <AreaIcon area={row.item.bucket} size={19} />
                  </View>
                  <Stack gap={0} grow>
                    <Text variant="body" weight="semibold" numberOfLines={2}>{row.item.title}</Text>
                    <Text variant="micro" tone="subtle">
                      {dayWord(row.item.date, today)} · {formatHour(row.item.startHour ?? 0)}–{formatHour((row.item.startHour ?? 0) + row.item.hours)}
                    </Text>
                  </Stack>
                  <Tag emoji="⚡" label={`+${Math.max(1, batteryCost(items, row.item, ceilings))}%`} tone="steady" />
                </Stack>
                {/* Why this one, as keywords: what kind of promise, how much it matters, its day, a lighter spot. */}
                <Stack direction="row" gap={1} wrap>
                  {(row.moveTags ?? []).map((tag) => (
                    <Tag key={tag.label} emoji={tag.emoji} label={tag.label} tone={tag.emoji === '🪶' ? 'recovery' : 'plain'} />
                  ))}
                </Stack>
                <Stack direction="row" gap={2} wrap>
                  {/* Make room: give this time to something on the list, then find the block a new home. */}
                  <Chip
                    label="↔️ Move it"
                    tone="selected"
                    onPress={() => { tapFeedback(); router.push(`/swap/${row.item.id}` as Href); }}
                  />
                  {/* Only somebody else's plans need a message; your own idea just moves. */}
                  {row.item.commitment === 'soft' ? (
                    <Chip label="✉️ Message" onPress={() => router.push(`/decline/${row.item.id}`)} />
                  ) : null}
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

/** How soon something has to start, as a colour: today is red, within two days amber. */
const urgency = (row: Ranked, today: string): 'heavy' | 'busy' | 'plain' => {
  if (!row.startBy) return 'plain';
  const days = daysBetween(today, row.startBy);
  return days <= 0 ? 'heavy' : days <= 2 ? 'busy' : 'plain';
};

/** The reason, as a keyword: what the tag on number one says. */
const pushWord = (push: Push, row: Ranked, today: string): string =>
  push.key === 'risk' ? 'Short on time'
    : push.key === 'deadline' ? startLabel(row, today)
      : push.key === 'size' ? (row.kind === 'owing' ? `${remaining(row.item)}h to go` : `${hoursWord(row.item.hours)} block`)
        : push.label;

/** "Wed 12" - a day short enough for a tile. */
const shortDay = (date: string, today: string): string =>
  date === today ? 'Today' : date === addDays(today, 1) ? 'Tomorrow' : `${WEEKDAY[dayIndex(date)]} ${parseISO(date).getUTCDate()}`;

/** A keyword with an emoji, on a soft wash: the page's building block instead of a sentence. */
function Tag({ emoji, label, tone = 'plain' }: { emoji?: string; label: string; tone?: 'plain' | 'steady' | 'busy' | 'heavy' | 'recovery' }) {
  return (
    <View
      className="flex-row items-center gap-1 rounded-pill px-2 py-1"
      style={{ backgroundColor: tone === 'plain' ? color.surface.sunken : color.band[tone].wash }}
    >
      {emoji ? <Text variant="micro">{emoji}</Text> : null}
      <Text variant="micro" weight="semibold" tone={tone === 'plain' ? 'muted' : tone}>{label}</Text>
    </View>
  );
}

/**
 * Number one, answered at a glance: due, needs, costs as tiles, why it is first
 * as tags with strength dots, and the next time it fits.
 */
function Hero({
  row, pushes, cost, fit, needs, today, why, onGo,
}: {
  row: Ranked;
  pushes: Push[];
  cost: number;
  fit: ReturnType<typeof nextFit>;
  needs: number;
  today: string;
  /** The AI's reason, in a line, when it has given one. */
  why?: string;
  onGo: () => void;
}) {
  const { item } = row;
  const due = item.deadline ?? item.date;
  const days = Math.max(0, daysBetween(today, due));

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

        <Stack gap={1}>
          <Text variant="title">{item.title}</Text>
          {why ? <Text variant="footnote" tone="muted" numberOfLines={2}>✨ {why}</Text> : null}
        </Stack>

        {/* Three facts, as tiles: due, needs, costs. */}
        <Stack direction="row" gap={2}>
          <Fact emoji="⏰" label="DUE" value={shortDay(due, today)} sub={days <= 1 ? 'now' : `in ${days} days`} hot={days <= 1} />
          <Fact
            emoji="⏳"
            label="NEEDS"
            value={row.kind === 'owing' ? `${remaining(item)}h` : hoursWord(item.hours)}
            sub={row.kind === 'owing' ? `${percentUndone(item)}% left` : 'no time yet'}
          />
          <Fact emoji="🔋" label="COSTS" value={costLabel(cost)} sub="battery" extra={<DrainBadge value={item.dread} />} />
        </Stack>

        {/* Why it is first: keywords, each with how hard it pushes. */}
        {pushes.length ? (
          <Stack gap={2}>
            <Text variant="micro" tone="muted">WHY FIRST</Text>
            <Stack direction="row" gap={2} wrap>
              {pushes.map((push) => {
                const hot = push.key === 'risk';
                return (
                  <View
                    key={push.key}
                    accessible
                    accessibilityLabel={`${pushWord(push, row, today)}, ${push.strength} of 3`}
                    className="flex-row items-center gap-2 rounded-pill px-3 py-2"
                    style={{ backgroundColor: hot ? color.band.heavy.wash : color.surface.raised }}
                  >
                    <Text variant="caption">{push.emoji}</Text>
                    <Text variant="caption" weight="semibold" tone={hot ? 'heavy' : 'default'}>{pushWord(push, row, today)}</Text>
                    <Stack direction="row" gap={1}>
                      {[1, 2, 3].map((dot) => (
                        <View
                          key={dot}
                          style={{
                            width: 7, height: 7, borderRadius: radius.pill,
                            backgroundColor: dot <= push.strength ? (hot ? color.band.heavy.fill : color.ink.default) : color.surface.track,
                          }}
                        />
                      ))}
                    </Stack>
                  </View>
                );
              })}
            </Stack>
          </Stack>
        ) : null}

        {/* When it could actually happen. */}
        <View
          className="flex-row items-center gap-3 rounded-md px-3 py-3"
          style={{ backgroundColor: fit ? color.band.steady.wash : color.band.heavy.wash }}
        >
          <Text variant="heading">{fit ? '🕑' : '⚠️'}</Text>
          <Text variant="footnote" weight="semibold" tone={fit ? 'steady' : 'heavy'} className="flex-1">
            {fit
              ? `${fit.booked ? 'Booked' : 'Fits'} ${shortDay(fit.date, today)} · ${formatHour(fit.start)}–${formatHour(fit.start + fit.hours)}`
              : 'No gap before it’s due'}
          </Text>
          {fit && !fit.booked && row.kind === 'owing' && needs > 0 ? <Tag label={`${hoursWord(needs)} to plan`} tone="busy" /> : null}
          {!fit ? <Tag label="Move something ↓" tone="heavy" /> : null}
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
 * time that day, with the rank of whatever is due on top - and one bar for
 * the hours the list needs against the hours you have.
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
    fits: { tone: 'steady' as const, line: `✓ Fits · ${spare}h spare` },
    tight: { tone: 'busy' as const, line: `Tight · ${spare}h spare` },
    short: { tone: 'heavy' as const, line: `Short ${Math.abs(spare)}h · move something` },
  }[ahead.verdict];
  const used = ahead.free > 0 ? Math.min(1, ahead.needed / ahead.free) : 1;

  return (
    <Section family="week" title="Next 7 days" meta="free hours a day">
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

      {/* Needs against free, as one bar. */}
      <Stack gap={2}>
        <Stack direction="row" gap={2} align="center">
          <Text variant="footnote" weight="semibold" tone={verdict.tone} className="flex-1">{verdict.line}</Text>
          <Tag emoji="🔋" label={`${charge}%`} tone={TONE[band]} />
        </Stack>
        <View
          accessible
          accessibilityRole="image"
          accessibilityLabel={`${ahead.needed} hours needed of ${ahead.free} free`}
          className="h-3 overflow-hidden rounded-pill"
          style={{ backgroundColor: color.band.recovery.wash }}
        >
          <View style={{ width: `${ahead.needed > 0 ? Math.max(4, used * 100) : 0}%`, height: '100%', backgroundColor: color.band[verdict.tone].fill }} />
        </View>
        <Stack direction="row" justify="between">
          <Text variant="micro" weight="semibold" tone={verdict.tone}>Needs {ahead.needed}h</Text>
          <Text variant="micro" weight="semibold" tone="recovery">Free {ahead.free}h</Text>
        </Stack>
      </Stack>
    </Card>
    </Section>
  );
}

/**
 * One thing after the first: its rank, coloured by how soon it has to start,
 * a row of keywords - start, due, hours - and one button to act on it.
 */
function Row({
  row, rank, today, why, onOpen, onAction,
}: { row: Ranked; rank: number; today: string; why?: string; onOpen: () => void; onAction: () => void }) {
  const { item } = row;
  const due = item.deadline ?? item.date;
  const left = row.kind === 'owing' ? percentUndone(item) : null;
  const action = actionFor(row);
  const hot = urgency(row, today);
  const start = row.startBy ? startLabel(row, today) : dayWord(item.date, today);
  const size = row.kind === 'owing' ? `${remaining(item)}h` : hoursWord(item.hours);
  return (
    <View className="overflow-hidden rounded-lg border-2 border-line-hairline bg-raised">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Number ${rank}. ${item.title}. ${start}${row.kind === 'owing' ? `, due ${dayWord(due, today)}` : ''}, ${size}${left !== null ? `, ${left} percent left` : ''}.`}
        onPress={onOpen}
        className="gap-2 px-4 pb-2 pt-3 active:opacity-70"
      >
        <Stack direction="row" gap={3} align="center">
          <View
            className="items-center justify-center rounded-pill"
            style={{ width: 30, height: 30, backgroundColor: hot === 'plain' ? color.surface.sunken : color.band[hot].wash }}
          >
            <Text variant="callout" weight="bold" tone={hot === 'plain' ? 'muted' : hot}>{rank}</Text>
          </View>
          <Text variant="body" weight="semibold" className="flex-1" numberOfLines={2}>{item.title}</Text>
          {left !== null ? (
            // How much of it is left, as a ring that fills as it gets done.
            <Ring size={50} stroke={5} label={`${left} percent left`} segments={[{ value: (100 - left) / 100, color: color.band.steady.fill }]}>
              <Text variant="micro" weight="bold">{left}%</Text>
              <Text variant="micro" tone="subtle">left</Text>
            </Ring>
          ) : (
            <DrainBadge value={item.dread} />
          )}
        </Stack>
        {why ? <Text variant="micro" tone="muted" numberOfLines={1}>✨ {why}</Text> : null}
      </Pressable>
      <Stack direction="row" gap={2} align="center" className="px-4 pb-3">
        <Stack direction="row" gap={1} wrap className="flex-1">
          <Tag emoji="▶" label={start} tone={hot} />
          <Tag emoji="⏳" label={row.kind === 'owing' ? `${size} · due ${shortDay(due, today)}` : size} />
        </Stack>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${action.label.replace(/^\S+ /, '')}: ${item.title}`}
          onPress={onAction}
          className="min-h-min items-center justify-center rounded-pill bg-inverse px-3 py-1 active:opacity-70"
        >
          <Text variant="micro" weight="bold" tone="inverse">{action.label.replace(/^\S+ /, '')}</Text>
        </Pressable>
      </Stack>
    </View>
  );
}
