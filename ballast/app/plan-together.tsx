import { useState } from 'react';
import { View } from 'react-native';
import { PageHeader, Screen, Stack } from '@/components';
import { SCREEN } from '@design/screens';
import { Planner } from '@/features/social/Planner';

/**
 * Plan something together — the feature with no equivalent anywhere.
 *
 * Every calendar can show you your own free time. None of them can tell you
 * which of your friends has any capacity left, because none of them measure
 * capacity — only availability. An empty Thursday evening and an empty Thursday
 * evening are not the same offer if one of you is at 8%.
 *
 * This is the one-off version: whoever you pick, today. Groups you plan with
 * often live on the Friends tab and open the same planner with the group as
 * the who.
 */
export default function PlanTogether() {
  const [people, setPeople] = useState<string[]>(['amin', 'ravi']);

  return (
    <Screen back="/friends" backLabel="Friends">
      <Stack gap={5} className="pt-2">
        <PageHeader
          {...SCREEN.together}
          eyebrow="Plan something"
          title="Find an evening"
        />
        <Planner
          people={people}
          onAdd={(id) => setPeople((prev) => [...prev, id])}
          onRemove={(id) => setPeople((prev) => prev.filter((p) => p !== id))}
          onUseGroup={(group) => setPeople(group.members)}
        />
        <View className="h-2" />
      </Stack>
    </Screen>
  );
}
