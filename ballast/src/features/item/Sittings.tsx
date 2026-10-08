import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, Chip, Door, Stack, Sticker, Text } from '@/components';
import { color, radius } from '@design/tokens';
import { addDays, formatShort, parseISO } from '@/lib/dates';
import {
  MAX_SESSION, MIN_SESSION, bestStart, daysLeft, planSessions, remaining, scheduledHours, sessionItems,
  sittingsOf, unplanned, type Session,
} from '@/lib/prep';
import {
  dayFacts, durationLabel, nowHourFor, sittingLoad, spanLabel, whyThisDay, type DayFact, type Draft,
} from '@/lib/sittings';
import { successFeedback, tapFeedback } from '@/lib/haptics';
import { useStore } from '@/state/store';
import { capacityOf } from '@/lib/load';
import { MarkSheet } from '@/features/marking/MarkSheet';
import type { Item } from '@/lib/types';
import { Cheer } from './Cheer';
import { SittingEditor } from './SittingEditor';

/** A sitting on the drawing board. `origin` is what the planner proposed; none means you added it. */
interface Proposal extends Draft {
  key: string;
  origin?: Draft;
}

const placedOnly = (drafts: Proposal[]): Session[] =>
  drafts.filter((d): d is Proposal & { startHour: number } => d.startHour !== undefined);

const CHART_MAX = 64;

/**
 * Booking the sittings of a longer piece of work.
 *
 * It was one button that booked a plan you could not see first, could not
 * change afterwards, and - pressed a second time - quietly deleted what you had
 * already booked. Now it is three steps that each say what they are doing:
 *
 *   Suggest  - the planner proposes, and every sitting carries its reason
 *   Adjust   - day, time and length, each change priced as you make it
 *   Book     - only what you can see goes in, added to what is already there
 *
 * Booked sittings stay movable here too, so a Tuesday that falls through is a
 * drag rather than a give-back-and-start-again.
 */
