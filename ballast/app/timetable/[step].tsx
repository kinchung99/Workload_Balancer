/** `/timetable/<step>` — week, modules or import, opened directly. */
import { useLocalSearchParams } from 'expo-router';
import { STEP_SLUGS, Timetable } from '@/features/timetable/Timetable';

export async function generateStaticParams() {
  return STEP_SLUGS.map((step) => ({ step }));
}

export default function TimetableStep() {
  const { step } = useLocalSearchParams<{ step?: string }>();
  const index = STEP_SLUGS.indexOf((step ?? '') as (typeof STEP_SLUGS)[number]);
  return <Timetable initialStep={index < 0 ? 0 : index} />;
}
