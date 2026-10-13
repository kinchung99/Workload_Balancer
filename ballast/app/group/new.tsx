import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, TextInput, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Avatar, Button, PageHeader, Screen, Stack, Text } from '@/components';
import { color, radius } from '@design/tokens';
import { successFeedback, tapFeedback } from '@/lib/haptics';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useStore } from '@/state/store';
import { frequentFriends } from '@/lib/circle';
import { PeopleList } from '@/features/social/PeopleList';
import { GROUP_EMOJIS } from '@/features/social/groupArt';
import { createGroupAndInvite } from '@/lib/social';
import { NATIVE_DRIVER } from '@/lib/nativeDriver';

/**
 * `/group/new` — a picture, a name, some people. Three things, one screen.
 */
export default function NewGroup() {
  const router = useRouter();
  const { circle } = useStore();
  const friends = circle.filter((person) => !person.isYou);
  const [emoji, setEmoji] = useState(GROUP_EMOJIS[0]);
  const [name, setName] = useState('');
  const [members, setMembers] = useState<string[]>([]);
  const reduce = useReducedMotion();
  const pop = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reduce) return;
    pop.setValue(0.75);
    Animated.spring(pop, { toValue: 1, friction: 4, tension: 160, useNativeDriver: NATIVE_DRIVER }).start();
  }, [emoji, reduce, pop]);

  const ready = members.length > 0;

  return (
    <Screen
      back="/friends"
      backLabel="Friends"
      footer={
        <Button
          label={ready ? `Create & invite ${members.length}` : 'Pick who to invite'}
          kind={ready ? 'primary' : 'secondary'}
          disabled={!ready}
          onPress={async () => {
            if (!ready) return;
            // They are asked, not added: each one joins when they say yes.
            const id = await createGroupAndInvite(name.trim() || 'New group', emoji, members);
            successFeedback();
            if (id) router.replace(`/group/${id}` as Href);
          }}
        />
      }
    >
      <Stack gap={5} className="pt-2">
        <PageHeader sticker="people" wash={color.decor.mint} eyebrow="Friends" title="New group" sub="For the people you plan with most." />

        <Stack align="center" gap={3}>
          <Animated.View
            style={{
              width: 96, height: 96, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center',
              backgroundColor: color.decor.lemon, borderWidth: 2, borderColor: color.ink.default,
              transform: [{ scale: pop }],
            }}
          >
            <Text variant="hero">{emoji}</Text>
          </Animated.View>
          <Stack direction="row" gap={2} wrap justify="center">
            {GROUP_EMOJIS.map((option) => (
              <Pressable
                key={option}
                accessibilityRole="radio"
                accessibilityState={{ selected: option === emoji }}
                accessibilityLabel={`Picture ${option}`}
                onPress={() => { tapFeedback(); setEmoji(option); }}
                className="items-center justify-center rounded-md active:opacity-60"
                style={{
                  width: 42, height: 42,
                  backgroundColor: option === emoji ? color.decor.cream : color.surface.sunken,
                  borderWidth: option === emoji ? 2 : 0, borderColor: color.ink.default,
                }}
              >
                <Text variant="heading">{option}</Text>
              </Pressable>
            ))}
          </Stack>
        </Stack>

        <TextInput
          value={name}
          onChangeText={(text) => setName(text.slice(0, 32))}
          accessibilityLabel="Group name"
          placeholder="Name it: Study crew, Flat 4B…"
          placeholderTextColor={color.ink.subtle}
          className="min-h-row rounded-lg border-2 border-line-strong bg-page px-4 py-3 text-heading text-ink-default"
        />

        <Stack gap={3}>
          <Text variant="micro" tone="subtle">INVITE · {members.length} PICKED</Text>
          <PeopleList
            people={friends}
            frequent={frequentFriends(circle, 6)}
            selected={members}
            onToggle={(id) => setMembers(members.includes(id) ? members.filter((m) => m !== id) : [...members, id])}
          />
        </Stack>
      </Stack>
    </Screen>
  );
}
