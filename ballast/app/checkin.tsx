import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, PageHeader, Screen, Section, Stack } from '@/components';
import { color } from '@design/tokens';
import { TODAYS_MEAL, chargeExact, gainOf, signedLabel, weightOf, type CheckInMove, type CheckInWorld } from '@/lib/checkin';
import { MOMENT_KINDS } from '@/lib/moments';
import { successFeedback } from '@/lib/haptics';
import { useStore } from '@/state/store';
import { useReading } from '@/state/selectors';
import { NoteCard } from '@/features/checkin/NoteCard';
import { ATE, BatteryCard, GainToast, MomentGrid, MoodTiles, QUADRANTS, SLEEP, TileRow } from '@/features/checkin/Recharge';
import type { MoodQuadrant } from '@/lib/types';


/**
 * Check in - your note for friends, then everything that recharges you.
 *
 * The note is first because it is the part other people see. Below it, every
 * answer wears its weight before you tap it - plus or minus - the battery card
 * keeps the score, and each tap pops what it just did.
 */
export default function CheckIn() {
  const router = useRouter();
  const { items, ceilings, today, meals, moods, errands, moments, sleepHours, logMood, logSleep, setMealStatus, logMoment } = useStore();
  const reading = useReading();
  const [mood, setMood] = useState<MoodQuadrant | null>(null);
  // Where the battery stood before this visit's first answer.
  const [start, setStart] = useState<number | null>(null);
  const [toast, setToast] = useState<{ text: string; stamp: number; down: boolean } | null>(null);

  const world: CheckInWorld = useMemo(
    () => ({ items, ceilings, today, meals, moods, errands, moments, sleepHours }),
    [items, ceilings, today, meals, moods, errands, moments, sleepHours],
  );
  const now = useMemo(() => chargeExact(world), [world]);
  const dinner = meals.find((meal) => meal.id === TODAYS_MEAL);
  const ate = dinner && dinner.status !== 'pending' ? dinner.status : null;
  const moodToday = mood ?? moods.find((entry) => entry.date === today)?.quadrant ?? null;

  const gains = useMemo(() => {
    // Each answer's own weight, the same before and after it is picked.
    const of = (move: CheckInMove) => weightOf(world, move);
    const counts: Record<string, number> = {};
    for (const m of moments) if (m.date === today) counts[m.kind] = (counts[m.kind] ?? 0) + 1;
    return {
      counts,
      mood: Object.fromEntries(QUADRANTS.map((q) => [q, of({ kind: 'mood', quadrant: q })])) as Record<MoodQuadrant, number>,
      sleep: Object.fromEntries(SLEEP.map((s) => [String(s.id), of({ kind: 'sleep', hours: s.id })])),
      ate: Object.fromEntries(ATE.map((a) => [a.id, of({ kind: 'meal', status: a.id })])),
      // Each repeat of a kind is worth less; the sum already knows that.
      moment: Object.fromEntries(MOMENT_KINDS.map((k) => [k.id, of({ kind: 'moment', id: k.id, bucket: k.bucket, credit: k.credit })])),
    };
  }, [world, moments, today]);

  // What is still there to collect: the best unanswered answer of each kind.
  const best = (values: Record<string, number>) => Math.max(0, ...Object.values(values));
  const left = (moodToday ? 0 : best(gains.mood)) + (sleepHours === null ? best(gains.sleep) : 0)
    + (ate ? 0 : best(gains.ate)) + (Object.keys(gains.counts).length ? 0 : best(gains.moment));

  /** Answer, then pop what it added. */
  const answer = (move: CheckInMove, apply: () => void) => {
    const gain = gainOf(world, move);
    if (start === null) setStart(now);
    apply();
    successFeedback();
    const rounded = Math.round(gain);
    setToast({
      text: rounded > 0 ? `⚡ ${signedLabel(gain)} battery` : rounded < 0 ? `🪫 ${signedLabel(gain)} battery` : '✓ Logged',
      stamp: Date.now(),
      down: rounded < 0,
    });
  };

  return (
    <Screen
      back="/you"
      backLabel="You"
      footer={
        <View>
          <GainToast text={toast?.text ?? null} stamp={toast?.stamp ?? 0} down={toast?.down} />
          <Button label={`Done · 🔋 ${reading.charge}%`} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        </View>
      }
    >
      <Stack gap={5} className="pt-2">
        <PageHeader sticker="sun" wash={color.decor.lemon} title="How are you?" />

        <NoteCard />

        <BatteryCard charge={reading.charge} overall={reading.overall} added={start === null ? 0 : now - start} left={left} />

        <Section family="you" title="Today feels" sticker="cloud">
          <MoodTiles
            value={moodToday}
            gains={gains.mood}
            onPick={(quadrant) => answer({ kind: 'mood', quadrant }, () => { setMood(quadrant); logMood(quadrant, []); })}
          />
        </Section>

        <Section family="you" title="Sleep and food" sticker="moon">
          <TileRow
            label="😴 Slept"
            options={SLEEP}
            value={sleepHours}
            gains={gains.sleep}
            onPick={(hours) => answer({ kind: 'sleep', hours }, () => logSleep(hours))}
          />
          <TileRow
            label="🍽️ Ate today"
            options={ATE}
            value={ate}
            gains={gains.ate}
            onPick={(status) => answer({ kind: 'meal', status }, () => setMealStatus(TODAYS_MEAL, status))}
          />
        </Section>

        <Section family="rest" title="Something good happened?" sticker="sparkle">
          <MomentGrid
            kinds={MOMENT_KINDS}
            counts={gains.counts}
            gains={gains.moment}
            onTap={(id) => {
              const kind = MOMENT_KINDS.find((k) => k.id === id);
              if (!kind) return;
              answer({ kind: 'moment', id, bucket: kind.bucket, credit: kind.credit }, () => logMoment(kind.id, kind.bucket, kind.credit));
            }}
          />
        </Section>

        <View className="h-2" />
      </Stack>
    </Screen>
  );
}
