import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Avatar, Button, Card, PageHeader, Screen, Stack, Text } from '@/components';
import { color } from '@design/tokens';
import { successFeedback, tapFeedback } from '@/lib/haptics';
import { useStore } from '@/state/store';
import { frequentFriends } from '@/lib/circle';
import { PeopleList } from '@/features/social/PeopleList';
import { groupWash } from '@/features/social/groupArt';

/** The seeded groups, so `/group/.../add` renders in the static export. */
export async function generateStaticParams() {
  return [{ id: 'study-crew' }, { id: 'flat-4b' }];
}

/**
 * `/group/<id>/add` — adding people to a group, on a page of its own.
 *
 * It used to be a list under the planner, which made "add someone to the group"
 * and "ask someone along tonight" look like the same action - they are not. Here
 * it is plainly the first: pick faces, press once, and they are members until
 * somebody removes them.
 */
export default function AddMembers() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { groups, circle, toggleGroupMember } = useStore();
  const group = groups.find((g) => g.id === id);
  const [picked, setPicked] = useState<string[]>([]);

  if (!group) {
    return (
      <Screen back="/friends" backLabel="Friends">
        <Stack gap={4} className="pt-6">
          <Text variant="title">That group is gone.</Text>
          <Button label="Back to your circle" onPress={() => router.replace('/friends')} />
        </Stack>
      </Screen>
    );
  }

  const outside = circle.filter((person) => !person.isYou && !group.members.includes(person.id));

  return (
    <Screen
      back={`/group/${group.id}` as Href}
      backLabel={group.name}
      footer={
        outside.length ? (
          <Button
            label={picked.length ? `Add ${picked.length} to ${group.name}` : 'Pick who to add'}
            kind={picked.length ? 'primary' : 'secondary'}
            disabled={!picked.length}
            onPress={() => {
              picked.forEach((friend) => toggleGroupMember(group.id, friend));
              successFeedback();
              router.back();
            }}
          />
        ) : (
          <Button label="Find friends" onPress={() => router.push('/find-friends')} />
        )
      }
    >
      <Stack gap={5} className="pt-2">
        <PageHeader
          sticker="people"
          wash={groupWash(group.id)}
          eyebrow={`${group.emoji} ${group.name}`}
          title="Add members"
        />

        {outside.length ? (
          <PeopleList
            people={outside}
            frequent={frequentFriends(outside, 6)}
            selected={picked}
            onToggle={(friend) => setPicked(picked.includes(friend) ? picked.filter((p) => p !== friend) : [...picked, friend])}
          />
        ) : (
          <Card tone="sunken" gap={2}>
            <Text variant="callout" weight="semibold">Everyone in your circle is already in it.</Text>
            <Text variant="footnote" tone="muted">Find more friends first, then add them here.</Text>
          </Card>
        )}
      </Stack>
    </Screen>
  );
}
