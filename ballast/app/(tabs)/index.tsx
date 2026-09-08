import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import {
  AreaIcon, Button, Card, Chip, DayTimeline, MOOD_WORD, Mascot, Reveal, Screen, Spot, Stack, Text,
  TodoList, WeekStrip, moodFor,
} from '@/components';
import { CalmMode } from '@/features/home/CalmMode';
import { CHARGE_NOTE, chargeOf, drains } from '@/lib/battery';
import { color } from '@design/tokens';
import { BUCKETS, BUCKET_LABEL, bandFor, isCalm } from '@/lib/load';
import { itemsOnDay, liveCeiling, restOwedFrom, useStore } from '@/state/store';
import { useReading } from '@/state/selectors';
import { dayHours, freeSlots, slotHours, weekDays } from '@/lib/schedule';
import { findCollision, leadLabel } from '@/lib/forecast';
import { successFeedback } from '@/lib/haptics';
import { formatShort } from '@/lib/dates';
import { openPrep, remaining } from '@/lib/prep';
import { WEEK_NUMBER, prescriptions } from '@/data/seed';
import { useHydrated } from '@/hooks/useHydrated';

const TONE = { steady: 'steady', busy: 'busy', heavy: 'heavy' } as const;

const greeting = () => {
  const hour = new Date().getHours();
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
};

/**
 * Home — one battery, then the part of you that is empty.
 *
 * Rebuilt to lead with the picture. Everything that explains the app rather than
 * reporting your week now sits behind a tap, because it is worth reading once
 * and then never again.
 */
