/**
 * `/actions` — Tonight, page one.
 *
 * The tab entry. `app/tonight/[step].tsx` is the same screen opened at a chosen
 * page: a link can point at one question, and the static export renders each
 * page on its own so `render:check` covers all three rather than only the first.
 */
import { Tonight } from '@/features/tonight/Tonight';

export default function Actions() {
  return <Tonight />;
}
