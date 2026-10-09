import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import {
  Button, Card, MOOD_WORD, Mascot, PageHeader, Screen, Stack, Sticker, Text, moodFor,
  type StickerName,
} from '@/components';
import { MarkNotice } from '@/features/marking/MarkNotice';
import { MarkSheet } from '@/features/marking/MarkSheet';
import { KIND, autoMarkedIn, clockHour, markKind, toMark } from '@/lib/marking';
import { breakdown } from '@/lib/breakdown';
import { useBells } from '@/features/notify/useBells';
import { CalendarNudge } from '@/features/calendar/CalendarNudge';
import { BatterySplit } from '@/features/battery/BatterySplit';
import { addDays } from '@/lib/dates';
import { formatHour } from '@/lib/schedule';
import { CalmMode } from '@/features/home/CalmMode';
import { EveningReview } from '@/features/home/EveningReview';
import { CHARGE_NOTE, chargeOf } from '@/lib/battery';
import { color } from '@design/tokens';
import { FAMILY, type Family } from '@design/families';
import { bandFor, isCalm } from '@/lib/load';
import { liveCeiling, restOwedFrom, useStore } from '@/state/store';
import { useReading } from '@/state/selectors';
import { prioritise } from '@/lib/priority';
import { adherence, dueForReview, weightsFrom } from '@/lib/review';
import { updatedToday } from '@/lib/circle';
import { findCollision, leadLabel } from '@/lib/forecast';
import { itemsOnDay } from '@/state/store';
import { tapFeedback } from '@/lib/haptics';
import { WEEK_NUMBER } from '@/data/seed';
import { useHydrated } from '@/hooks/useHydrated';

const TONE = { steady: 'steady', busy: 'busy', heavy: 'heavy' } as const;

