import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Avatar, Button, Card, Chip, PageHeader, Screen, Stack, Text, Toggle } from '@/components';
import { color } from '@design/tokens';
import { tapFeedback } from '@/lib/haptics';
import { useStore } from '@/state/store';

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
      footer={<Button label={`Done · ${seeing.length} of ${friends.length} can see your times`} onPress={() => router.back()} />}
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

        <Card gap={2}>
          {friends.map((person, index) => {
            const sees = !hidden.includes(person.id);
            return (
              <View key={person.id}>
                <Stack direction="row" gap={4} align="center" className="py-2" style={{ opacity: sees ? 1 : 0.6 }}>
                  <Avatar initials={person.initials} band={person.band} size={40} stale={!sees} />
                  <Stack gap={1} grow>
                    <Text variant="body" weight="semibold">{person.name}</Text>
                    <Text variant="micro" tone={sees ? 'recovery' : 'subtle'}>
                      {sees ? 'Sees your free times' : '🚫 No times · still sees your battery'}
                    </Text>
                  </Stack>
                  <Toggle state={sees ? 'on' : 'off'} label={`${person.name} sees your times`} onPress={() => toggleHiddenFrom(person.id)} />
                </Stack>
                {index < friends.length - 1 ? <View className="h-px w-full bg-line-hairline" /> : null}
              </View>
            );
          })}
        </Card>
      </Stack>
    </Screen>
  );
}
