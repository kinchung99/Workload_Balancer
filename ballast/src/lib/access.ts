/**
 * Who may use the app without an account.
 *
 * Nobody, in a real build: everything sits behind sign-in, so a week, a circle
 * and a battery always belong to somebody. A preview build (built with
 * `EXPO_PUBLIC_GUEST=1`) also offers the sample week as a guest, so the
 * prototype can be looked around without making an account - and a build with
 * no server at all has nothing to sign in to, so it is guest-only.
 */
import { hasServer } from './api';

export const guestAllowed = (): boolean => process.env.EXPO_PUBLIC_GUEST === '1' || !hasServer();
