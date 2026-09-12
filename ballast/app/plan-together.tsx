import { View } from 'react-native';
import { PageHeader, Screen, Stack } from '@/components';
import { SCREEN } from '@design/screens';
import { SocialPlanner } from '@/features/areas/SocialPlanner';

/**
 * Plan something together — the feature with no equivalent anywhere.
 *
 * Every calendar can show you your own free time. None of them can tell you
 * which of your friends has any capacity left, because none of them measure
 * capacity — only availability. An empty Thursday evening and an empty Thursday
 * evening are not the same offer if one of you is at 8%.
 *
 * So this does the coordinating that four busy people will never do themselves:
 * it takes the evenings they have shared, intersects them with the real gaps in
 * your own week, and offers only the windows that work for everybody. Their
 * battery sits next to their name the whole time, because inviting the person at
 * 8% to a day trip is not a kindness.
 */
export default function PlanTogether() {
  return (
    <Screen back="/friends" backLabel="Friends">
      <Stack gap={5} className="pt-2">
        <PageHeader
          {...SCREEN.together}
          eyebrow="Plan something"
          title="Find an evening"
        />


        <SocialPlanner />


        <View className="h-2" />
      </Stack>
    </Screen>
  );
}
