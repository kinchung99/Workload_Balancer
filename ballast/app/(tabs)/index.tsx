import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import {
  Button, Card, Door, MOOD_WORD, Mascot, PageHeader, Screen, Section, Stack, Sticker, Text, moodFor,
  type StickerName,
} from '@/components';
import { MarkNotice } from '@/features/marking/MarkNotice';
import { MarkSheet } from '@/features/marking/MarkSheet';
import { KIND, autoMarkedIn, clockHour, markKind, toMark } from '@/lib/marking';
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
 * Home — one reading, one next thing, and four doors.
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
    reportDay, markItem } = useStore();
  const [marking, setMarking] = useState<string | null>(null);
  const { items: withLogs, percents, overall } = useReading();
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

  // One door per family, each in its family's colour and drawing - the same
  // colour the page behind it is built from.
  const doors: Array<{ family: Family; title: string; sub: string; to: Href }> = [
    { family: 'week', title: 'My week', sub: `${todayItems.length} today`, to: '/plan' },
    { family: 'people', title: 'Friends', sub: `${active} checked in`, to: '/friends' },
    { family: 'focus', title: 'What first', sub: `${first.length} ranked`, to: '/priority' },
    { family: 'rest', title: 'Recovery', sub: `${owed}h owed`, to: '/recover' },
  ];

  return (
    <Screen
      footer={<Button label="Add anything" onPress={() => router.push('/add')} />}
      overlay={<MarkNotice due={due} onOpen={(item) => setMarking(item.id)} />}
    >
      <Stack gap={5} className="pt-2">
        <PageHeader
          sticker={timeSticker(hour)}
          wash={color.decor.lemon}
          eyebrow={`Week ${WEEK_NUMBER}`}
          title={greeting(hour)}
        />

        {/* How you are. Nothing else on the card. */}
        <Card tone={band} gap={4} align="center">
          <Mascot charge={charge} loadPercent={overall} size={124} />
          <Stack gap={1} align="center">
            <Text variant="hero" tone={TONE[band]} accessibilityLabel={`${charge} percent of your week left. ${MOOD_WORD[moodFor(charge)]}.`}>
              {charge}%
            </Text>
            <Text variant="heading">{MOOD_WORD[moodFor(charge)]}</Text>
          </Stack>
        </Card>

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
        {due.length ? (
          <Section family="week" title="To mark" sticker="clock" meta={`${due.length}`}>
            {due.map((item) => {
              const info = KIND[markKind(item)];
              return (
                <Stack key={item.id} direction="row" gap={2} align="center" className="rounded-lg bg-raised py-2 pl-3 pr-2">
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${item.title}. ${info.question}`}
                    onPress={() => { tapFeedback(); setMarking(item.id); }}
                    className="min-h-min flex-1 flex-row items-center gap-3 active:opacity-70"
                  >
                    <Text variant="heading">{info.emoji}</Text>
                    <Stack gap={1} grow>
                      <Text variant="body" weight="semibold" numberOfLines={1}>{item.title}</Text>
                      <Text variant="micro" tone="busy">
                        ⏳ {formatHour(item.startHour ?? 0)}–{formatHour((item.startHour ?? 0) + item.hours)}
                      </Text>
                    </Stack>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${info.yes}: ${item.title}`}
                    onPress={() => { markItem(item.id, 'done'); tapFeedback(); }}
                    className="items-center justify-center rounded-pill bg-steady-fill active:opacity-70"
                    style={{ width: 40, height: 40 }}
                  >
                    <Text variant="callout" weight="bold" tone="inverse">✓</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${info.answer === 'errand' ? 'Move to tomorrow' : info.no}: ${item.title}`}
                    onPress={() => {
                      if (info.answer === 'errand') useStore.getState().moveItem(item.id, addDays(today, 1));
                      else markItem(item.id, 'missed');
                      tapFeedback();
                    }}
                    className="items-center justify-center rounded-pill border-2 border-line-hairline bg-sunken active:opacity-70"
                    style={{ width: 40, height: 40 }}
                  >
                    <Text variant="callout" weight="bold" tone="muted">{info.answer === 'errand' ? '↪' : '✕'}</Text>
                  </Pressable>
                </Stack>
              );
            })}
          </Section>
        ) : null}

        {/* What the app marked by itself the morning after - one door to check it. */}
        {auto.length ? (
          <Door
            family="week"
            sticker="star"
            title={`${auto.length} marked for you`}
            sub={auto.every((item) => item.date === addDays(today, -1)) ? 'From yesterday · keep or change' : 'Keep or change'}
            onPress={() => router.push('/marked' as Href)}
          />
        ) : null}

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
            onPress={() => router.push('/plan')}
            className="active:opacity-70"
          >
            <Card tone="heavy" gap={3}>
              <Stack direction="row" gap={4} align="center">
                <Sticker name="wall" size={38} />
                <Text variant="callout" weight="semibold" tone="heavy" className="flex-1">
                  {collision.headline}
                </Text>
                <Text variant="micro" tone="heavy">{leadLabel(collision.leadDays)}</Text>
              </Stack>
            </Card>
          </Pressable>
        ) : null}

        {/* Four doors. Everything else in the app is behind one of them. */}
        <Stack direction="row" gap={3} wrap>
          {doors.map((door) => (
            <Pressable
              key={door.title}
              accessibilityRole="button"
              accessibilityLabel={`${door.title}. ${door.sub}`}
              onPress={() => { tapFeedback(); router.push(door.to); }}
              className="min-h-row grow items-center gap-2 overflow-hidden rounded-lg border-2 border-line-hairline bg-raised p-4 active:opacity-70"
              style={{ flexBasis: '44%' }}
            >
              <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: FAMILY[door.family].wash, opacity: 0.3 }]} />
              <View className="items-center justify-center rounded-pill" style={{ width: 52, height: 52, backgroundColor: FAMILY[door.family].wash }}>
                <Sticker name={FAMILY[door.family].sticker} size={32} />
              </View>
              <Stack gap={1} align="center">
                <Text variant="body" weight="semibold">{door.title}</Text>
                <Text variant="micro" tone="subtle">{door.sub}</Text>
              </Stack>
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
