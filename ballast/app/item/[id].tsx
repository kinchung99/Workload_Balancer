import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  AreaIcon, Button, Card, Chip, DreadPicker, PageHeader, Screen, Stack, Sticker, Text,
} from '@/components';
import { color } from '@design/tokens';
import { BUCKET_LABEL, COMMITMENT_LABEL, describeMix, loadOf } from '@/lib/load';
import { daysLeft, isAtRisk, needsPrep, percentUndone, remaining, scheduledHours, sittingsOf, unplanned } from '@/lib/prep';
import { formatHour, startOptions } from '@/lib/schedule';
import { addDays, formatShort } from '@/lib/dates';
import { successFeedback, tapFeedback } from '@/lib/haptics';
import { useStore } from '@/state/store';
import { useItemsWithLogs } from '@/state/selectors';
import { planSessions, unplaced } from '@/lib/prep';
import { isProtectedClass, FLAG_LABEL } from '@/lib/timetable';

const UNBOOKED = [0.5, 1, 2];

/**
 * Two real items, so `/item/...` renders in the static export rather than the
 * not-found state — one piece of owing work and one flagged class.
 */
export async function generateStaticParams() {
  return [{ id: 'algo-set' }, { id: 'class-os-0-9' }];
}

/**
 * One thing, and everything you can do to it.
 *
 * The lists used to carry their own controls: every owing card had Plan it,
 * Progress, Book sittings and Push, every timeline row had Move, Unschedule and
 * a slot picker. Three pieces of work on one day meant a dozen buttons on a
 * screen whose job was to tell you what your day looked like.
 *
 * So the lists are read-only now, and this is where the verbs live. Tap a row,
 * get a page. Nothing is hidden — it is one tap further away, and the screen you
 * came from is legible again.
 */