/** By the same clock the day's blocks are marked against, so the two never disagree. */
const greeting = (hour: number) => (hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening');
const timeSticker = (hour: number): StickerName => (hour < 18 ? 'sun' : 'moon');

/**
 * Home — a summary of everything, and the one place to update.
 *
 * It used to carry the battery, five area tiles, the week strip, the collision
 * warning, the drains, the whole of today hour by hour, the owing list and a
 * recovery suggestion. All of it was true and all of it was on one screen, which
 * made Home and Plan look like the same screen doing the same job.
 *
 * Plan owns the schedule now. Home answers two questions — how am I, and what do
 * I do next — and then gets out of the way. Everything else is a door.
 */
export default function Home() {
  const router = useRouter();
  const { items, today, onboarded, recovery, overallCeiling, minimumViableWeek,
    showEverythingAnyway, setShowEverything, setMinimumViableWeek, dayReports, circle,
    reportDay, markItem, ceilings, moods, sleepHours, requests, groupInvites, received } = useStore();
  const [marking, setMarking] = useState<string | null>(null);
  const { items: withLogs, percents, overall, week } = useReading();
  const { update, unseen: bellCount } = useBells();
  const charge = chargeOf(overall);
  const band = bandFor(overall);


  const todayItems = itemsOnDay(withLogs, today);
  /**
   * The ranking, tuned by whatever the student has said in the evenings.
   *
   * Untouched this is identical to the untuned model - every weight starts at 1
   * - so the learning is invisible until it has been taught something.
   */
  const weights = weightsFrom(dayReports);
  const { first } = prioritise(withLogs, today, 7, weights);
  const kept = adherence(withLogs, today);
  const askTonight = dueForReview(dayReports, today, new Date().getHours(), kept.rate);
  const next = first[0];
  const collision = findCollision(withLogs, today);
  const active = updatedToday(circle);
  const owed = restOwedFrom(recovery);
  const ceiling = liveCeiling(overallCeiling, dayReports);
  // Over, and nobody has said how it went - and what the app marked for you.
  const hour = clockHour(today);
  const due = toMark(items, today, hour);
  const split = breakdown(week, ceilings, today, hour);
  const auto = autoMarkedIn(items);

  if (isCalm(overall) && !showEverythingAnyway && !minimumViableWeek) {
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

  // A glance at each of the other three pages - the number that matters there,
  // one tap to the page itself. Their buttons live on their own pages, once.
  const checkedIn = moods.some((mood) => mood.date === today) || sleepHours !== null;
  const leftToday = todayItems.filter((item) => !item.isLog && !item.isRecovery && !item.outcome
    && (item.startHour === undefined || item.startHour + item.hours > hour));
  const nextTimed = leftToday.filter((item) => item.startHour !== undefined).sort((a, b) => a.startHour! - b.startHour!)[0];
  const askingYou = requests.filter((r) => r.direction === 'incoming').length + groupInvites.length + received.filter((r) => !r.answer).length;
  const glance: Array<{ family: Family; sticker: StickerName; value: string; label: string; sub: string; to: Href; alert?: boolean }> = [
    {
      family: 'week', sticker: 'calendar', value: String(leftToday.length), label: 'left today',
      sub: nextTimed ? `Next ${formatHour(nextTimed.startHour!)}` : 'Nothing timed', to: '/plan',
    },
    askingYou
      ? { family: 'people', sticker: 'people', value: String(askingYou), label: 'asking you', sub: 'Friends', to: '/friends', alert: true }
      : { family: 'people', sticker: 'people', value: String(active), label: 'checked in', sub: 'Friends', to: '/friends' },
    {
      family: 'rest', sticker: 'leaf', value: `${owed}h`, label: 'rest owed',
      sub: checkedIn ? '✓ Checked in' : 'Not checked in', to: '/you', alert: !checkedIn,
    },
  ];

  return (
    <Screen
      footer={<Button label="Add anything" onPress={() => router.push('/add')} />}
      overlay={<MarkNotice due={due} onOpen={(item) => setMarking(item.id)} />}
    >
      <Stack gap={5} className="pt-2">
        <Stack direction="row" align="center" gap={3}>
          <View className="flex-1">
            <PageHeader
              sticker={timeSticker(hour)}
              wash={color.decor.lemon}
              eyebrow={`Week ${WEEK_NUMBER}`}
              title={greeting(hour)}
            />
          </View>
          {/* The bell: everything worth telling you, with how much is new. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={bellCount ? `Notifications, ${bellCount} new` : 'Notifications'}
            onPress={() => { tapFeedback(); router.push('/notifications' as Href); }}
            className="items-center justify-center rounded-pill bg-sunken active:opacity-70"
            style={{ width: 48, height: 48 }}
          >
            <Text variant="title">🔔</Text>
            {bellCount ? <Count value={bellCount} /> : null}
          </Pressable>
        </Stack>

        {/* How you are, and where it went: one bar, three numbers, one tap for the rest. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${charge} percent of your week left. ${MOOD_WORD[moodFor(charge)]}. ${split.spent} percent used, ${split.ahead} percent still to come. Open your battery.`}
          onPress={() => router.push('/battery' as Href)}
          className="active:opacity-80"
        >
          <Card tone={band} gap={4} align="center">
            <Mascot charge={charge} loadPercent={overall} size={124} />
            <Stack gap={1} align="center">
              <Text variant="hero" tone={TONE[band]}>{charge}%</Text>
              <Text variant="heading">{MOOD_WORD[moodFor(charge)]}</Text>
            </Stack>
            <BatterySplit spent={split.spent} ahead={split.ahead} left={split.left} back={split.back} />
            <Text variant="caption" weight="bold" className="underline">Where it goes ›</Text>
          </Card>
        </Pressable>

        {/* New on Google Calendar: drops in under the battery until it is set up. */}
        <CalendarNudge />

        {/* Everything waiting on an answer from you, in one place. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={update.count ? `Quick update, ${update.count} to update` : 'Quick update, all caught up'}
          onPress={() => { tapFeedback(); router.push('/update' as Href); }}
          className="flex-row items-center gap-3 rounded-xl border-2 px-4 py-3 active:opacity-70"
          style={{ borderColor: update.count ? color.band.busy.fill : color.line.hairline, backgroundColor: update.count ? color.band.busy.wash : color.surface.raised }}
        >
          <View className="items-center justify-center rounded-pill" style={{ width: 44, height: 44, backgroundColor: FAMILY.week.wash }}>
            <Sticker name="clock" size={28} wiggle={!!update.count} />
            {update.count ? <Count value={update.count} /> : null}
          </View>
          <Stack gap={0} grow>
            <Text variant="body" weight="semibold">Quick update</Text>
            <Text variant="micro" tone="subtle">
              {update.count
                ? [update.toMark.length ? `${update.toMark.length} to mark` : '', update.auto.length ? `${update.auto.length} to confirm` : '', update.checkIn ? 'check in' : ''].filter(Boolean).join(' · ')
                : '✓ All caught up'}
            </Text>
          </Stack>
          <Text variant="heading" tone="subtle">›</Text>
        </Pressable>

        {/* One next thing. Not a list — Plan is the list. */}
        {next ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Do this next: ${next.item.title}. ${next.reasons.join('. ')}`}
            onPress={() => router.push('/priority')}
            className="active:opacity-70"
          >
            {/* In the "what to do" colour, so it reads as the same thing as the
                page it opens. */}
            <View className="overflow-hidden rounded-xl border-2 border-inverse" style={{ backgroundColor: FAMILY.focus.wash }}>
              <Stack direction="row" gap={4} align="center" className="px-4 py-4">
                <View className="items-center justify-center rounded-pill bg-raised" style={{ width: 52, height: 52 }}>
                  <Sticker name="star" size={36} wiggle />
                </View>
                <Stack gap={1} grow>
                  <Text variant="micro">DO THIS NEXT</Text>
                  <Text variant="heading">{next.item.title}</Text>
                  <Text variant="micro" tone="muted">{next.reasons.slice(0, 2).join(' · ')}</Text>
                </Stack>
                <Text variant="heading" tone="muted">›</Text>
              </Stack>
            </View>
          </Pressable>
        ) : null}

        {/* Over, and not marked yet: one tap each, or open one to say more. */}
        {/* Once a day at most, late, and only when it has earned the interruption. */}
        {askTonight ? (
          <EveningReview
            onAnswer={(verdict) =>
              reportDay(verdict === 'good' ? 'fine' : verdict === 'too-much' ? 'hard' : 'meh', overall, verdict)
            }
          />
        ) : null}

        {/* The one warning worth interrupting for. */}
        {collision ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${collision.headline} ${leadLabel(collision.leadDays)}`}
            onPress={() => router.push('/rebalance')}
            className="active:opacity-70"
          >
            <Card tone="heavy" gap={3}>
              <Stack direction="row" gap={4} align="center">
                <Sticker name="wall" size={38} />
                <Text variant="callout" weight="semibold" tone="heavy" className="flex-1">
                  {collision.headline}
                </Text>
                <Stack gap={0} align="end">
                  <Text variant="micro" tone="heavy">{leadLabel(collision.leadDays)}</Text>
                  <Text variant="caption" weight="bold" tone="heavy">Lighten ›</Text>
                </Stack>
              </Stack>
            </Card>
          </Pressable>
        ) : null}

        {/* At a glance: the other three pages, one number each. */}
        <Stack direction="row" gap={3}>
          {glance.map((tile) => (
            <Pressable
              key={tile.label}
              accessibilityRole="button"
              accessibilityLabel={`${tile.value} ${tile.label}. ${tile.sub}`}
              onPress={() => { tapFeedback(); router.navigate(tile.to); }}
              className="flex-1 items-center gap-1 overflow-hidden rounded-lg border-2 bg-raised px-2 py-3 active:opacity-70"
              style={{ borderColor: tile.alert ? color.band.busy.fill : color.line.hairline }}
            >
              <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: FAMILY[tile.family].wash, opacity: 0.3 }]} />
              <Sticker name={tile.sticker} size={30} />
              <Text variant="title" weight="bold">{tile.value}</Text>
              <Text variant="micro" weight="bold">{tile.label}</Text>
              <Text variant="micro" tone="subtle" numberOfLines={1}>{tile.sub}</Text>
            </Pressable>
          ))}
        </Stack>

        {minimumViableWeek ? (
          <Card tone="recovery" gap={4}>
            <Stack direction="row" gap={4} align="center">
              <Sticker name="leaf" size={40} />
              <Text variant="footnote" tone="muted" className="flex-1">Cut down to what matters.</Text>
            </Stack>
            <Button label="Show everything again" kind="secondary" onPress={() => setMinimumViableWeek(false)} />
          </Card>
        ) : null}

        <View className="h-2" />
      </Stack>
      <MarkSheet itemId={marking} onClose={() => setMarking(null)} />
    </Screen>
  );
}

/** A red number on a corner: how many things are waiting. */
function Count({ value }: { value: number }) {
  return (
    <View
      className="absolute items-center justify-center rounded-pill"
      style={{ top: -4, right: -6, minWidth: 22, height: 22, paddingHorizontal: 5, backgroundColor: color.band.heavy.fill, borderWidth: 2, borderColor: color.surface.page }}
    >
      <Text variant="micro" tone="inverse">{value > 9 ? '9+' : value}</Text>
    </View>
  );
}