export function Sittings({ item, items, autoSuggest = false }: { item: Item; items: Item[]; autoSuggest?: boolean }) {
  const router = useRouter();
  const { today, scheduleSessions, unscheduleSession, updateSession, pushSittings, ceilings } = useStore();
  const [marking, setMarking] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Proposal[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [moving, setMoving] = useState<Draft | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cheer, setCheer] = useState<{ id: number; title: string; sub?: string } | null>(null);

  useEffect(() => {
    if (!cheer) return;
    const timer = setTimeout(() => setCheer(null), 2800);
    return () => clearTimeout(timer);
  }, [cheer]);

  const nowHour = nowHourFor(today);
  const plan = planSessions(item, items, today, nowHour);
  const loose = unplanned(item, items);
  const sittings = sittingsOf(item, items);
  const ticked = sittings.filter((s) => s.sessionDone).length;
  const due = item.deadline ?? item.date;
  const placedHours = (drafts ?? []).reduce((total, d) => total + d.hours, 0);
  const leftToPlace = Math.max(0, Math.round((loose - placedHours) * 10) / 10);
  const facts = dayFacts(item, items, today, drafts ?? []);
  const factOf = (date: string) => facts.find((fact) => fact.date === date);
  const overBooked = Math.round((scheduledHours(item, items) - remaining(item)) * 10) / 10;

  /** The week with every draft but this one in it, so two drafts never overlap. */
  const busyFor = (key?: string) => [...items, ...sessionItems(item, placedOnly((drafts ?? []).filter((d) => d.key !== key)))];

  const suggest = () => {
    successFeedback();
    setNotice(null);
    setOpen(null);
    setMoving(null);
    setDrafts(plan.map((session, index) => ({
      key: `suggested-${index}-${session.date}-${session.startHour}`,
      date: session.date,
      startHour: session.startHour,
      hours: session.hours,
      origin: { date: session.date, startHour: session.startHour, hours: session.hours },
    })));
  };

  /** One more sitting, on the lightest day that still has a gap for it. */
  const addOne = () => {
    const current = drafts ?? [];
    const left = Math.max(0, Math.round((loose - current.reduce((t, d) => t + d.hours, 0)) * 10) / 10);
    if (left <= 0) return;
    const busy = [...items, ...sessionItems(item, placedOnly(current))];
    const order = [...dayFacts(item, items, today, current)].sort(
      (a, b) => Number(a.isDue) - Number(b.isDue) || a.load + a.adding - (b.load + b.adding),
    );
    for (let hours = Math.min(MAX_SESSION, Math.max(MIN_SESSION, Math.ceil(left * 2) / 2)); hours >= MIN_SESSION; hours -= 0.5) {
      for (const fact of order) {
        const startHour = bestStart(busy, fact.date, hours, fact.date === today ? nowHour : undefined);
        if (startHour === undefined) continue;
        const key = `added-${Date.now()}`;
        tapFeedback();
        setNotice(null);
        setMoving(null);
        setDrafts([...current, { key, date: fact.date, startHour, hours }]);
        setOpen(key);
        return;
      }
    }
    setNotice(`No gap of ${durationLabel(MIN_SESSION)} left before ${formatShort(due)}.`);
  };

  const book = () => {
    const ready = placedOnly(drafts ?? []);
    if (!ready.length) return;
    const hours = ready.reduce((total, d) => total + d.hours, 0);
    const days = new Set(ready.map((d) => d.date)).size;
    const after = Math.max(0, Math.round((loose - hours) * 10) / 10);
    scheduleSessions(item.id, ready.map(({ date, startHour, hours: h }) => ({ date, startHour, hours: h })));
    successFeedback();
    setDrafts(null);
    setOpen(null);
    setCheer({
      id: Date.now(),
      title: `Booked ${durationLabel(hours)} over ${days} day${days === 1 ? '' : 's'}`,
      sub: after > 0 ? `${durationLabel(after)} still loose` : 'Nothing left loose. Every hour has a home.',
    });
  };

  // Arriving from "Suggest N sittings" on the task page opens straight onto them.
  useEffect(() => {
    if (autoSuggest && plan.length && !drafts) suggest();
    // Once, on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startMove = (session: Item) => {
    tapFeedback();
    if (open === session.id) { setOpen(null); setMoving(null); return; }
    setOpen(session.id);
    setMoving({ date: session.date, startHour: session.startHour, hours: session.hours });
  };

  const saveMove = (session: Item) => {
    if (!moving || moving.startHour === undefined) return;
    updateSession(session.id, moving);
    successFeedback();
    setOpen(null);
    setMoving(null);
    setCheer({ id: Date.now(), title: `Moved to ${formatShort(moving.date)}`, sub: spanLabel(moving) });
  };

  return (
    <Stack gap={4}>
      {cheer ? <Cheer key={cheer.id} title={cheer.title} sub={cheer.sub} /> : null}
      <MarkSheet itemId={marking} onClose={() => setMarking(null)} />

      {/* ------------------------------------------------ what is already booked */}
      {sittings.length ? (
        <Card gap={3}>
          <Stack direction="row" justify="between" align="center">
            <Text variant="heading">Your sittings</Text>
            <View className="rounded-pill bg-steady-wash px-3 py-1">
              <Text variant="micro" tone="steady">{ticked}/{sittings.length} DONE</Text>
            </View>
          </Stack>
          {overBooked > 0 ? (
            <Text variant="footnote" tone="busy">{durationLabel(overBooked)} more booked than is left. Give one back?</Text>
          ) : null}
          {sittings.map((session) => {
            const editing = open === session.id && moving;
            const busy = items.filter((i) => i.id !== session.id);
            return (
              <Stack key={session.id} gap={3} className={`rounded-md p-3 ${session.sessionDone ? 'bg-steady-wash' : 'bg-sunken'}`}>
                <Stack direction="row" gap={3} align="center">
                  <DateBlock date={session.date} today={today} tone={session.sessionDone ? 'steady' : 'recovery'} />
                  <Stack gap={1} grow>
                    <Text variant="body" weight="semibold" tone={session.startHour === undefined && !session.sessionDone ? 'heavy' : 'default'}>
                      {spanLabel(session)}
                    </Text>
                    <Text variant="footnote" tone={session.sessionDone ? 'steady' : 'muted'}>
                      {session.sessionDone
                        ? `Done · ${durationLabel(session.hours)} on the bar`
                        : `${durationLabel(session.hours)} · 🔋 −${Math.max(1, Math.round((sittingLoad(item, session.hours) / capacityOf(ceilings)) * 100))}%`}
                    </Text>
                  </Stack>
                </Stack>
                {session.sessionDone ? null : (
                  <Stack direction="row" gap={2} wrap>
                    <Chip label="How much? ✓" tone="steady" onPress={() => { tapFeedback(); setMarking(session.id); }} />
                    <Chip
                      label={session.startHour === undefined ? 'Pick a time' : open === session.id ? 'Close' : 'Move'}
                      tone={session.startHour === undefined ? 'heavy' : open === session.id ? 'selected' : 'plain'}
                      onPress={() => startMove(session)}
                    />
                    <Chip label="Give it back" onPress={() => { unscheduleSession(session.id); tapFeedback(); }} />
                  </Stack>
                )}
                {editing ? (
                  <Stack gap={3}>
                    <SittingEditor
                      item={item}
                      busy={busy}
                      base={busy}
                      today={today}
                      nowHour={nowHour}
                      value={moving}
                      origin={{ date: session.date, startHour: session.startHour, hours: session.hours }}
                      maxHours={session.hours + loose}
                      onChange={setMoving}
                    />
                    <Button
                      label={moving.startHour === undefined ? 'Pick a time first' : 'Save change'}
                      kind="steady"
                      disabled={moving.startHour === undefined}
                      onPress={() => saveMove(session)}
                    />
                  </Stack>
                ) : null}
              </Stack>
            );
          })}
          {sittings.some((s) => s.date === today && !s.sessionDone) && daysLeft(item, today) > 0 ? (
            <Chip
              label="Push today’s to tomorrow"
              onPress={() => {
                pushSittings(item.id, today, addDays(today, 1));
                successFeedback();
                setCheer({ id: Date.now(), title: 'Pushed to tomorrow', sub: 'Pick a time for it below.' });
              }}
            />
          ) : null}
        </Card>
      ) : null}

      {/* ------------------------------------------------ the planner */}
      {drafts ? (
        <View className="rounded-lg border-2 p-5" style={{ borderColor: color.decor.lilac, backgroundColor: color.surface.raised }}>
          <Stack gap={4}>
            <Stack direction="row" gap={3} align="center">
              <View className="items-center justify-center rounded-pill" style={{ width: 44, height: 44, backgroundColor: color.area.mental.wash }}>
                <Sticker name="sparkle" size={30} wiggle />
              </View>
              <Stack gap={1} grow>
                <Text variant="heading">{drafts.some((d) => d.origin) ? 'Suggested for you' : 'Your plan'}</Text>
                <Text variant="footnote" tone="muted">Lightest days first · due day kept clear</Text>
              </Stack>
              <Chip label="Cancel" onPress={() => { tapFeedback(); setDrafts(null); setOpen(null); setNotice(null); }} />
            </Stack>

            <DayChart facts={facts} capacity={capacityOf(ceilings)} />

            {drafts.map((draft) => {
              const fact = factOf(draft.date);
              const isOpen = open === draft.key;
              const edited = draft.origin && (
                draft.origin.date !== draft.date || draft.origin.startHour !== draft.startHour || draft.origin.hours !== draft.hours
              );
              return (
                <Stack key={draft.key} gap={3} className={`rounded-md p-3 ${isOpen ? 'bg-recovery-wash' : 'bg-sunken'}`}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ expanded: isOpen }}
                    accessibilityLabel={`${formatShort(draft.date)}, ${spanLabel(draft)}. ${isOpen ? 'Close' : 'Adjust'}`}
                    onPress={() => { tapFeedback(); setMoving(null); setOpen(isOpen ? null : draft.key); }}
                    className="active:opacity-70"
                  >
                    <Stack direction="row" gap={3} align="center">
                      <DateBlock date={draft.date} today={today} tone="recovery" />
                      <Stack gap={2} grow>
                        <Stack direction="row" gap={2} align="center" wrap>
                          <Text variant="body" weight="semibold" tone={draft.startHour === undefined ? 'heavy' : 'default'}>{spanLabel(draft)}</Text>
                          <Text variant="footnote" tone="muted">{durationLabel(draft.hours)}</Text>
                          {!draft.origin ? <Badge label="ADDED" tone="mental" /> : edited ? <Badge label="EDITED" tone="busy" /> : null}
                        </Stack>
                        {fact ? (
                          <Stack direction="row" gap={1} wrap>
                            {whyThisDay(fact, capacityOf(ceilings)).map((reason, index) => (
                              <Reason key={reason} label={reason} lead={index === 0} due={fact.isDue} />
                            ))}
                          </Stack>
                        ) : null}
                      </Stack>
                      <Text variant="caption" tone="muted">{isOpen ? 'Done' : 'Adjust'}</Text>
                    </Stack>
                  </Pressable>
                  {isOpen ? (
                    <Stack gap={3}>
                      <SittingEditor
                        item={item}
                        busy={busyFor(draft.key)}
                        base={items}
                        today={today}
                        nowHour={nowHour}
                        value={{ date: draft.date, startHour: draft.startHour, hours: draft.hours }}
                        origin={draft.origin}
                        maxHours={loose - (placedHours - draft.hours)}
                        onChange={(next) => setDrafts(drafts.map((d) => (d.key === draft.key ? { ...d, ...next } : d)))}
                      />
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Remove this sitting"
                        onPress={() => { tapFeedback(); setOpen(null); setDrafts(drafts.filter((d) => d.key !== draft.key)); }}
                        className="min-h-min justify-center self-start active:opacity-60"
                      >
                        <Text variant="caption" tone="heavy">Remove this sitting</Text>
                      </Pressable>
                    </Stack>
                  ) : null}
                </Stack>
              );
            })}

            <Stack direction="row" gap={3} align="center">
              <View className="h-3 flex-1 flex-row overflow-hidden rounded-pill bg-track">
                <View style={{ flexGrow: placedHours || 0.0001, backgroundColor: color.band.recovery.fill }} />
                <View style={{ flexGrow: leftToPlace || 0.0001 }} />
              </View>
              <Text variant="footnote" weight="semibold" tone={leftToPlace > 0 ? 'busy' : 'steady'}>
                {leftToPlace > 0
                  ? `${durationLabel(placedHours)} of ${durationLabel(loose)} · ${durationLabel(leftToPlace)} loose`
                  : `All ${durationLabel(loose)} placed`}
              </Text>
            </Stack>

            {notice ? <Text variant="footnote" tone="heavy">{notice}</Text> : null}
            {leftToPlace > 0 ? <Button label="+ Add a sitting" kind="secondary" onPress={addOne} /> : null}
            {placedOnly(drafts).length ? (
              <Button
                label={`Book ${placedOnly(drafts).length} sitting${placedOnly(drafts).length === 1 ? '' : 's'} · ${durationLabel(placedOnly(drafts).reduce((t, d) => t + d.hours, 0))}`}
                onPress={book}
              />
            ) : null}
          </Stack>
        </View>
      ) : loose > 0 ? (
        <View className="rounded-lg p-5" style={{ backgroundColor: color.area.mental.wash }}>
          <Stack gap={4}>
            <Stack direction="row" gap={3} align="center">
              <View className="items-center justify-center rounded-pill bg-raised" style={{ width: 52, height: 52 }}>
                <Sticker name="sparkle" size={36} wiggle />
              </View>
              <Stack gap={1} grow>
                <Text variant="heading">{durationLabel(loose)} still loose</Text>
                <Text variant="footnote" tone="muted">
                  {plan.length
                    ? `${plan.length} sitting${plan.length === 1 ? '' : 's'} fit before ${formatShort(due)}`
                    : `No gap of ${durationLabel(MIN_SESSION)} left before ${formatShort(due)}`}
                </Text>
              </Stack>
            </Stack>
            {plan.length ? (
              <Button label={`✨ Suggest ${plan.length} sitting${plan.length === 1 ? '' : 's'}`} onPress={suggest} />
            ) : (
              <Button label="See what could move" onPress={() => router.push('/rebalance')} />
            )}
            {plan.length ? (
              <Button label="Plan my own" kind="quiet" onPress={() => { setDrafts([]); setOpen(null); setMoving(null); addOne(); }} />
            ) : null}
          </Stack>
        </View>
      ) : null}
    </Stack>
  );
}

