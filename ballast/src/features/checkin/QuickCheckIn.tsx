/**
 * The check-in's three heavy questions - how today feels, how you slept, how
 * you ate - on one card, each answer wearing its weight. The note for friends
 * and the good moments stay on the full check-in.
 */
import { useMemo } from 'react';
import { Stack } from '@/components';
import { TODAYS_MEAL, weightOf, type CheckInMove, type CheckInWorld } from '@/lib/checkin';
import { successFeedback } from '@/lib/haptics';
import { useStore } from '@/state/store';
import type { MoodQuadrant } from '@/lib/types';
import { ATE, MoodTiles, QUADRANTS, SLEEP, TileRow } from './Recharge';

export function QuickCheckIn() {
  const { items, ceilings, today, meals, moods, errands, moments, sleepHours, logMood, logSleep, setMealStatus } = useStore();
  const world: CheckInWorld = useMemo(
    () => ({ items, ceilings, today, meals, moods, errands, moments, sleepHours }),
    [items, ceilings, today, meals, moods, errands, moments, sleepHours],
  );
  const dinner = meals.find((meal) => meal.id === TODAYS_MEAL);
  const ate = dinner && dinner.status !== 'pending' ? dinner.status : null;
  const mood = moods.find((entry) => entry.date === today)?.quadrant ?? null;
  const gains = useMemo(() => {
    const of = (move: CheckInMove) => weightOf(world, move);
    return {
      mood: Object.fromEntries(QUADRANTS.map((q) => [q, of({ kind: 'mood', quadrant: q })])) as Record<MoodQuadrant, number>,
      sleep: Object.fromEntries(SLEEP.map((s) => [String(s.id), of({ kind: 'sleep', hours: s.id })])),
      ate: Object.fromEntries(ATE.map((a) => [a.id, of({ kind: 'meal', status: a.id })])),
    };
  }, [world]);

  return (
    <Stack gap={3}>
      <MoodTiles value={mood} gains={gains.mood} onPick={(quadrant) => { logMood(quadrant, []); successFeedback(); }} />
      <TileRow label="😴 Slept" options={SLEEP} value={sleepHours} gains={gains.sleep} onPick={(hours) => { logSleep(hours); successFeedback(); }} />
      <TileRow label="🍽️ Ate today" options={ATE} value={ate} gains={gains.ate} onPick={(status) => { setMealStatus(TODAYS_MEAL, status); successFeedback(); }} />
    </Stack>
  );
}
