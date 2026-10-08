import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Avatar, Button, Card, Chip, PageHeader, Screen, Stack, Text, Toggle } from '@/components';
import { color } from '@design/tokens';
import { tapFeedback } from '@/lib/haptics';
import { useStore } from '@/state/store';
import { frequentFriends } from '@/lib/circle';
import { PeopleList } from '@/features/social/PeopleList';

/**
 * `/sharing/people` — who sees your times at all.
 *
 * One switch per friend, plus the two shortcuts people actually want: everyone,
 * or only one group. Hiding someone hides every window from them and nothing
 * else - they still see your battery, because that is how a friend knows to
 * check on you, and switching that off would make this a block button.
 *
 * In a real account this is enforced by the server on every read, not by this
 * phone deciding what to send. See `routes/circle.ts`.
 */
export default function SharePeople() {
  const router = useRouter();
  const { circle, groups, shareRules, toggleHiddenFrom, setShareRules, sharing } = useStore();
  const friends = circle.filter((person) => !person.isYou);
  const hidden = shareRules.hiddenFrom;
  const seeing = friends.filter((person) => !hidden.includes(person.id));

  return (
    <Screen
      back="/sharing"
      backLabel="What they see"
      footer={<Button label={`Done · ${seeing.length} of ${friends.length} can see your times`} onPress={() => (router.canGoBack() ? router.back() : router.replace('/sharing'))} />}
    >
      <Stack gap={5} className="pt-2">
        <PageHeader sticker="people" wash={color.decor.mint} eyebrow="Your privacy" title="Who sees your times" sub="Hidden friends still see your battery." />

        {sharing === 'off' ? (
          <Card tone="busy" gap={2}>
            <Text variant="callout" weight="semibold">Your calendar is set to Nothing</Text>
            <Text variant="footnote" tone="muted">Nobody sees any times right now. These switches apply when you share again.</Text>
          </Card>
        ) : null}

        <Stack gap={2}>
          <Text variant="micro" tone="subtle">QUICK PICK</Text>
          <Stack direction="row" gap={2} wrap>
            <Chip
              label="🌍 Everyone"
              tone={hidden.length === 0 ? 'selected' : 'plain'}
              onPress={() => { tapFeedback(); setShareRules({ hiddenFrom: [] }); }}
            />
            {groups.map((group) => {
              const only = friends.filter((person) => !group.members.includes(person.id)).map((person) => person.id);
              const active = hidden.length > 0 && only.length === hidden.length && only.every((id) => hidden.includes(id));
              return (
                <Chip
                  key={group.id}
                  label={`${group.emoji} Only ${group.name}`}
                  tone={active ? 'selected' : 'plain'}
                  onPress={() => { tapFeedback(); setShareRules({ hiddenFrom: only }); }}
                />
              );
            })}
          </Stack>
        </Stack>

        <PeopleList
          people={friends}
          frequent={frequentFriends(circle, 6)}
          selected={seeing.map((person) => person.id)}
          onToggle={(id) => toggleHiddenFrom(id)}
          right={(person) => (
            <Toggle
              state={hidden.includes(person.id) ? 'off' : 'on'}
              label={`${person.name} sees your times`}
              onPress={() => toggleHiddenFrom(person.id)}
            />
          )}
        />
      </Stack>
    </Screen>
  );
}
