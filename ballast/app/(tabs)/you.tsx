import { Pressable, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import {
  Avatar, Card, Door, PageHeader, Screen, Section, Stack, Text,
} from '@/components';
import { SCREEN } from '@design/screens';
import { bandFor } from '@/lib/load';
import { VISIBILITY_SHORT } from '@/lib/sharing';
import { restOwedFrom, useStore } from '@/state/store';
import { useReading } from '@/state/selectors';
import { shownMood } from '@/lib/checkin';
import { tapFeedback } from '@/lib/haptics';

const TONE = { steady: 'steady', busy: 'busy', heavy: 'heavy', recovery: 'recovery' } as const;

/**
 * You — a profile, in the shape every social app has taught people to read.
 *
 * Avatar, name, the line you wrote, then a row of numbers, then the things you
 * can do. Instagram, TikTok and RedNote all put identity at the top for the same
 * reason: it answers "is this me?" before you have read anything, and it gives
 * the screen a centre.
 *
 * The one thing ours does differently is the **ring around the avatar**. It is
 * your band, so your own face carries your week — and it is the same component
 * that draws your friends, so the visual language is identical on both sides.
 * Learning to read one circle teaches you the whole app.
 */
export default function You() {
  const router = useRouter();
  const { recovery, account, circle, sharing, status, pic, moods, vibe } = useStore();
  const reading = useReading();

  const band = bandFor(reading.overall);
  const owed = restOwedFrom(recovery);
  const friends = circle.filter((p) => !p.isYou).length;

  const name = account?.name ?? 'You';
  const initials = account?.initials ?? 'Y';

  return (
    <Screen>
      <Stack gap={5} className="pt-2">
        {/* Identity first, and a way into settings from the corner. */}
        <Stack direction="row" align="center" justify="between">
          <PageHeader {...SCREEN.you} eyebrow="Your profile" title="You" />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Settings"
            onPress={() => { tapFeedback(); router.push('/settings'); }}
            className="min-h-min items-center justify-center rounded-pill bg-sunken active:opacity-70"
            style={{ width: 44, height: 44 }}
          >
            <Text variant="heading">⚙</Text>
          </Pressable>
        </Stack>

        {/* The profile card: who you are, how you are, and what you share. */}
        <Card tone={band} gap={5}>
          <Stack direction="row" gap={5} align="center">
            <Avatar initials={initials} band={band} size={84} charge={reading.charge} pic={pic} mood={shownMood(vibe, moods)} />
            <Stack gap={1} grow>
              <Text variant="title">{name}</Text>
              {account ? (
                <Text variant="micro" tone="muted">{account.email}</Text>
              ) : (
                <Text variant="micro" tone="muted">Not signed in</Text>
              )}
              {status ? (
                <Text variant="footnote" tone={TONE[band]}>“{status}”</Text>
              ) : (
                <Text variant="footnote" tone="subtle">No status yet</Text>
              )}
            </Stack>
          </Stack>

          {/* Three numbers, the way a profile always opens. */}
          <Stack direction="row" gap={3}>
            {/* Who you are in numbers. Each one is looked after on its own page. */}
            {[
              { value: `${reading.charge}%`, label: 'battery' },
              { value: String(friends), label: friends === 1 ? 'friend' : 'friends' },
              { value: VISIBILITY_SHORT[sharing], label: 'sharing' },
            ].map((stat) => (
              <View
                key={stat.label}
                accessibilityLabel={`${stat.value} ${stat.label}`}
                className="min-h-min flex-1 items-center gap-1 rounded-md bg-raised px-2 py-3"
              >
                <Text variant="callout" weight="bold">{stat.value}</Text>
                <Text variant="micro" tone="subtle">{stat.label}</Text>
              </View>
            ))}
          </Stack>

          <Stack direction="row" gap={3}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit profile"
              onPress={() => { tapFeedback(); router.push('/profile'); }}
              className="min-h-row flex-1 items-center justify-center rounded-pill border-2 border-inverse bg-inverse active:opacity-70"
            >
              <Text variant="caption" weight="bold" tone="inverse">Edit profile</Text>
            </Pressable>
            {!account ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Sign in"
                onPress={() => { tapFeedback(); router.push('/welcome'); }}
                className="min-h-row flex-1 items-center justify-center rounded-pill border-2 border-line-strong bg-raised active:opacity-70"
              >
                <Text variant="caption" weight="bold">Sign in</Text>
              </Pressable>
            ) : null}
          </Stack>
        </Card>

        {/* Looking after yourself. The week's tools live on Plan, friends on Friends. */}
        <Section family="rest" title="Recharge">
          <Door family="you" sticker="sun" title="Check in" sub="Your note · ⚡ recharge" onPress={() => router.push('/checkin')} />
          <Door family="rest" sticker="battery" title="Recovery" sub={`${owed}h owed`} onPress={() => router.push('/recover')} />
          <Door family="rest" sticker="moon" title="Tonight" sub="Plan an evening" onPress={() => router.push('/tonight/night' as Href)} />
        </Section>

        <View className="h-4" />
      </Stack>
    </Screen>
  );
}