/** A day as a tile: three letters over the date, tinted by what is in it. */
function DateBlock({ date, today, tone }: { date: string; today: string; tone: 'recovery' | 'steady' }) {
  const isToday = date === today;
  return (
    <View
      className="items-center justify-center rounded-md"
      style={{
        width: 52, height: 56,
        backgroundColor: isToday ? color.surface.inverse : color.band[tone].wash,
        borderWidth: 1, borderColor: isToday ? color.surface.inverse : color.band[tone].fill,
      }}
    >
      <Text variant="micro" tone={isToday ? 'inverse' : tone}>
        {isToday ? 'TODAY' : formatShort(date).slice(0, 3).toUpperCase()}
      </Text>
      <Text variant="heading" tone={isToday ? 'inverse' : 'default'}>{parseISO(date).getUTCDate()}</Text>
    </View>
  );
}

function Badge({ label, tone }: { label: string; tone: 'mental' | 'busy' }) {
  return (
    <View
      className="rounded-pill px-2 py-1"
      style={{ backgroundColor: tone === 'mental' ? color.area.mental.wash : color.band.busy.wash }}
    >
      <Text variant="micro" tone={tone === 'busy' ? 'busy' : 'default'}>{label}</Text>
    </View>
  );
}

/** One fact behind a suggestion. The first is the reason; the rest are the evidence. */
function Reason({ label, lead, due }: { label: string; lead: boolean; due: boolean }) {
  const box = lead ? (due ? 'bg-heavy-wash' : 'bg-steady-wash') : 'bg-raised';
  return (
    <View className={`rounded-pill px-2 py-1 ${box}`}>
      <Text variant="micro" tone={lead ? (due ? 'heavy' : 'steady') : 'muted'}>{label}</Text>
    </View>
  );
}

