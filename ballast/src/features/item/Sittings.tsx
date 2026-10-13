import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Chip, Door, Stack, Sticker, Text } from '@/components';
import { color, radius } from '@design/tokens';
import { addDays, formatShort, parseISO } from '@/lib/dates';
import {
  MAX_SESSION, MIN_SESSION, bestStart, bookingDays, daysLeft, planSessions, remaining, scheduledHours, sessionItems,
  sittingsOf, unplanned, type Session,
} from '@/lib/prep';
import {
  dayFacts, durationLabel, nowHourFor, sittingLoad, spanLabel, whyThisDay, type Draft,
} from '@/lib/sittings';
import { successFeedback, tapFeedback } from '@/lib/haptics';
import { useStore } from '@/state/store';
import { capacityOf } from '@/lib/load';
import { MarkSheet } from '@/features/marking/MarkSheet';
import type { Item } from '@/lib/types';
import { Cheer } from './Cheer';
import { SittingEditor } from './SittingEditor';
import { RehomeSheet } from './MoveItem';
import { displacedBy } from '@/lib/replace';

/** A sitting on the drawing board. `origin` is what the planner proposed; none means you added it. */
interface Proposal extends Draft {
  key: string;
  origin?: Draft;
}

const placedOnly = (drafts: Proposal[]): Session[] =>
  drafts.filter((d): d is Proposal & { startHour: number } => d.startHour !== undefined);


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
  // Blocks a booking landed on, waiting for a new time.
  const [rehome, setRehome] = useState<string[]>([]);
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
    // Lightest days before it is due first; only then the rest of this week and next.
    const order = [
      ...[...dayFacts(item, items, today, current)].sort(
        (a, b) => Number(a.isDue) - Number(b.isDue) || a.load + a.adding - (b.load + b.adding),
      ).map((fact) => fact.date),
      ...bookingDays(today).filter((date) => date > due),
    ];
    for (let hours = Math.min(MAX_SESSION, Math.max(MIN_SESSION, Math.ceil(left * 2) / 2)); hours >= MIN_SESSION; hours -= 0.5) {
      for (const date of order) {
        const startHour = bestStart(busy, date, hours, date === today ? nowHour : undefined);
        if (startHour === undefined) continue;
        const key = `added-${Date.now()}`;
        tapFeedback();
        setNotice(null);
        setMoving(null);
        setDrafts([...current, { key, date, startHour, hours }]);
        setOpen(key);
        return;
      }
    }
    setNotice(`No gap of ${durationLabel(MIN_SESSION)} left this week or next.`);
  };

  const book = () => {
    const ready = placedOnly(drafts ?? []);
    if (!ready.length) return;
    const hours = ready.reduce((total, d) => total + d.hours, 0);
    const days = new Set(ready.map((d) => d.date)).size;
    const after = Math.max(0, Math.round((loose - hours) * 10) / 10);
    // Anything you could give up that a sitting landed on gets a new time straight after.
    const pushed = [...new Set(ready.flatMap((d) => displacedBy(items, d).map((block) => block.id)))];
    scheduleSessions(item.id, ready.map(({ date, startHour, hours: h }) => ({ date, startHour, hours: h })));
    if (pushed.length) setRehome(pushed);
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
    const pushed = displacedBy(items, moving, session.id).map((block) => block.id);
    updateSession(session.id, moving);
    successFeedback();
    if (pushed.length) setRehome(pushed);
    setOpen(null);
    setMoving(null);
    setCheer({ id: Date.now(), title: `Moved to ${formatShort(moving.date)}`, sub: spanLabel(moving) });
  };

  const done = Math.round((item.prepDone ?? 0) * 10) / 10;
  const booked = Math.round(sittings.filter((x) => !x.sessionDone).reduce((t, x) => t + x.hours, 0) * 10) / 10;
  const total = Math.max(item.prepHours ?? 0, done + booked + loose, 0.1);
  const [menu, setMenu] = useState<string | null>(null);

  return (
    <Stack gap={4}>
      {cheer ? <Cheer key={cheer.id} title={cheer.title} sub={cheer.sub} /> : null}
      <MarkSheet itemId={marking} onClose={() => setMarking(null)} />
      <RehomeSheet ids={rehome} onClose={() => setRehome([])} />

      {/* ------------------------------------------------ where the work stands, in one bar */}
      <Stack gap={3} className="rounded-xl bg-raised px-4 py-4" style={{ borderWidth: 2, borderColor: color.line.hairline }}>
        <View className="h-3 flex-row overflow-hidden rounded-pill bg-track">
          <View style={{ flexGrow: done || 0.0001, backgroundColor: color.band.steady.fill }} />
          <View style={{ flexGrow: booked || 0.0001, backgroundColor: color.band.recovery.fill }} />
          <View style={{ flexGrow: loose || 0.0001 }} />
        </View>
        <Stack direction="row" gap={2}>
          {[
            { label: 'done', value: done, tint: color.band.steady.fill },
            { label: 'booked', value: booked, tint: color.band.recovery.fill },
            { label: 'loose', value: loose, tint: color.line.strong },
          ].map((part) => (
            <Stack key={part.label} direction="row" gap={1} align="center" className="flex-1">
              <View style={{ width: 8, height: 8, borderRadius: radius.pill, backgroundColor: part.tint }} />
              <Text variant="caption" weight="bold">{durationLabel(part.value)}</Text>
              <Text variant="micro" tone="subtle">{part.label}</Text>
            </Stack>
          ))}
        </Stack>
        <Text variant="micro" tone="subtle">{durationLabel(total)} of work · due {formatShort(due)}</Text>
      </Stack>

      {/* ------------------------------------------------ what is already booked */}
      {sittings.length ? (
        <Stack gap={2}>
          <Stack direction="row" justify="between" align="center">
            <Text variant="heading">Booked</Text>
            <Text variant="micro" tone="steady">{ticked}/{sittings.length} DONE</Text>
          </Stack>
          {overBooked > 0 ? (
            <Text variant="footnote" tone="busy">{durationLabel(overBooked)} more booked than is left. Give one back?</Text>
          ) : null}
          {sittings.map((session) => {
            const editing = open === session.id && moving;
            const busy = items.filter((i) => i.id !== session.id);
            const showMenu = menu === session.id && !editing;
            return (
              <Stack key={session.id} gap={3} className={`rounded-lg px-3 py-3 ${session.sessionDone ? 'bg-steady-wash' : 'bg-raised'}`} style={{ borderWidth: 1, borderColor: color.line.hairline }}>
                <Stack direction="row" gap={3} align="center">
                  <DateBlock date={session.date} today={today} tone={session.sessionDone ? 'steady' : 'recovery'} />
                  <Stack gap={0} grow>
                    <Text variant="body" weight="semibold" tone={session.startHour === undefined && !session.sessionDone ? 'heavy' : 'default'}>
                      {spanLabel(session)}
                    </Text>
                    <Text variant="micro" tone={session.sessionDone ? 'steady' : 'subtle'}>
                      {session.sessionDone
                        ? `✓ Done · ${durationLabel(session.hours)}`
                        : `${durationLabel(session.hours)} · 🔋 −${Math.max(1, Math.round((sittingLoad(item, session.hours) / capacityOf(ceilings)) * 100))}%`}
                    </Text>
                  </Stack>
                  {session.sessionDone ? null : (
                    <>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Mark ${spanLabel(session)}`}
                        onPress={() => { tapFeedback(); setMarking(session.id); }}
                        className="min-h-min min-w-min items-center justify-center rounded-pill active:opacity-70"
                        style={{ backgroundColor: color.band.steady.wash }}
                      >
                        <Text variant="heading" tone="steady">✓</Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="More"
                        onPress={() => { tapFeedback(); setMenu(showMenu ? null : session.id); if (editing) { setOpen(null); setMoving(null); } }}
                        className="min-h-min min-w-min items-center justify-center rounded-pill bg-sunken active:opacity-70"
                      >
                        <Text variant="heading" tone="muted">⋯</Text>
                      </Pressable>
                    </>
                  )}
                </Stack>
                {showMenu ? (
                  <Stack direction="row" gap={2}>
                    <Chip label={session.startHour === undefined ? '🕒 Pick a time' : '↔️ Move'} tone="selected" onPress={() => { setMenu(null); startMove(session); }} />
                    <Chip label="Give it back" onPress={() => { unscheduleSession(session.id); setMenu(null); tapFeedback(); }} />
                  </Stack>
                ) : null}
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
                      replace
                    />
                    <Stack direction="row" gap={2}>
                      <Button label="Cancel" kind="secondary" className="flex-1" onPress={() => { tapFeedback(); setOpen(null); setMoving(null); }} />
                      <Button
                        label={moving.startHour === undefined ? 'Pick a time first' : 'Save'}
                        kind="steady"
                        className="flex-[2]"
                        disabled={moving.startHour === undefined}
                        onPress={() => saveMove(session)}
                      />
                    </Stack>
                  </Stack>
                ) : null}
              </Stack>
            );
          })}
          {sittings.some((x) => x.date === today && !x.sessionDone) && daysLeft(item, today) > 0 ? (
            <Chip
              label="Push today’s to tomorrow"
              onPress={() => {
                pushSittings(item.id, today, addDays(today, 1));
                successFeedback();
                setCheer({ id: Date.now(), title: 'Pushed to tomorrow', sub: 'Pick a time for it below.' });
              }}
            />
          ) : null}
        </Stack>
      ) : null}

      {/* ------------------------------------------------ the planner */}
      {drafts ? (
        <Stack gap={3} className="rounded-xl p-4" style={{ borderWidth: 2, borderColor: color.decor.lilac, backgroundColor: color.area.mental.wash }}>
          <Stack direction="row" gap={3} align="center">
            <Sticker name="sparkle" size={30} wiggle />
            <Text variant="heading" className="flex-1">{drafts.some((d) => d.origin) ? 'Suggested' : 'Your plan'}</Text>
            <Pressable accessibilityRole="button" onPress={() => { tapFeedback(); setDrafts(null); setOpen(null); setNotice(null); }} className="min-h-min justify-center active:opacity-60">
              <Text variant="caption" weight="semibold" tone="muted">Cancel</Text>
            </Pressable>
          </Stack>

          {drafts.map((draft) => {
            const fact = factOf(draft.date);
            const isOpen = open === draft.key;
            const edited = draft.origin && (
              draft.origin.date !== draft.date || draft.origin.startHour !== draft.startHour || draft.origin.hours !== draft.hours
            );
            const reason = draft.date > due ? 'After it’s due' : fact ? whyThisDay(fact, capacityOf(ceilings))[0] : null;
            return (
              <Stack key={draft.key} gap={3} className="rounded-lg bg-raised p-3">
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: isOpen }}
                  accessibilityLabel={`${formatShort(draft.date)}, ${spanLabel(draft)}. ${isOpen ? 'Close' : 'Change'}`}
                  onPress={() => { tapFeedback(); setMoving(null); setOpen(isOpen ? null : draft.key); }}
                  className="active:opacity-70"
                >
                  <Stack direction="row" gap={3} align="center">
                    <DateBlock date={draft.date} today={today} tone="recovery" />
                    <Stack gap={1} grow>
                      <Text variant="body" weight="semibold" tone={draft.startHour === undefined ? 'heavy' : 'default'}>{spanLabel(draft)}</Text>
                      <Stack direction="row" gap={1} align="center" wrap>
                        <Text variant="micro" tone="subtle">{durationLabel(draft.hours)}</Text>
                        {reason ? <Reason label={reason} lead due={reason === 'Due day' || reason === 'After it’s due'} /> : null}
                        {!draft.origin ? <Badge label="ADDED" tone="mental" /> : edited ? <Badge label="EDITED" tone="busy" /> : null}
                      </Stack>
                    </Stack>
                    <Text variant="caption" weight="semibold" tone="muted">{isOpen ? 'Done' : 'Change'}</Text>
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
                      replace
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

          <Text variant="footnote" weight="semibold" tone={leftToPlace > 0 ? 'busy' : 'steady'}>
            {leftToPlace > 0 ? `${durationLabel(leftToPlace)} still to place` : `✓ All ${durationLabel(loose)} placed`}
          </Text>
          {notice ? <Text variant="footnote" tone="heavy">{notice}</Text> : null}
          <Stack direction="row" gap={2}>
            {leftToPlace > 0 ? <Button label="+ Add" kind="secondary" className="flex-1" onPress={addOne} /> : null}
            {placedOnly(drafts).length ? (
              <Button
                label={`Book ${placedOnly(drafts).length} · ${durationLabel(placedOnly(drafts).reduce((t, d) => t + d.hours, 0))}`}
                className="flex-[2]"
                onPress={book}
              />
            ) : null}
          </Stack>
        </Stack>
      ) : loose > 0 ? (
        <Stack gap={3} className="rounded-xl p-4" style={{ backgroundColor: color.area.mental.wash }}>
          <Stack direction="row" gap={3} align="center">
            <Sticker name="sparkle" size={36} wiggle />
            <Stack gap={0} grow>
              <Text variant="heading">{durationLabel(loose)} still loose</Text>
              <Text variant="micro" tone="subtle">
                {plan.length
                  ? `${plan.length} sitting${plan.length === 1 ? '' : 's'} fit before ${formatShort(due)}`
                  : `No gap before ${formatShort(due)} · book any day this or next week`}
              </Text>
            </Stack>
          </Stack>
          {plan.length ? <Button label={`✨ Suggest ${plan.length} sitting${plan.length === 1 ? '' : 's'}`} onPress={suggest} /> : null}
          <Button
            label="Pick days myself"
            kind={plan.length ? 'quiet' : 'primary'}
            onPress={() => { setDrafts([]); setOpen(null); setMoving(null); addOne(); }}
          />
        </Stack>
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
