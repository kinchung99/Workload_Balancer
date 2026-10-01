import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Avatar, Button, Screen, Stack, Text } from '@/components';
import { color, radius } from '@design/tokens';
import { successFeedback, tapFeedback } from '@/lib/haptics';
import { useStore } from '@/state/store';
import { Planner } from '@/features/social/Planner';
import { GROUP_EMOJIS, groupWash } from '@/features/social/groupArt';

/** The two seeded groups, so `/group/...` renders in the static export. */
export async function generateStaticParams() {
  return [{ id: 'study-crew' }, { id: 'flat-4b' }];
}

/**
 * One group: who is in it, when you are all free, and the plan.
 *
 * A group chat without the chat. Everything a group chat is for - finding the
 * evening that works - is on this page; everything it is bad at, forty messages
 * of "I can't do Tuesday", is the heatmap doing it in one look. The talking still
 * happens where it already does: the invite is a message the app writes for you.
 */
export default function GroupPage() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { groups, circle, toggleGroupMember, updateGroup, deleteGroup } = useStore();
  const group = groups.find((g) => g.id === id);
  const [editing, setEditing] = useState(false);

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

  const members = circle.filter((person) => group.members.includes(person.id));
  const wash = groupWash(group.id);

  return (
    <Screen back="/friends" backLabel="Friends">
      <Stack gap={5} className="pt-2">
        {/* The group's own header: its picture, its name, its people. */}
        <View className="overflow-hidden rounded-xl" style={{ backgroundColor: wash }}>
          <Stack gap={4} className="px-5 py-5">
            <Stack direction="row" gap={4} align="center">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Change the group's picture and name"
                onPress={() => { tapFeedback(); setEditing(!editing); }}
                className="items-center justify-center rounded-pill bg-raised active:opacity-70"
                style={{ width: 72, height: 72, borderWidth: 2, borderColor: color.ink.default }}
              >
                <Text variant="display">{group.emoji}</Text>
              </Pressable>
              <Stack gap={1} grow>
                <Text variant="micro">GROUP · {members.length + 1} PEOPLE</Text>
                {editing ? (
                  <TextInput
                    value={group.name}
                    onChangeText={(name) => updateGroup(group.id, { name: name.slice(0, 32) })}
                    accessibilityLabel="Group name"
                    autoFocus
                    className="min-h-min rounded-md border border-line-strong bg-page px-3 py-2 text-heading text-ink-default"
                  />
                ) : (
                  <Text variant="title" accessibilityRole="header">{group.name}</Text>
                )}
                <Text variant="footnote" tone="muted">You{members.length ? `, ${members.map((m) => m.name).join(', ')}` : ''}</Text>
              </Stack>
            </Stack>

            {editing ? (
              <Stack direction="row" gap={2} wrap>
                {GROUP_EMOJIS.map((emoji) => (
                  <Pressable
                    key={emoji}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: emoji === group.emoji }}
                    accessibilityLabel={`Picture ${emoji}`}
                    onPress={() => { tapFeedback(); updateGroup(group.id, { emoji }); }}
                    className="items-center justify-center rounded-md active:opacity-60"
                    style={{
                      width: 40, height: 40,
                      backgroundColor: emoji === group.emoji ? color.surface.raised : 'transparent',
                      borderWidth: emoji === group.emoji ? 2 : 0, borderColor: color.ink.default,
                    }}
                  >
                    <Text variant="heading">{emoji}</Text>
                  </Pressable>
                ))}
              </Stack>
            ) : (
              <Stack direction="row" align="center">
                {members.map((person, i) => (
                  <View key={person.id} style={{ marginLeft: i ? -10 : 0, borderRadius: radius.pill, borderWidth: 2, borderColor: wash }}>
                    <Avatar initials={person.initials} band={person.band} size={36} />
                  </View>
                ))}
                <Text variant="micro" className="pl-3">Tap the picture to rename or restyle</Text>
              </Stack>
            )}
          </Stack>
        </View>

        <Planner
          group={group}
          people={group.members}
          onAdd={(friendId) => toggleGroupMember(group.id, friendId)}
          onRemove={(friendId) => toggleGroupMember(group.id, friendId)}
        />

        <Button
          label="Delete this group"
          kind="quiet"
          onPress={() => {
            deleteGroup(group.id);
            successFeedback();
            router.replace('/friends');
          }}
        />
      </Stack>
    </Screen>
  );
}
