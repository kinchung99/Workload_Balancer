import { Linking, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Button, Card, Chip, PageHeader, Screen, Stack, Sticker, Text,
} from '@/components';
import { color } from '@design/tokens';
import { SCREEN } from '@design/screens';
import { onBallastCount, suggestions, whatsapp } from '@/lib/sharing';
import { successFeedback, tapFeedback } from '@/lib/haptics';
import { useStore } from '@/state/store';

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
  const { circle, phoneContacts, addFriend } = useStore();

  const list = suggestions(phoneContacts);
  const here = onBallastCount(phoneContacts);
  // The circle itself, not the address-book flags: people can be in your circle
  // without being in your contacts, and counting the flags said "2" next to a
  // screen listing four friends.
  const added = circle.filter((person) => !person.isYou).length;

  return (
    <Screen
      back="/friends"
      backLabel="Friends"
      footer={<Button label="Done" onPress={() => router.replace('/friends')} />}
    >
      <Stack gap={5} className="pt-2">
        <PageHeader
          {...SCREEN.findFriends}
          eyebrow={`${added} in your circle`}
          title="Find your people"
        />

        {here ? (
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

        {/*
          The one thing a screen that touches an address book has to say, said
          where it is read rather than in a settings page nobody opens.
        */}
        <Card tone="sunken" gap={2}>
          <Stack direction="row" gap={3} align="center">
            <Sticker name="heart" size={30} />
            <Text variant="footnote" weight="semibold" className="flex-1">
              Matching happens on your phone.
            </Text>
          </Stack>
          <Text variant="micro" tone="muted">
            Your contacts are never uploaded. Nothing is posted, ever.
          </Text>
        </Card>

        <View className="h-2" />
      </Stack>
    </Screen>
  );
}
