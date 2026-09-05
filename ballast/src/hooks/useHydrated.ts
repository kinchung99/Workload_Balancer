/**
 * True once the persisted store has been read back off the device.
 *
 * Needed because persistence is async on native, and because every route is
 * prerendered in Node where there is no storage at all. Anything that depends on
 * saved state - the first-run redirect especially - has to wait for this, or the
 * static HTML would be built from a state the user never had.
 */
import { useEffect, useState } from 'react';
import { useStore } from '@/state/store';

export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() => useStore.persist.hasHydrated());

  useEffect(() => {
    const done = useStore.persist.onFinishHydration(() => setHydrated(true));
    if (useStore.persist.hasHydrated()) setHydrated(true);
    return done;
  }, []);

  return hydrated;
}
