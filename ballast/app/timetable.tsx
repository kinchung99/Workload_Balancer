/**
 * `/timetable` — the week's classes, page one.
 *
 * Three pages rather than one long scroll: the week, the modules, and the
 * import. `app/timetable/[step].tsx` is the same screen opened at a chosen one.
 */
import { Timetable } from '@/features/timetable/Timetable';

export default function TimetableRoute() {
  return <Timetable />;
}
