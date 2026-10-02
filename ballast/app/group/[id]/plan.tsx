import { View } from 'react-native';
import { useLocalSearchParams, type Href } from 'expo-router';
import { PageHeader, Screen, Stack, Text } from '@/components';
import { useStore } from '@/state/store';
import { Planner } from '@/features/social/Planner';
import { groupWash } from '@/features/social/groupArt';

/** The seeded groups, so `/group/.../plan` renders in the static export. */
export async function generateStaticParams() {
  return [{ id: 'study-crew' }, { id: 'flat-4b' }];
}

/**
 * `/group/<id>/plan` — planning one hangout with some or all of a group.
 *
 * Its own page because it is a whole flow: who to ask this time, what, when
 * everyone is free, and the invite. On the group page it buried the members.
 */
export default function GroupPlan() {
  const { id, act } = useLocalSearchParams<{ id: string; act?: string }>();
  const { groups, circle } = useStore();
  const group = groups.find((g) => g.id === id);
  const members = group ? circle.filter((person) => group.members.includes(person.id)) : [];

  return (
    <Screen back={`/group/${id}` as Href} backLabel={group?.name ?? 'Group'}>
      <Stack gap={5} className="pt-2">
        {group ? (
          <>
            <PageHeader sticker="heart" wash={groupWash(group.id)} eyebrow={`${group.emoji} ${group.name}`} title="Plan a hangout" />
            <Planner group={group} pool={members} initialPlan={act} />
          </>
        ) : (
          <Text variant="heading" className="pt-6">That group is gone.</Text>
        )}
        <View className="h-2" />
      </Stack>
    </Screen>
  );
}