export default function Home() {
  const router = useRouter();
  const {
    items, today, onboarded, recovery, booked, dayReports, overallCeiling, minimumViableWeek,
    showEverythingAnyway, setShowEverything, setMinimumViableWeek,
    scheduleItem, scheduleSessions, pushSittings, setProgressPercent, unscheduleSession, setSessionNote,
  } = useStore();

  const { items: withLogs, percents, overall } = useReading();
  const charge = chargeOf(overall);
  const band = bandFor(overall);

  const hydrated = useHydrated();
  useEffect(() => {
    if (hydrated && !onboarded) router.replace('/welcome');
  }, [hydrated, onboarded, router]);

  const allToday = itemsOnDay(withLogs, today);
  const todayItems = minimumViableWeek
    ? [...allToday].sort((a, b) => (b.commitment === 'hard' ? 1 : 0) - (a.commitment === 'hard' ? 1 : 0)).slice(0, 2)
    : allToday;
  const hidden = allToday.length - todayItems.length;

  const days = weekDays(today);
  const collision = findCollision(withLogs, today);
  const cluster = new Set(collision ? days.filter((d) => d >= collision.from && d <= collision.to) : []);
  const hoursToday = dayHours(withLogs, today);
  const freeToday = Math.round(freeSlots(withLogs, today, 1).reduce((t, s) => t + slotHours(s), 0) * 10) / 10;

  const pulling = drains(percents).slice(0, 2);
  const unbooked = prescriptions.filter((entry) => !booked.includes(entry.id));
  const suggestion = unbooked.find((entry) => entry.best) ?? unbooked[0];
  const restOwed = restOwedFrom(recovery);
  const ceiling = liveCeiling(overallCeiling, dayReports);

  if (isCalm(overall) && !showEverythingAnyway) {
    return (
      <CalmMode
        percent={overall}
        today={today}
        focus={todayItems[0] ?? items[0]}
        onHide={() => setMinimumViableWeek(true)}
        onShowEverything={() => setShowEverything(true)}
      />
    );
  }

  return (
    <Screen footer={<Button label="Add anything" onPress={() => router.push('/add')} />}>
      <Stack gap={6} className="pt-4">
        <Text variant="micro" tone="subtle">{greeting().toUpperCase()} · WEEK {WEEK_NUMBER}</Text>

        {/* The character. You can read how the week is going before you read
            anything at all, which is the point. */}
        <Card tone={band} gap={4} align="center">
          <Mascot charge={charge} loadPercent={overall} size={128} />
          <Stack gap={1} align="center">
            <Text
              variant="hero"
              tone={TONE[band]}
              // The drawing is decorative; this line is what a screen reader gets,
              // and it still carries the shape the picture is made of.
              accessibilityLabel={`${charge} percent left. ${MOOD_WORD[moodFor(charge)]}. Made of ${BUCKETS.map((b) => `${BUCKET_LABEL[b]} ${chargeOf(percents[b])}%`).join(', ')}.`}
            >
              {charge}%
            </Text>
            <Text variant="heading">{MOOD_WORD[moodFor(charge)]}</Text>
          </Stack>
          <Reveal label="What this number is">
            <Text variant="footnote" tone="muted">{CHARGE_NOTE[band]}</Text>
            <Text variant="footnote" tone="muted">
              Your five areas blended, with the emptiest counting for half. Your line sits at {ceiling}%.
            </Text>
          </Reveal>
        </Card>

        {/* Five areas, each with its own colour and shape. */}
        <Stack direction="row" gap={2}>
          {BUCKETS.map((bucket) => {
            const left = chargeOf(percents[bucket]);
            const areaBand = bandFor(percents[bucket]);
            return (
              <Pressable
                key={bucket}
                accessibilityRole="button"
                accessibilityLabel={`${BUCKET_LABEL[bucket]}, ${left}% left`}
                onPress={() => router.push(`/areas/${bucket}`)}
                className="min-h-min flex-1 items-center gap-2 rounded-lg py-4 active:opacity-70"
                style={{ backgroundColor: color.area[bucket].wash }}
              >
                <AreaIcon area={bucket} size={24} />
                <Text variant="callout" weight="bold" tone={TONE[areaBand]}>{left}</Text>
                <Text variant="micro" tone="subtle">{BUCKET_LABEL[bucket].slice(0, 4)}</Text>
              </Pressable>
            );
          })}
        </Stack>

        {/* The week, and the wall in it. */}
        <Card gap={4}>
          <WeekStrip
            items={withLogs}
            days={days}
            today={today}
            cluster={cluster}
            onSelect={(date) => router.push(`/plan?day=${date}`)}
          />
          {collision ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${collision.headline} ${leadLabel(collision.leadDays)}`}
              onPress={() => router.push('/plan')}
              className="flex-row items-center gap-3 rounded-sm bg-heavy-wash px-4 py-3 active:opacity-70"
            >
              <Spot name="wall" size={28} />
              <Text variant="footnote" tone="heavy" className="flex-1">{collision.headline}</Text>
              <Text variant="micro" tone="heavy">{leadLabel(collision.leadDays)}</Text>
            </Pressable>
          ) : null}
        </Card>

        {pulling.length ? (
          <Stack direction="row" gap={2}>
            {pulling.map((row) => (
              <Chip
                key={row.bucket}
                label={`${BUCKET_LABEL[row.bucket]} ${row.cost}%`}
                tone={bandFor(row.cost) === 'heavy' ? 'heavy' : 'busy'}
                onPress={() => router.push(`/areas/${row.bucket}`)}
              />
            ))}
            <Chip label={`${restOwed}h rest owed`} tone="recovery" onPress={() => router.push('/recover')} />
          </Stack>
        ) : null}

        {/* Today. */}
        <Stack gap={3}>
          <Stack direction="row" justify="between" align="center">
            <Text variant="micro" tone="subtle">TODAY · {formatShort(today).toUpperCase()}</Text>
            <Stack direction="row" gap={2}>
              <Chip label={`${hoursToday.committed}h`} readOnly />
              <Chip label={`${freeToday}h free`} tone={freeToday > 3 ? 'steady' : 'busy'} readOnly />
            </Stack>
          </Stack>
          <Card gap={4}>
            <DayTimeline
              items={minimumViableWeek ? todayItems : withLogs}
              date={today}
              onSelect={(item) => router.push(`/decline/${item.id}`)}
              onSchedule={(item, startHour) => { scheduleItem(item.id, startHour); successFeedback(); }}
              onAddAt={(date, startHour) => router.push(`/add?date=${date}&start=${startHour}`)}
              todo={
                <TodoList
                  todo={openPrep(withLogs, today)}
                  items={withLogs}
                  today={today}
                  date={today}
                  onSchedule={(item, startHour, hours, note) => {
                    scheduleSessions(item.id, [{ date: today, startHour, hours, note }]);
                    successFeedback();
                  }}
                  onPlan={(item, sessions) => { scheduleSessions(item.id, sessions, { replace: true }); successFeedback(); }}
                  onDefer={(item, to) => { pushSittings(item.id, today, to); successFeedback(); }}
                  onSetPercent={(item, percent) => { setProgressPercent(item.id, percent); successFeedback(); }}
                  onUnschedule={(sessionId) => { unscheduleSession(sessionId); successFeedback(); }}
                  onNote={(sessionId, note) => setSessionNote(sessionId, note)}
                />
              }
            />
          </Card>
        </Stack>

        {hidden > 0 ? (
          <Card tone="sunken" gap={3}>
            <Text variant="callout" weight="semibold">{hidden} hidden until Sunday.</Text>
            <Button label="Show everything" kind="secondary" onPress={() => setMinimumViableWeek(false)} />
          </Card>
        ) : null}

        {/* One thing that would help. */}
        {suggestion ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${suggestion.title}. ${suggestion.detail}`}
            onPress={() => router.push('/prescription')}
            className="active:opacity-70"
          >
            <Card tone="recovery" gap={4}>
              <Stack direction="row" gap={4} align="center">
                <Spot name="clear" size={52} />
                <Stack gap={1} grow>
                  <Text variant="micro" tone="recovery">WOULD HELP</Text>
                  <Text variant="heading">{suggestion.title}</Text>
                  <Text variant="micro" tone="muted">{suggestion.slot}</Text>
                </Stack>
              </Stack>
            </Card>
          </Pressable>
        ) : (
          <Card tone="steady" gap={3}>
            <Stack direction="row" gap={4} align="center">
              <Spot name="done" size={44} />
              <Text variant="callout" className="flex-1">All four recovery blocks are in your week.</Text>
            </Stack>
          </Card>
        )}

        <View className="h-2" />
      </Stack>
    </Screen>
  );
}
