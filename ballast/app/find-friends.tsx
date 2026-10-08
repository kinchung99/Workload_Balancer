import { useState } from 'react';
import { Linking, Platform, Pressable, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Button, Card, PageHeader, Screen, Section, Stack, Text } from '@/components';
import { color } from '@design/tokens';
import { SCREEN } from '@design/screens';
import { suggestions, whatsapp } from '@/lib/sharing';
import { answerFriend, sendFriendRequest } from '@/lib/social';
import { successFeedback, tapFeedback } from '@/lib/haptics';
import { useStore } from '@/state/store';
import type { PendingRequestDTO } from '@shared/contract';

const INVITE = 'I am using Ballast to keep my week from piling up. Want to be in my circle? ballast.app';

/**
 * Find your people - asked, never just added.
 *
 * You type an email (or, signed in, the six-letter code they read out) and a
 * request goes to them. They are in your circle only once they say yes; until
 * then they wait under "Waiting on them". Anyone who asked you waits under
 * "Waiting on you" with the two answers. Contacts already on Ballast can be
 * asked in one tap; everyone else gets an invitation to join, through WhatsApp.
 */
export default function FindFriends() {
  const router = useRouter();
  const { circle, phoneContacts, mode, requests, account } = useStore();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const live = mode === 'live';

  const typed = email.trim();
  const canAsk = /.+@.+\..+/.test(typed) || (live && typed.toUpperCase().replace(/[^A-Z0-9]/g, '').length === 6);
  const ask = async () => {
    if (!canAsk || busy) return;
    setBusy(true);
    const ok = await sendFriendRequest(typed);
    setBusy(false);
    if (ok) { setSent(typed); setEmail(''); successFeedback(); }
  };

  const incoming = requests.filter((r) => r.direction === 'incoming');
  const outgoing = requests.filter((r) => r.direction === 'outgoing');
  const asked = new Set(outgoing.map((r) => r.userId));
  // Anyone already asking you is answered above, not listed twice.
  const contacts = live ? [] : suggestions(phoneContacts).filter((contact) => !incoming.some((r) => r.userId === contact.id));
  const friends = circle.filter((person) => !person.isYou).length;

  return (
    <Screen
      back={from === 'setup' ? ('/setup/friends' as Href) : '/friends'}
      backLabel={from === 'setup' ? 'Setup' : 'Friends'}
      footer={<Button label="Done" onPress={() => router.replace(from === 'setup' ? ('/setup/friends' as Href) : '/friends')} />}
    >
      <Stack gap={5} className="pt-2">
        <PageHeader {...SCREEN.findFriends} eyebrow={`${friends} in your circle`} title="Find your people" />

        {/* Your own code, to read out across a table. */}
        {live && account ? (
          <Card tone="steady" gap={1} align="center">
            <Text variant="micro" tone="subtle">YOUR CODE</Text>
            <Text variant="hero" weight="bold" accessibilityLabel={`Your code is ${account.code.split('').join(' ')}`}>{account.code}</Text>
          </Card>
        ) : null}

        {/* Ask by email: a request, then a wait for their yes. */}
        <Card gap={3}>
          <Text variant="heading">✉️ Add by email</Text>
          <TextInput
            value={email}
            onChangeText={(next) => { setEmail(next); setSent(null); }}
            placeholder={live ? 'Their email, or their code' : 'friend@uni.edu'}
            placeholderTextColor={color.ink.subtle}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            accessibilityLabel="Their email"
            onSubmitEditing={() => void ask()}
            className="min-h-row rounded-pill border-2 border-line-hairline bg-sunken px-5 py-3 text-body text-ink-default"
            style={Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : undefined}
          />
          <Button
            label={busy ? 'Sending…' : 'Send request'}
            kind={canAsk && !busy ? 'primary' : 'secondary'}
            accessibilityState={{ disabled: !canAsk || busy }}
            onPress={() => void ask()}
          />
          {/* The same answer whether or not the address has an account, so this cannot be used to test addresses. */}
          {sent ? <Text variant="footnote" tone="steady" accessibilityLiveRegion="polite">✓ Sent to {sent} · waiting for a yes</Text> : null}
        </Card>

        {incoming.length ? (
          <Section family="people" title="Waiting on you" sticker="wave" meta={`${incoming.length}`}>
            {incoming.map((request) => (
              <RequestRow key={request.userId} request={request} below>
                <Pill label="✓ Accept" strong wide onPress={() => { void answerFriend(request.userId, true); successFeedback(); }} />
                <Pill label="Decline" wide onPress={() => { void answerFriend(request.userId, false); tapFeedback(); }} />
              </RequestRow>
            ))}
          </Section>
        ) : null}

        {outgoing.length ? (
          <Section family="people" title="Waiting on them" sticker="clock" meta={`${outgoing.length}`}>
            {outgoing.map((request) => (
              <RequestRow key={request.userId} request={request} sub="Asked · waiting for a yes">
                <Pill label="Cancel" onPress={() => { void answerFriend(request.userId, false); tapFeedback(); }} />
              </RequestRow>
            ))}
          </Section>
        ) : null}

        {/* Your address book: ask the ones already here, invite the rest. */}
        {contacts.length ? (
          <Section family="people" title="From your contacts" sticker="people" meta={`${contacts.length}`}>
            {contacts.map((contact) => (
              <Stack key={contact.id} direction="row" gap={3} align="center" className="min-h-row rounded-lg bg-raised px-4 py-3">
                <View className="items-center justify-center rounded-pill" style={{ width: 40, height: 40, backgroundColor: contact.onBallast ? color.decor.mint : color.surface.sunken }}>
                  <Text variant="footnote" weight="semibold">{contact.initials}</Text>
                </View>
                <Stack gap={0} grow>
                  <Text variant="body" weight="semibold">{contact.name}</Text>
                  <Text variant="micro" tone="subtle">{asked.has(contact.id) ? 'Asked · waiting' : contact.onBallast ? 'On Ballast' : 'Not on Ballast yet'}</Text>
                </Stack>
                {incoming.some((r) => r.userId === contact.id) ? (
                  <Pill label="✓ Accept" strong onPress={() => { void answerFriend(contact.id, true); successFeedback(); }} />
                ) : asked.has(contact.id) ? (
                  <Pill label="Asked" />
                ) : contact.onBallast ? (
                  <Pill label="Ask" strong onPress={() => { void sendFriendRequest(contact.name, contact.name, contact.id); successFeedback(); }} />
                ) : (
                  <Pill label="Invite" onPress={() => { tapFeedback(); Linking.openURL(whatsapp(INVITE)); }} />
                )}
              </Stack>
            ))}
          </Section>
        ) : null}

        <Text variant="micro" tone="subtle" className="text-center">🔒 Your contacts never leave your phone.</Text>
        <View className="h-2" />
      </Stack>
    </Screen>
  );
}