/**
 * Every day before the deadline, and what the plan adds to each.
 *
 * This is the "why" at a glance: the sittings sit on the short bars. Grey is
 * what the day already carries, blue is what the plan puts on top of it. The
 * grey is deliberately not band-coloured - banding each day against the
 * heaviest one painted a chosen day red, which read as "the app picked a bad
 * day" when it had picked the second-lightest.
 */
function DayChart({ facts, capacity }: { facts: DayFact[]; capacity: number }) {
  const pct = (load: number) => Math.round((load / capacity) * 100);
  const peak = Math.max(...facts.map((f) => f.load + f.adding), 1);
  const spoken = facts
    .map((f) => `${formatShort(f.date)}, uses ${pct(f.load)} percent${f.adding ? `, plus ${pct(f.adding)} from this plan` : ''}${f.isDue ? ', due' : ''}`)
    .join('. ');

  const columns = (
    <Stack direction="row" gap={2} align="end" className="w-full">
      {facts.map((fact) => {
        const picked = fact.adding > 0;
        return (
          <Stack key={fact.date} gap={1} align="center" style={{ flexGrow: 1, minWidth: 40 }}>
            <Text variant="micro" tone={fact.adding ? 'recovery' : 'subtle'}>
              {fact.adding ? `+${pct(fact.adding)}%` : `${pct(fact.load)}%`}
            </Text>
            <View className="w-full items-center justify-end" style={{ height: CHART_MAX }}>
              <View style={{ width: 22, borderRadius: radius.sm, overflow: 'hidden' }}>
                {fact.adding ? (
                  <View style={{ height: Math.max(4, (fact.adding / peak) * CHART_MAX), backgroundColor: color.band.recovery.fill }} />
                ) : null}
                <View style={{ height: Math.max(4, (fact.load / peak) * CHART_MAX), backgroundColor: picked ? color.ink.subtle : color.line.strong }} />
              </View>
            </View>
            <Text variant="micro" weight={picked ? 'bold' : 'semibold'} tone={fact.isDue ? 'heavy' : picked ? 'default' : 'subtle'}>
              {fact.isDue ? 'DUE' : fact.isToday ? 'TODAY' : formatShort(fact.date).slice(0, 3).toUpperCase()}
            </Text>
            <Text variant="micro" tone="subtle">{parseISO(fact.date).getUTCDate()}</Text>
          </Stack>
        );
      })}
    </Stack>
  );

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={spoken} className="rounded-md bg-sunken px-3 py-3">
      {facts.length > 7 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>{columns}</ScrollView>
      ) : columns}
    </View>
  );
}

