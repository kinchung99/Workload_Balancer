/** `/tonight/<step>` — the evening planner, opened at a chosen page. */
import { useLocalSearchParams } from 'expo-router';
import { STEP_SLUGS, Tonight } from '@/features/tonight/Tonight';

export async function generateStaticParams() {
  return STEP_SLUGS.map((step) => ({ step }));
}

export default function TonightStep() {
  const { step } = useLocalSearchParams<{ step?: string }>();
  const index = STEP_SLUGS.indexOf((step ?? '') as (typeof STEP_SLUGS)[number]);
  return <Tonight initialStep={index < 0 ? 0 : index} />;
}
