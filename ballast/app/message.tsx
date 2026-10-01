import { useMemo, useState } from 'react';
import { Linking } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Card, PageHeader, Screen, Stack, Sticker, Text } from '@/components';
import { color } from '@design/tokens';
import { Composer } from '@/features/compose/Composer';
import { formatShort } from '@/lib/dates';
import { successFeedback } from '@/lib/haptics';
import { formatHour } from '@/lib/schedule';
import { whatsapp } from '@/lib/sharing';
import { useStore } from '@/state/store';
import type { ComposeContext } from '@shared/contract';

/**
 * `/message?kind=checkin&to=<friend>` or `/message?kind=invite&invite=<id>`.
 *
 * The same composer the decline screen uses, for the other two messages that
 * used to be one fixed sentence: checking on a friend, and asking people to the
 * plan you just found. A query string rather than a dynamic route, so the page
 * exists in the static export without listing every friend.
 */
export default function Message() {
  const router = useRouter();
  const params = useLocalSearchParams<{ kind?: string; to?: string; invite?: string }>();
  const { circle, invites, groups, markContacted, logMoment } = useStore();
  const [body, setBody] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const person = params.kind === 'checkin' ? circle.find((p) => p.id === params.to && !p.isYou) : undefined;
  const invite = params.kind === 'invite' ? invites.find((i) => i.id === params.invite) : undefined;
  const group = invite?.groupId ? groups.find((g) => g.id === invite.groupId) : undefined;

  const context = useMemo<ComposeContext | null>(() => {
    if (person) {
      return {
        kind: 'checkin',
        subject: `Checking in on ${person.name}`,
        to: person.name,
        theirCharge: person.charge,
        pressure: person.status ? `They posted: "${person.status}"` : undefined,
      };
    }
    if (invite) {
      const names = invite.people.map((id) => circle.find((p) => p.id === id)?.name ?? id);
      return {
        kind: 'invite',
        subject: invite.title.replace(/ with .*$/, ''),
        to: group ? group.name : names.join(' and '),
        when: `${formatShort(invite.date)}, ${formatHour(invite.startHour)}`,
      };
    }
    return null;
  }, [person, invite, group, circle]);

  if (!context) {
    return (
      <Screen back="/friends" backLabel="Friends">
        <Stack gap={4} className="pt-6">
          <PageHeader sticker="chat" wash={color.decor.sky} title="Write a message" sub="Pick a friend or a plan first." />
          <Button label="Back to your circle" onPress={() => router.replace('/friends')} />
        </Stack>
      </Screen>
    );
  }

  const phone = person?.phone;

  return (
    <Screen
      back="/friends"
      backLabel="Friends"
      footer={
        <>
          <Button
            label={sent ? 'Opened in WhatsApp' : 'Open in WhatsApp'}
            kind={body && !sent ? 'primary' : 'secondary'}
            disabled={!body}
            onPress={() => {
              if (!body) return;
              Linking.openURL(whatsapp(body, phone));
              if (person) {
                markContacted(person.id);
                logMoment('good-chat', 'social', 3);
              }
              successFeedback();
              setSent(true);
            }}
          />
          {body ? (
            <Button label="Copy it" kind="secondary" onPress={async () => { await Clipboard.setStringAsync(body); successFeedback(); }} />
          ) : null}
        </>
      }
    >
      <Stack gap={5} className="pt-2">
        <PageHeader
          sticker={person ? 'heart' : 'people'}
          wash={person ? color.decor.blush : color.decor.mint}
          eyebrow={person ? 'Check in' : 'Invite'}
          title={person ? `Message ${person.name}` : 'Ask them along'}
          sub="The app writes it. It never sends it."
        />
        {person ? (
          <Card tone="recovery" gap={2}>
            <Stack direction="row" gap={3} align="center">
              <Sticker name="battery" size={30} />
              <Text variant="footnote" tone="muted" className="flex-1">
                {person.name} is at {person.charge ?? '—'}%{person.status ? ` · “${person.status}”` : ''}
              </Text>
            </Stack>
          </Card>
        ) : null}
        <Composer context={context} onChange={setBody} />
      </Stack>
    </Screen>
  );
}
