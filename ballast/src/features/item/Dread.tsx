import { useMemo, useRef } from 'react';
import { Disclosure, DrainBadge, DrainPicker } from '@/components';
import { DRAIN, costLabel, drainCosts } from '@/lib/drain';
import { tapFeedback } from '@/lib/haptics';
import { useStore } from '@/state/store';
import type { Dread, Item } from '@/lib/types';

/**
 * How draining this one is - and what that costs.
 *
 * Folded, it is one row: the face, the word, and what it costs the week
 * ("Tiring · −4% of that week's battery"), which is the part worth reading on
 * the way past. Open, it is the same picker the whole app uses, with the price
 * of every answer under its face and the one it started at marked "was".
 */
export function DrainDisclosure({ item, items }: { item: Item; items: Item[] }) {
  const { setDread, ceilings } = useStore();
  // What it was when you arrived, so a change reads as a change.
  const opened = useRef(item.dread).current;

  const anchor = item.deadline ?? item.date;
  const costs = useMemo(() => {
    // The week without this task and the sittings still ahead of it - the parts
    // whose price this answer sets.
    const mine = (i: Item) => i.id === item.id || (i.parentId === item.id && !i.sessionDone);
    const base = items.filter((i) => !mine(i));
    const own = items.filter(mine);
    return drainCosts(base, (level) => own.map((i) => ({ ...i, dread: level })), anchor, ceilings);
  }, [items, item.id, anchor, ceilings]);

  return (
    <Disclosure
      lead={<DrainBadge value={item.dread} />}
      title="How draining is it?"
      summary={`${DRAIN[item.dread].word} · ${costLabel(costs[item.dread])} of that week’s battery`}
    >
      <DrainPicker
        question="Pick the face that fits"
        value={item.dread}
        onChange={(next: Dread) => { setDread(item.id, next); tapFeedback(); }}
        costs={costs}
        hours={item.hours}
        was={opened}
        costOf="of that week’s battery"
      />
    </Disclosure>
  );
}
