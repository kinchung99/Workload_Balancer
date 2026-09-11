/**
 * `/add` — capture, page one.
 *
 * A flat route rather than `add/index.tsx`: static hosting serves a directory
 * index at `/add/` only, so the folder version made the canonical link every
 * other screen uses answer 404 on a cold load. The four pages themselves are
 * local state inside one component, so moving between them never risks what you
 * have already typed; `app/add/[step].tsx` is a second way in, not the flow.
 */
import { Capture } from '@/features/add/Capture';

export default function Add() {
  return <Capture />;
}