export default function ItemDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const {
    today, setDread, scheduleItem, scheduleSessions, completeSitting, logUnbookedHours,
    unscheduleSession, setSessionNote, pushSittings, moveItem,
  } = useStore();
  const items = useItemsWithLogs();
  const [note, setNote] = useState('');

  const item = items.find((candidate) => candidate.id === id);
  if (!item) {
    return (
      <Screen back="/plan" backLabel="Plan">
        <Stack gap={4} className="pt-6">
          <PageHeader sticker="cloud" wash={color.decor.sky} title="Not in your week" sub="It may have been done or given back." />
        </Stack>
      </Screen>
    );
  }

  const owing = needsPrep(item);
  const sittings = sittingsOf(item, items);
  const slots = startOptions(items, item.date, item.hours);
  const plan = planSessions(item, items, today);
  const risk = owing && isAtRisk(item, items, today);
  const locked = isProtectedClass(item) || item.commitment === 'hard';

  return (
    <Screen
      back="/plan"
      backLabel="Plan"
      footer={<Button label="Done" kind="secondary" onPress={() => router.back()} />}
    >
      <Stack gap={5} className="pt-2">
        <PageHeader
          sticker={owing ? 'assignment' : item.isRecovery ? 'leaf' : item.moduleId ? 'class' : 'basket'}
          wash={color.area[item.bucket].wash}
          eyebrow={owing ? `Due ${formatShort(item.deadline ?? item.date)}` : formatShort(item.date)}
          title={item.title}
          sub={describeMix(item.mix, item.bucket)}
          wiggle={false}
        />

        {/* What it is, before what you can do to it. */}
        <Card gap={4}>
          <Stack direction="row" gap={2} wrap>
            <View className="flex-row items-center gap-2 rounded-pill px-3 py-2" style={{ backgroundColor: color.area[item.bucket].wash }}>
              <AreaIcon area={item.bucket} size={15} />
              <Text variant="micro">{BUCKET_LABEL[item.bucket]}</Text>
            </View>
            <Chip label={`${loadOf(item)} load`} readOnly />
            <Chip label={COMMITMENT_LABEL[item.commitment]} tone={item.commitment === 'hard' ? 'heavy' : 'plain'} readOnly />
            {item.room ? <Chip label={item.room} readOnly /> : null}
            {item.startHour !== undefined ? (
              <Chip label={`${formatHour(item.startHour)}–${formatHour(item.startHour + item.hours)}`} readOnly />
            ) : (
              <Chip label="No time yet" tone="busy" readOnly />
            )}
          </Stack>
          {item.flags?.length ? (
            <Stack direction="row" gap={2} wrap>
              {item.flags.map((flag) => <Chip key={flag} label={FLAG_LABEL[flag]} tone="heavy" readOnly />)}
            </Stack>
          ) : null}
          {locked ? (
            <Stack direction="row" gap={3} align="center" className="rounded-md bg-heavy-wash px-3 py-3">
              <Sticker name="wall" size={26} />
              <Text variant="micro" tone="heavy" className="flex-1">
                Locked. Nothing in this app will propose moving it.
              </Text>
            </Stack>
          ) : null}
        </Card>

        {/* Owing work: the bar, the sittings, and the planner. */}
        {owing ? (
          <Card tone={risk ? 'heavy' : 'plain'} gap={4}>
            <Stack direction="row" justify="between" align="center">
              <Text variant="heading">{remaining(item)}h still to do</Text>
              <Text variant="heading" tone={risk ? 'heavy' : 'busy'}>{100 - percentUndone(item)}%</Text>
            </Stack>
            <View className="h-4 w-full flex-row overflow-hidden rounded-pill bg-track">
              <View style={{ flexGrow: (item.prepDone ?? 0) || 0.0001, backgroundColor: color.band.steady.fill }} />
              <View style={{ flexGrow: scheduledHours(item, items) || 0.0001, backgroundColor: color.band.recovery.fill }} />
              <View style={{ flexGrow: unplanned(item, items) || 0.0001, backgroundColor: color.surface.track }} />
            </View>
            <Text variant="footnote" tone="muted">
              {item.prepDone ?? 0}h done · {scheduledHours(item, items)}h booked · {unplanned(item, items)}h loose
              {' · '}{daysLeft(item, today)} day{daysLeft(item, today) === 1 ? '' : 's'} left
            </Text>
            {risk ? (
              <Text variant="footnote" tone="heavy">Not enough free time left. Something has to move.</Text>
            ) : null}

            {plan.length ? (
              <Button
                label={`Book ${plan.length} sitting${plan.length === 1 ? '' : 's'} for me`}
                onPress={() => { scheduleSessions(item.id, plan, { replace: true }); successFeedback(); }}
              />
            ) : null}
            {plan.length && unplaced(item, plan) > 0 ? (
              <Text variant="micro" tone="heavy">{unplaced(item, plan)}h will not fit before the deadline.</Text>
            ) : null}

            {sittings.length ? (
              <Stack gap={3}>
                <Text variant="micro" tone="subtle">
                  YOUR SITTINGS · {sittings.filter((s) => s.sessionDone).length}/{sittings.length} DONE
                </Text>
                {sittings.map((session) => (
                  <Stack key={session.id} gap={3} className={`rounded-md px-3 py-3 ${session.sessionDone ? 'bg-steady-wash' : 'bg-sunken'}`}>
                    <Stack direction="row" gap={3} justify="between" align="center">
                      <Text variant="footnote" weight="semibold" tone={session.sessionDone ? 'steady' : 'recovery'}>
                        {formatShort(session.date)} · {formatHour(session.startHour ?? 0)}–{formatHour((session.startHour ?? 0) + session.hours)}
                      </Text>
                      <Text variant="micro" tone="subtle">{session.hours}h</Text>
                    </Stack>
                    {session.sessionDone ? (
                      <Text variant="micro" tone="steady">Done — {session.hours}h went onto the bar.</Text>
                    ) : (
                      <Stack direction="row" gap={2} wrap>
                        <Chip label={`Done · +${session.hours}h`} tone="steady" onPress={() => { completeSitting(session.id); successFeedback(); }} />
                        <Chip label="Give it back" onPress={() => unscheduleSession(session.id)} />
                      </Stack>
                    )}
                  </Stack>
                ))}
              </Stack>
            ) : null}

            <Stack gap={2}>
              <Text variant="micro" tone="subtle">DID SOME WITHOUT BOOKING IT?</Text>
              <Stack direction="row" gap={2} wrap>
                {UNBOOKED.filter((hours) => hours <= remaining(item)).map((hours) => (
                  <Chip
                    key={hours}
                    label={`+${hours < 1 ? `${hours * 60}m` : `${hours}h`}`}
                    onPress={() => { logUnbookedHours(item.id, hours); successFeedback(); }}
                  />
                ))}
                {sittings.some((s) => s.date === today && !s.sessionDone) ? (
                  <Chip label="Push today to tomorrow" onPress={() => { pushSittings(item.id, today, addDays(today, 1)); successFeedback(); }} />
                ) : null}
              </Stack>
            </Stack>
          </Card>
        ) : null}

        {/* Anything with a slot, or wanting one. */}
        {!owing && !locked && !item.repeats ? (
          <Card gap={4}>
            <Text variant="heading">{item.startHour === undefined ? 'Give it a time' : 'Move it'}</Text>
            {slots.length ? (
              <Stack direction="row" gap={2} wrap>
                {slots.map((hour) => (
                  <Chip
                    key={hour}
                    label={formatHour(hour)}
                    tone={hour === item.startHour ? 'selected' : 'plain'}
                    onPress={() => { scheduleItem(item.id, hour); successFeedback(); }}
                  />
                ))}
              </Stack>
            ) : (
              <Text variant="footnote" tone="muted">
                No gap on {formatShort(item.date)} is {item.hours}h long. Try another day.
              </Text>
            )}
            <Stack direction="row" gap={2} wrap>
              {item.startHour !== undefined ? (
                <Chip label="Take the time away" onPress={() => { scheduleItem(item.id, undefined); successFeedback(); }} />
              ) : null}
              {Array.from({ length: 3 }, (_, offset) => addDays(today, offset + 1)).map((date) => (
                <Chip key={date} label={`Move to ${formatShort(date)}`} onPress={() => { moveItem(item.id, date); successFeedback(); }} />
              ))}
            </Stack>
          </Card>
        ) : null}

        {/* How much you mind it — the one number only you can set. */}
        {!item.isRecovery && !item.isLog ? (
          <Card gap={4}>
            <Stack gap={2}>
              <Text variant="heading">How much are you dreading it?</Text>
              <Text variant="footnote" tone="muted">Changing this re-prices the whole week.</Text>
            </Stack>
            <DreadPicker value={item.dread} onChange={(next) => { setDread(item.id, next); tapFeedback(); }} />
          </Card>
        ) : null}

        {!locked && item.commitment !== 'hard' && !item.repeats && !item.moduleId ? (
          <Button label="Write a message to get out of it" kind="secondary" onPress={() => router.push(`/decline/${item.id}`)} />
        ) : null}

        <View className="h-2" />
      </Stack>
    </Screen>
  );
}
