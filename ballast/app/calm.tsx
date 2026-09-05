import { useRouter } from 'expo-router';
import { CalmMode } from '@/features/home/CalmMode';
import { threshold } from '@design/tokens';
import { addDays } from '@/lib/dates';
import { itemsOnDay, useStore } from '@/state/store';

/**
 * Calm mode as a standalone frame.
 *
 * Home switches into this on its own above 90%, which the seeded week 10 never
 * reaches - it sits at 87%. This route renders the same component at the 94% the
 * interface study documents, so the state is reviewable without having to make a
 * student's week worse to see it.
 */
const PREVIEW_PERCENT = 94;

export default function CalmPreview() {
  const router = useRouter();
  const { items, today, setMinimumViableWeek, setShowEverything } = useStore();
  const tuesday = addDays(today, 1);
  const focus = itemsOnDay(items, tuesday)[0] ?? items[0];

  return (
    <CalmMode
      back="/"
      percent={Math.max(PREVIEW_PERCENT, threshold.calmMode)}
      today={tuesday}
      focus={focus}
      onHide={() => {
        setMinimumViableWeek(true);
        router.replace('/');
      }}
      onShowEverything={() => {
        setShowEverything(true);
        router.replace('/');
      }}
    />
  );
}
