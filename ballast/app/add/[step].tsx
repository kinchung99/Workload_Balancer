/**
 * `/add/<step>` — the same four-page capture, opened at a chosen page.
 *
 * Worth having as real routes rather than a query string for two reasons: a
 * link can point at one question ("set the five areas on this one"), and the
 * static export renders each page on its own, so every one of them is covered
 * by `npm run render:check` instead of only the first.
 */
import { useLocalSearchParams } from 'expo-router';
import { Capture, STEP_SLUGS } from '@/features/add/Capture';

export async function generateStaticParams() {
  return STEP_SLUGS.map((step) => ({ step }));
}

export default function AddStep() {
  const { step } = useLocalSearchParams<{ step?: string }>();
  const index = STEP_SLUGS.indexOf((step ?? '') as (typeof STEP_SLUGS)[number]);
  return <Capture initialStep={index < 0 ? 0 : index} />;
}
