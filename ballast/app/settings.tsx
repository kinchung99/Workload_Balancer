import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import {
  Avatar, Button, Card, Disclosure, PageHeader, Screen, Section, Stack, Sticker, Text, type StickerName,
} from '@/components';
import { SCREEN } from '@design/screens';
import { FAMILY, type Family } from '@design/families';
import { bandFor } from '@/lib/load';
import { VISIBILITY_WORD } from '@/lib/sharing';
import { api } from '@/lib/api';
import { successFeedback, tapFeedback } from '@/lib/haptics';
import { useStore } from '@/state/store';
import { useReading } from '@/state/selectors';

/**
 * Settings — grouped the way people already expect to find things.
 *
 * Account, then privacy, then data, then the destructive things last and
 * visually quieter. That order is not ours; it is the one every phone has taught
 * its owner, and following it means nobody has to learn this screen.
 *
 * Two deliberate choices. **Privacy is one tap from the top**, not buried three
 * levels down, because this app asks people to publish when they are free and
 * that trade has to be easy to inspect. And **sign out is not styled as a
 * warning** — leaving is not a mistake, and dressing the exit in red is how apps
 * make people feel trapped.
 */
export default function Settings() {
  const router = useRouter();
  const { account, sharing, mode, circle, reset, endSession, pic } = useStore();
  const reading = useReading();
  const band = bandFor(reading.overall);
  const [busy, setBusy] = useState(false);

  const friends = circle.filter((p) => !p.isYou).length;

  const signOut = async () => {
    setBusy(true);
    await api.signOut();
    endSession();
    setBusy(false);
    successFeedback();
    router.replace('/welcome');
  };

  // One panel per family, so "account", "who sees what" and "your week" read
  // as three different things before a word of them is.
  const groups: Array<{
    title: string;
    family: Family;
    rows: Array<{ sticker: StickerName; label: string; value: string; to: Href }>;
  }> = [
    {
      title: 'Account',
      family: 'you',
      rows: [
        { sticker: 'wave', label: 'Edit profile', value: account?.name ?? 'Name, status, initials', to: '/profile' },
        { sticker: 'people', label: 'Your circle', value: friends ? `${friends} ${friends === 1 ? 'friend' : 'friends'}` : 'Nobody yet', to: '/friends' },
        { sticker: 'chat', label: 'Find friends', value: 'Add by email', to: '/find-friends' },
        // Guests have no password yet; theirs is made when they keep the account.
        ...(account && !account.isGuest ? [{ sticker: 'star' as StickerName, label: 'Password', value: 'Change it', to: '/password' as Href }] : []),
      ],
    },
    {
      title: 'Privacy',
      family: 'people',
      rows: [
        { sticker: 'calendar', label: 'What your circle sees', value: VISIBILITY_WORD(sharing), to: '/sharing' },
      ],
    },
    {
      title: 'Your week',
      family: 'week',
      rows: [
        { sticker: 'class', label: 'Timetable', value: 'Classes and flags', to: '/timetable' },
        { sticker: 'sun', label: 'Check in', value: 'Note, mood, sleep', to: '/checkin' },
      ],
    },
  ];

  return (
    <Screen back="/you" backLabel="You">
      <Stack gap={5} className="pt-2">
        <PageHeader {...SCREEN.you} eyebrow="Settings" title="Settings" />

        {/* Who is signed in, at the top, the way a settings screen always opens. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={account ? `Signed in as ${account.name}` : 'Sign in'}
          onPress={() => { tapFeedback(); router.push(account ? '/profile' : '/welcome'); }}
          className="active:opacity-70"
        >
          <Card tone={account ? band : 'sunken'} gap={4}>
            <Stack direction="row" gap={4} align="center">
              <Avatar initials={account?.initials ?? '?'} band={account ? band : undefined} stale={!account} size={56} pic={pic} />
              <Stack gap={1} grow>
                <Text variant="body" weight="semibold">{account?.name ?? 'Not signed in'}</Text>
                <Text variant="micro" tone="muted">
                  {account?.email ?? 'Sign in to sync and add friends'}
                </Text>
              </Stack>
              <Text variant="heading" tone="subtle">›</Text>
            </Stack>
          </Card>
        </Pressable>

        {groups.map((group) => (
          <Section key={group.title} family={group.family} title={group.title}>
            <Card pad={0} gap={0} className="px-4">
              {group.rows.map((row, index) => (
                <Pressable
                  key={row.label}
                  accessibilityRole="button"
                  accessibilityLabel={`${row.label}. ${row.value}`}
                  onPress={() => { tapFeedback(); router.push(row.to); }}
                  className={`min-h-row flex-row items-center gap-4 py-4 active:opacity-70 ${
                    index > 0 ? 'border-t border-line-hairline' : ''
                  }`}
                >
                  <View className="items-center justify-center rounded-pill" style={{ width: 36, height: 36, backgroundColor: FAMILY[group.family].wash }}>
                    <Sticker name={row.sticker} size={22} />
                  </View>
                  <Text variant="body" weight="semibold" className="flex-1">{row.label}</Text>
                  <Text variant="micro" tone="subtle">{row.value}</Text>
                  <Text variant="callout" tone="subtle">›</Text>
                </Pressable>
              ))}
            </Card>
          </Section>
        ))}

        {/* Data: the promise in the row, the why one tap in. */}
        <Text variant="footnote" tone="subtle" className="text-center">🔒 Your tasks are never read by the server.</Text>

        {/* Quiet, last, and not dressed up as a danger zone. */}
        <Stack gap={3}>
          <Button label="Run setup again" kind="quiet" onPress={() => { tapFeedback(); router.push('/setup/timetable' as Href); }} />
          {mode === 'demo' ? (
            <Button label="Reset the sample week" kind="quiet" onPress={() => { reset(); router.replace('/'); }} />
          ) : null}
          {account ? (
            <Button
              label={busy ? 'Signing out…' : 'Sign out'}
              kind="quiet"
              onPress={() => { if (!busy) void signOut(); }}
            />
          ) : (
            <Button
              label="Leave the sample week"
              kind="secondary"
              onPress={() => { tapFeedback(); endSession(); router.replace('/welcome'); }}
            />
          )}
        </Stack>

        <View className="h-2" />
      </Stack>
    </Screen>
  );
}
