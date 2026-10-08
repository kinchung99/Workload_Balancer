import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button, PageHeader, Screen, Stack, Sticker, Text } from '@/components';
import { color } from '@design/tokens';
import { tapFeedback } from '@/lib/haptics';
import { useStore } from '@/state/store';
import { ReceivedPlanCard, SentPlanCard } from '@/features/social/PlanCards';

/**
 * Plans - the invitations you were sent, and the ones you sent.
 *
 * Two tabs, one card each. Received: who asked, who else is going, how full
 * that day already is, and yes or no. Sent: who has said yes or no, and
 * putting it in your week - or calling it off.
 */
export default function Plans() {
  const router = useRouter();
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const { invites, received } = useStore();
  const [showing, setShowing] = useState<'received' | 'sent'>(tab === 'sent' ? 'sent' : 'received');
  const fresh = received.filter((invite) => !invite.answer).length;
  // Unanswered first, then by day.
  const sortedReceived = [...received].sort((a, b) => Number(!!a.answer) - Number(!!b.answer) || a.date.localeCompare(b.date));
  const sortedSent = [...invites].sort((a, b) => a.date.localeCompare(b.date) || a.startHour - b.startHour);
  const list = showing === 'received' ? sortedReceived : sortedSent;

  return (
    <Screen back="/friends" backLabel="Friends" footer={<Button label="✨ Plan something" onPress={() => router.push('/plan-together')} />}>
      <Stack gap={5} className="pt-2">
        <PageHeader sticker="heart" wash={color.decor.candy} eyebrow="Friends" title="Plans" />

        {/* Received, or sent: one tap between them, each with its count. */}
        <Stack direction="row" gap={0} className="rounded-pill border-2 border-line-strong bg-sunken p-1">
          {([
            ['received', `📥 Received${fresh ? ` · ${fresh}` : ''}`],
            ['sent', `📤 Sent${invites.length ? ` · ${invites.length}` : ''}`],
          ] as const).map(([key, label]) => (
            <Pressable
              key={key}
              accessibilityRole="tab"
              accessibilityState={{ selected: showing === key }}
              accessibilityLabel={label}
              onPress={() => { tapFeedback(); setShowing(key); }}
              className={`min-h-min flex-1 items-center justify-center rounded-pill py-3 active:opacity-70 ${showing === key ? 'bg-inverse' : ''}`}
            >
              <Text variant="caption" weight="bold" tone={showing === key ? 'inverse' : 'muted'}>{label}</Text>
            </Pressable>
          ))}
        </Stack>

        {list.length === 0 ? (
          <Stack gap={2} align="center" className="rounded-xl border-2 border-dashed border-line-hairline px-5 py-8">
            <Sticker name={showing === 'received' ? 'wave' : 'heart'} size={48} />
            <Text variant="callout" tone="subtle">{showing === 'received' ? 'No invitations yet' : 'Nothing sent yet'}</Text>
          </Stack>
        ) : showing === 'received' ? (
          sortedReceived.map((invite) => <ReceivedPlanCard key={invite.id} invite={invite} />)
        ) : (
          sortedSent.map((invite) => <SentPlanCard key={invite.id} invite={invite} />)
        )}

        <View className="h-2" />
      </Stack>
    </Screen>
  );
}
