/** `/prescription/<step>` — the same two pages, opened at a chosen one. */
import { useLocalSearchParams } from 'expo-router';
import { Prescribe, STEP_SLUGS } from '@/features/recover/Prescribe';

export async function generateStaticParams() {
  return STEP_SLUGS.map((step) => ({ step }));
}

export default function PrescriptionStep() {
  const { step } = useLocalSearchParams<{ step?: string }>();
  const index = STEP_SLUGS.indexOf((step ?? '') as (typeof STEP_SLUGS)[number]);
  return <Prescribe initialStep={index < 0 ? 0 : index} />;
}
