import { useState } from 'react';
import { Linking, Pressable, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import {
  Button, Card, Chip, PageHeader, Screen, Stack, Sticker, Text,
} from '@/components';
import { color } from '@design/tokens';
import { SCREEN } from '@design/screens';
import { onBallastCount, suggestions, whatsapp } from '@/lib/sharing';
import { successFeedback, tapFeedback } from '@/lib/haptics';
import { useStore } from '@/state/store';
import { api } from '@/lib/api';

const INVITE = 'I am using Ballast to keep my week from piling up. Want to be in my circle? ballast.app';

/**
 * Getting a circle started.
 *
 * The friends side of this app is the best thing in it and it is worth nothing
 * on day one, because on day one you are the only person in your circle. Asking
 * a student to type in four friends by hand is asking them to do the work before
 * seeing any of the reward, and almost nobody does.
 *
 * So it starts from the address book they already have. People already on
 * Ballast are one tap — nothing to send, nothing to wait for, they are in your
 * circle this evening. Everyone else gets an invitation written for them and
 * handed to WhatsApp, because an invite that has to be composed is an invite
 * that does not get sent.
 */
export default function FindFriends() {
  const router = useRouter();
  const { circle, phoneContacts, addFriend, mode, requests, setRequests, account } = useStore();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /**
   * Live mode adds people by email; demo mode matches a seeded address book.
   *
   * Contact matching against a real phone needs a permission prompt and hashed
   * lookups, which is a week's work and a privacy review rather than an
   * afternoon. An email address is what a student can actually type, and it
   * works the evening they install this.
   */
  /** A code if it looks like one, otherwise an email. Both reach the same route. */
  const ask = async () => {
    const typed = email.trim();
    const asCode = typed.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const useCode = !typed.includes('@') && asCode.length === 6;
    if (!useCode && !typed.includes('@')) return;

    setBusy(true);
    const res = await api.addFriend(useCode ? { code: asCode } : { email: typed.toLowerCase() });
    setBusy(false);
    if (res.ok) {
      setSent(typed);
      setEmail('');
      successFeedback();
      const pending = await api.requests();
      if (pending.ok) setRequests(pending.data.requests);
    }
  };

  const answer = async (userId: string, action: 'accept' | 'decline') => {
    tapFeedback();
    await api.respondToFriend(userId, action);
    const pending = await api.requests();
    if (pending.ok) setRequests(pending.data.requests);
  };

  // Six characters is a code; an @ is an email. Anything else is not ready yet.
  const typed = email.trim();
  const canAsk = typed.includes('@')
    || typed.toUpperCase().replace(/[^A-Z0-9]/g, '').length === 6;

  const incoming = requests.filter((r) => r.direction === 'incoming');
  const outgoing = requests.filter((r) => r.direction === 'outgoing');

  const list = suggestions(phoneContacts);
  const here = onBallastCount(phoneContacts);
  // The circle itself, not the address-book flags: people can be in your circle
  // without being in your contacts, and counting the flags said "2" next to a
  // screen listing four friends.
  const added = circle.filter((person) => !person.isYou).length;

  return (
    <Screen
      back={from === 'setup' ? ('/setup/friends' as Href) : '/friends'}
      backLabel={from === 'setup' ? 'Setup' : 'Friends'}
      footer={<Button label="Done" onPress={() => router.replace('/friends')} />}
    >
      <Stack gap={5} className="pt-2">
        <PageHeader
          {...SCREEN.findFriends}
          eyebrow={`${added} in your circle`}
          title="Find your people"
        />

        {here && mode === 'demo' ? (
          <Card tone="steady" gap={3}>
            <Stack direction="row" gap={4} align="center">
              <Sticker name="people" size={42} wiggle />
              <Stack gap={1} grow>
                <Text variant="heading">{here} already here</Text>
                <Text variant="footnote" tone="muted">From your contacts. One tap each.</Text>
              </Stack>
            </Stack>
          </Card>
        ) : null}

        {mode === 'live' ? (
          <Stack gap={5}>
            {/*
              Your own code first.
              
              At a table, the flow is "read me yours" — so the thing you hand
              over has to be the most legible thing on the screen, not buried
              under the box for typing theirs.
            */}
            {account ? (
              <Card tone="steady" gap={3} align="center">
                <Text variant="micro" tone="subtle">YOUR CODE</Text>
                <Text variant="hero" weight="bold" accessibilityLabel={`Your code is ${account.code.split('').join(' ')}`}>
                  {account.code}
                </Text>
                <Text variant="footnote" tone="muted">Read this out and they can add you.</Text>
              </Card>
            ) : null}

            <Card gap={4}>
              <Stack gap={2}>
                <Text variant="micro" tone="subtle">THEIR CODE, OR THEIR EMAIL</Text>
                <TextInput
                  value={email}
                  onChangeText={(next) => { setEmail(next); setSent(null); }}
                  placeholder="K4M2PQ"
                  placeholderTextColor={color.ink.subtle}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  accessibilityLabel="Their email"
                  className="min-h-row rounded-md border-2 border-line-hairline bg-decor-cream px-4 py-3 text-body text-ink-default"
                />
              </Stack>
              <Button
                label={busy ? 'Asking…' : 'Ask to be in their circle'}
                kind={canAsk && !busy ? 'primary' : 'secondary'}
                accessibilityState={{ disabled: !canAsk || busy }}
                onPress={() => { if (canAsk && !busy) void ask(); }}
              />
              {/*
                The same answer whether or not the address exists. Saying "no such
                user" would turn this into a way of testing which addresses are
                real accounts.
              */}
              {sent ? (
                <Text variant="footnote" tone="steady" accessibilityLiveRegion="polite">
                  Sent. If {sent} is on Ballast, they will see it.
                </Text>
              ) : null}
            </Card>

            {incoming.length ? (
              <Stack gap={3}>
                <Text variant="micro" tone="subtle">WAITING ON YOU</Text>
                {incoming.map((r) => (
                  <Stack key={r.userId} direction="row" gap={4} align="center" className="min-h-row rounded-lg border-2 border-inverse bg-decor-cream px-4 py-3">
                    <View className="items-center justify-center rounded-pill" style={{ width: 40, height: 40, backgroundColor: color.decor.mint }}>
                      <Text variant="footnote" weight="semibold">{r.initials}</Text>
                    </View>
                    <Stack gap={1} grow>
                      <Text variant="body" weight="semibold">{r.name}</Text>
                      <Text variant="micro" tone="subtle">wants to be in your circle</Text>
                    </Stack>
                    <Chip label="Add" tone="selected" onPress={() => void answer(r.userId, 'accept')} />
                    <Chip label="No" onPress={() => void answer(r.userId, 'decline')} />
                  </Stack>
                ))}
              </Stack>
            ) : null}

            {outgoing.length ? (
              <Stack gap={3}>
                <Text variant="micro" tone="subtle">WAITING ON THEM</Text>
                {outgoing.map((r) => (
                  <Stack key={r.userId} direction="row" gap={4} align="center" className="min-h-row rounded-lg border-2 border-line-hairline bg-raised px-4 py-3">
                    <Stack gap={1} grow>
                      <Text variant="body" weight="semibold">{r.name}</Text>
                      <Text variant="micro" tone="subtle">asked — not answered yet</Text>
                    </Stack>
                    <Chip label="Cancel" onPress={() => void answer(r.userId, 'decline')} />
                  </Stack>
                ))}
              </Stack>
            ) : null}
          </Stack>
        ) : (
        <Stack gap={3}>
          {list.map((contact) => (
            <Stack
              key={contact.id}
              direction="row"
              gap={4}
              align="center"
              className="min-h-row rounded-lg border-2 border-line-hairline bg-raised px-4 py-3"
            >
              <View
                className="items-center justify-center rounded-pill"
                style={{ width: 40, height: 40, backgroundColor: contact.onBallast ? color.decor.mint : color.surface.sunken }}
              >
                <Text variant="footnote" weight="semibold">{contact.initials}</Text>
              </View>
              <Stack gap={1} grow>
                <Text variant="body" weight="semibold">{contact.name}</Text>
                <Text variant="micro" tone="subtle">
                  {contact.onBallast ? 'On Ballast' : 'Not on Ballast yet'}
                </Text>
              </Stack>
              {contact.onBallast ? (
                <Chip
                  label="Add"
                  tone="selected"
                  onPress={() => { tapFeedback(); addFriend(contact.id); successFeedback(); }}
                />
              ) : (
                <Chip
                  label="Invite"
                  onPress={() => { tapFeedback(); Linking.openURL(whatsapp(INVITE)); }}
                />
              )}
            </Stack>
          ))}
        </Stack>
        )}

        {/*
          The one thing a screen that touches an address book has to say, said
          where it is read rather than in a settings page nobody opens.
        */}
        <Text variant="micro" tone="subtle" className="text-center">🔒 Your contacts never leave your phone.</Text>

        <View className="h-2" />
      </Stack>
    </Screen>
  );
}
