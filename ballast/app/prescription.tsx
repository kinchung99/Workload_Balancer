/**
 * `/prescription` — matched recovery, page one.
 *
 * Flat route, with `prescription/[step].tsx` beside it as a second way in. Same
 * shape as capture and for the same two reasons: static hosting only serves a
 * directory index at a trailing slash, and the pages need to be separately
 * renderable for `render:check` to see past the first one.
 */
import { Prescribe } from '@/features/recover/Prescribe';

export default function Prescription() {
  return <Prescribe />;
}