/**
 * The task page's view of its sittings: the next few, each one tap from done,
 * and the way into the full planner. Planning, moving and adding live on their
 * own page - here they would bury the progress they are meant to serve.
 */
export function SittingsPreview({
  item, items, onOpen, onSuggest,
}: { item: Item; items: Item[]; onOpen: () => void; onSuggest: () => void }) {
  const { today } = useStore();
  const [marking, setMarking] = useState<string | null>(null);
  const sittings = sittingsOf(item, items);
  const upcoming = sittings.filter((s) => !s.sessionDone && s.outcome !== 'missed').slice(0, 3);
  const ticked = sittings.filter((s) => s.sessionDone).length;
  const loose = unplanned(item, items);
  const plan = planSessions(item, items, today, nowHourFor(today));
  const due = item.deadline ?? item.date;

  return (
    <Stack gap={3}>
      {upcoming.map((session) => (
        <Stack key={session.id} direction="row" gap={3} align="center" className="rounded-md bg-raised px-3 py-2">
          <DateBlock date={session.date} today={today} tone="recovery" />
          <Stack gap={1} grow>
            <Text variant="body" weight="semibold" tone={session.startHour === undefined ? 'heavy' : 'default'}>{spanLabel(session)}</Text>
            <Text variant="micro" tone="subtle">{durationLabel(session.hours)}</Text>
          </Stack>
          <Chip
            label="How much? ✓"
            tone="steady"
            onPress={() => { tapFeedback(); setMarking(session.id); }}
          />
        </Stack>
      ))}
      <MarkSheet itemId={marking} onClose={() => setMarking(null)} />
      {!sittings.length ? <Text variant="footnote" tone="muted">Nothing booked yet.</Text> : null}

      {loose > 0 ? (
        <Stack gap={3} className="rounded-md bg-raised px-4 py-4">
          <Stack gap={1}>
            <Text variant="heading">{durationLabel(loose)} still loose</Text>
            <Text variant="footnote" tone="muted">
              {plan.length
                ? `${plan.length} sitting${plan.length === 1 ? '' : 's'} fit before ${formatShort(due)}`
                : `No gap of ${durationLabel(MIN_SESSION)} left before ${formatShort(due)}`}
            </Text>
          </Stack>
          {plan.length ? (
            <Button label={`✨ Suggest ${plan.length} sitting${plan.length === 1 ? '' : 's'}`} onPress={onSuggest} />
          ) : null}
        </Stack>
      ) : null}

      <Door
        family="week"
        title="Plan, move or add sittings"
        sub={sittings.length ? `${ticked} of ${sittings.length} done` : 'Pick days and times yourself'}
        onPress={onOpen}
      />
    </Stack>
  );
}
