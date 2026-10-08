import { View } from 'react-native';
import { PageHeader, Screen, Stack } from '@/components';
import { SCREEN } from '@design/screens';
import { Planner } from '@/features/social/Planner';
import { useStore } from '@/state/store';

/**
 * Plan something together — the feature with no equivalent anywhere.
 *
 * Every calendar can show you your own free time. None of them can tell you
 * which of your friends has any capacity left, because none of them measure
 * capacity — only availability. An empty Thursday evening and an empty Thursday
 * evening are not the same offer if one of you is at 8%.
 *
 * This is the one-off version: tap whoever is coming this time, or start from a
 * group. Groups you plan with often live on the Friends tab and open the same
 * planner with their members as the faces to pick from.
 */
export default function PlanTogether() {
  const { circle, groups } = useStore();
  const friends = circle.filter((person) => !person.isYou);

  return (
    <Screen back="/friends" backLabel="Friends">
      <Stack gap={5} className="pt-2">
        <PageHeader
          {...SCREEN.together}
          eyebrow="Plan something"
          title="Find an evening"
        />
        <Planner pool={friends} initial={[]} quickGroups={groups} />
        <View className="h-2" />
      </Stack>
    </Screen>
  );
}
