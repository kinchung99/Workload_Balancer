import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { PageHeader, Screen, Stack } from '@/components';
import { SCREEN } from '@design/screens';
import { frequentFriends, updatedToday } from '@/lib/circle';
import { useStore } from '@/state/store';
import { PeopleList } from '@/features/social/PeopleList';

/**
 * All friends - the whole circle, for when it is sixty people, not four.
 *
 * A search box, your frequent people on top, then everyone A to Z. Tap anyone
 * for their page: their battery, when they are free, and a message.
 */
export default function Everyone() {
  const router = useRouter();
  const { search } = useLocalSearchParams<{ search?: string }>();
  const { circle } = useStore();
  const friends = circle.filter((person) => !person.isYou);

  return (
    <Screen back="/friends" backLabel="Friends">
      <Stack gap={5} className="pt-2">
        <PageHeader {...SCREEN.friends} eyebrow={`${updatedToday(circle)} checked in today`} title="All friends" />
        <PeopleList
          people={friends}
          frequent={frequentFriends(circle, 6)}
          onOpen={(person) => router.push(`/friend/${person.id}`)}
          autoFocus={search === '1'}
          placeholder={`Search ${friends.length} friends`}
        />
        <View className="h-2" />
      </Stack>
    </Screen>
  );
}