/** A person and their answer buttons - beside the name, or under it when there are two. */
function RequestRow({ request, sub, below = false, children }: { request: PendingRequestDTO; sub?: string; below?: boolean; children: React.ReactNode }) {
  const who = (
    <Stack direction="row" gap={3} align="center" grow>
      <View className="items-center justify-center rounded-pill" style={{ width: 40, height: 40, backgroundColor: color.decor.mint }}>
        <Text variant="footnote" weight="semibold">{request.initials}</Text>
      </View>
      <Stack gap={0} grow>
        <Text variant="body" weight="semibold" numberOfLines={1}>{request.name}</Text>
        <Text variant="micro" tone="subtle">{sub ?? 'Wants to be friends'}</Text>
      </Stack>
    </Stack>
  );
  return below ? (
    <Stack gap={3} className="rounded-lg bg-raised px-4 py-3">
      {who}
      <Stack direction="row" gap={2}>{children}</Stack>
    </Stack>
  ) : (
    <Stack direction="row" gap={3} align="center" className="min-h-row rounded-lg bg-raised px-4 py-3">
      {who}
      <Stack direction="row" gap={2}>{children}</Stack>
    </Stack>
  );
}

function Pill({ label, strong = false, wide = false, onPress }: { label: string; strong?: boolean; wide?: boolean; onPress?: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={!onPress}
      onPress={onPress}
      className={`min-h-min items-center justify-center rounded-pill px-4 active:opacity-70 ${wide ? 'flex-1 py-2' : ''} ${strong ? 'bg-inverse' : 'border-2 border-line-hairline bg-sunken'}`}
    >
      <Text variant="caption" weight="bold" tone={strong ? 'inverse' : onPress ? 'default' : 'subtle'}>{label}</Text>
    </Pressable>
  );
}
