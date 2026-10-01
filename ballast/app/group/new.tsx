import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, TextInput, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Avatar, Button, PageHeader, Screen, Stack, Text } from '@/components';
import { color, radius } from '@design/tokens';
import { successFeedback, tapFeedback } from '@/lib/haptics';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useStore } from '@/state/store';
import { GROUP_EMOJIS } from '@/features/social/groupArt';

/**
 * `/group/new` — a picture, a name, some people. Three things, one screen.
 */
export default function NewGroup() {
  const router = useRouter();
  const { circle, createGroup } = useStore();
  const friends = circle.filter((person) => !person.isYou);
  const [emoji, setEmoji] = useState(GROUP_EMOJIS[0]);
  const [name, setName] = useState('');
  const [members, setMembers] = useState<string[]>([]);
  const reduce = useReducedMotion();
  const pop = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reduce) return;
    pop.setValue(0.75);
    Animated.spring(pop, { toValue: 1, friction: 4, tension: 160, useNativeDriver: true }).start();
  }, [emoji, reduce, pop]);

  const ready = members.length > 0;

  return (
    <Screen
      back="/friends"
      backLabel="Friends"
      footer={
        <Button
          label={ready ? `Create ${name.trim() || 'group'} · ${members.length + 1} people` : 'Pick at least one friend'}
          kind={ready ? 'primary' : 'secondary'}
          disabled={!ready}
          onPress={() => {
            if (!ready) return;
            const id = createGroup({ name: name.trim() || 'New group', emoji, members });
            successFeedback();
            router.replace(`/group/${id}` as Href);
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
          <Text variant="micro" tone="subtle">WHO’S IN · {members.length} PICKED</Text>
          <Stack direction="row" gap={3} wrap>
            {friends.map((person) => {
              const on = members.includes(person.id);
              return (
                <Pressable
                  key={person.id}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={person.name}
                  onPress={() => { tapFeedback(); setMembers(on ? members.filter((m) => m !== person.id) : [...members, person.id]); }}
                  className={`items-center gap-2 rounded-lg border-2 px-3 py-3 active:opacity-70 ${on ? 'border-inverse bg-decor-cream' : 'border-line-hairline'}`}
                  style={{ width: 96 }}
                >
                  <Avatar initials={person.initials} band={person.band} size={44} />
                  <Text variant="caption" weight="semibold">{person.name}</Text>
                  <View className={`rounded-pill px-2 py-1 ${on ? 'bg-inverse' : 'bg-sunken'}`}>
                    <Text variant="micro" tone={on ? 'inverse' : 'subtle'}>{on ? '✓ In' : 'Add'}</Text>
                  </View>
                </Pressable>
              );
            })}
          </Stack>
        </Stack>
      </Stack>
    </Screen>
  );
}
