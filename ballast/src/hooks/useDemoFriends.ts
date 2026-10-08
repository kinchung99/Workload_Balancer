/**
 * The sample week's friends, answering.
 *
 * Nobody in the sample week is a real person, so nobody could ever say yes to
 * a friend request or a group invitation. A few seconds after being asked they
 * answer by themselves - the store decides who, this only keeps time. Signed
 * in, the store ignores it: real people answer on their own phones.
 */
import { useEffect } from 'react';
import { useStore } from '@/state/store';

export function useDemoFriends(): void {
  useEffect(() => {
    const tick = () => useStore.getState().demoTick(Date.now());
    tick();
    const every = setInterval(tick, 3000);
    return () => clearInterval(every);
  }, []);
}
