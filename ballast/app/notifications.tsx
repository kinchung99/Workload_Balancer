import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Mascot, PageHeader, Screen, Section, Stack, Text } from '@/components';
import { color, radius } from '@design/tokens';
import { whenWord, type Bell } from '@/lib/notify';
import { answerFriend, answerGroup, answerPlan } from '@/lib/social';
import { successFeedback, tapFeedback } from '@/lib/haptics';
import { useStore } from '@/state/store';
import { useBells } from '@/features/notify/useBells';
import { noticeApi, popDue } from '@/hooks/usePopups';
import { useHydrated } from '@/hooks/useHydrated';

/**
 * Notifications - what needs an answer, what matters today, what happened.
 *
 * Questions first, answered right here: a friend request, a group invitation.
 * Then today's things worth knowing, each a tap from where it is dealt with.
 * Then the activity - who said yes, who joined. What was new when you opened
 * the page keeps its dot until you leave.
 */
export default function Notifications() {
  const router = useRouter();
  const { list } = useBells();
  const seeNotices = useStore((state) => state.seeNotices);
  const hydrated = useHydrated();
  // What you had seen when the page opened - read once the saved state is in,
  // so the dots stay on what was new while you read.
  const [seenBefore, setSeenBefore] = useState<Set<string> | null>(null);
  useEffect(() => {
    if (hydrated && !seenBefore) setSeenBefore(new Set(useStore.getState().seenNotices));
  }, [hydrated, seenBefore]);
  useEffect(() => {
    if (!seenBefore) return;
    const later = setTimeout(() => seeNotices(list.map((bell) => bell.id)), 600);
    return () => clearTimeout(later);
  }, [list, seeNotices, seenBefore]);
  const fresh = { has: (id: string) => !!seenBefore && !seenBefore.has(id) };

  const asks = (bell: Bell) => bell.kind === 'friend' || bell.kind === 'group' || bell.kind === 'plan';
  const questions = list.filter(asks);
  const today = list.filter((bell) => !asks(bell) && bell.kind !== 'event');
  const history = list.filter((bell) => bell.kind === 'event');
  const open = (bell: Bell) => { if (bell.to) { tapFeedback(); router.push(bell.to as Href); } };

  return (
    <Screen back="/" backLabel="Home">
      <Stack gap={5} className="pt-2">
        <PageHeader sticker="bell" wash={color.decor.lemon} title="Notifications" />

        <PopupSwitch />

        {!list.length ? (
          <View className="items-center gap-2 rounded-xl px-5 py-6" style={{ backgroundColor: color.band.steady.wash }}>
            <Mascot charge={88} loadPercent={12} size={92} />
            <Text variant="heading">You’re all caught up</Text>
          </View>
        ) : null}

        {questions.length ? (
          <Section family="people" title="Needs an answer" sticker="wave" meta={`${questions.length}`}>
            {questions.map((bell) => (
              <Stack key={bell.id} gap={3} className="rounded-lg bg-raised px-4 py-3">
                <Row bell={bell} fresh={fresh.has(bell.id)} />
                <Stack direction="row" gap={2}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${bell.kind === 'group' ? 'Join' : 'Accept'}: ${bell.title}`}
                    onPress={() => {
                      void (bell.kind === 'group' ? answerGroup(bell.ref!, true) : bell.kind === 'plan' ? answerPlan(bell.ref!, true) : answerFriend(bell.ref!, true));
                      successFeedback();
                    }}
                    className="min-h-min flex-1 items-center justify-center rounded-pill bg-steady-fill py-2 active:opacity-70"
                  >
                    <Text variant="caption" weight="bold" tone="inverse">{bell.kind === 'group' ? '✓ Join' : '✓ Accept'}</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Decline: ${bell.title}`}
                    onPress={() => {
                      void (bell.kind === 'group' ? answerGroup(bell.ref!, false) : bell.kind === 'plan' ? answerPlan(bell.ref!, false) : answerFriend(bell.ref!, false));
                      tapFeedback();
                    }}
                    className="min-h-min flex-1 items-center justify-center rounded-pill border-2 border-line-hairline bg-sunken py-2 active:opacity-70"
                  >
                    <Text variant="caption" weight="bold">Decline</Text>
                  </Pressable>
                </Stack>
              </Stack>
            ))}
          </Section>
        ) : null}

        {today.length ? (
          <Section family="focus" title="Today" sticker="clock">
            {today.map((bell) => (
              <Pressable key={bell.id} accessibilityRole="button" accessibilityLabel={bell.title} onPress={() => open(bell)} className="rounded-lg bg-raised px-4 py-3 active:opacity-70">
                <Row bell={bell} fresh={fresh.has(bell.id)} chevron />
              </Pressable>
            ))}
          </Section>
        ) : null}

        {history.length ? (
          <Section family="week" title="Activity" sticker="calendar">
            {history.map((bell) => (
              <Pressable key={bell.id} accessibilityRole="button" accessibilityLabel={bell.title} onPress={() => open(bell)} className="rounded-lg bg-raised px-4 py-3 active:opacity-70">
                <Row bell={bell} fresh={fresh.has(bell.id)} chevron={!!bell.to} />
              </Pressable>
            ))}
          </Section>
        ) : null}

        <View className="h-2" />
      </Stack>
    </Screen>
  );
}

function Row({ bell, fresh, chevron = false }: { bell: Bell; fresh: boolean; chevron?: boolean }) {
  // A plan already says when it is; when it was sent would be a second date.
  const when = bell.kind === 'plan' ? '' : whenWord(bell.at);
  return (
    <Stack direction="row" gap={3} align="center">
      <View className="items-center justify-center rounded-pill bg-sunken" style={{ width: 42, height: 42 }}>
        <Text variant="heading">{bell.emoji}</Text>
      </View>
      <Stack gap={0} grow>
        <Text variant="body" weight="semibold" numberOfLines={2}>{bell.title}</Text>
        {bell.body || when ? (
          <Text variant="micro" tone="subtle" numberOfLines={1}>{[bell.body, when].filter(Boolean).join(' · ')}</Text>
        ) : null}
      </Stack>
      {fresh ? <View style={{ width: 10, height: 10, borderRadius: radius.pill, backgroundColor: color.band.heavy.fill }} /> : null}
      {chevron ? <Text variant="heading" tone="subtle">›</Text> : null}
    </Stack>
  );
}

/** Pop-ups outside the app, for classes and tasks to mark. Web only, and only once allowed. */
function PopupSwitch() {
  const [permission, setPermission] = useState<'none' | 'default' | 'granted' | 'denied'>('none');
  useEffect(() => { setPermission(noticeApi()?.permission ?? 'none'); }, []);
  if (permission === 'none') return null;
  const on = permission === 'granted';
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel="Pop-ups for classes and tasks"
      disabled={on || permission === 'denied'}
      onPress={async () => {
        tapFeedback();
        const answer = await noticeApi()!.requestPermission();
        setPermission(answer);
        if (answer === 'granted') popDue(true);
      }}
      className="flex-row items-center gap-3 rounded-lg border-2 px-4 py-3 active:opacity-70"
      style={{ borderColor: on ? color.band.steady.fill : color.line.hairline, backgroundColor: on ? color.band.steady.wash : color.surface.raised }}
    >
      <Text variant="heading">🔔</Text>
      <Stack gap={0} grow>
        <Text variant="body" weight="semibold">Pop-ups for classes and tasks</Text>
        <Text variant="micro" tone="subtle">{on ? 'On · when one needs marking' : permission === 'denied' ? 'Blocked in your browser settings' : 'Off'}</Text>
      </Stack>
      <View className="rounded-pill px-3 py-1" style={{ backgroundColor: on ? color.band.steady.fill : color.surface.inverse }}>
        <Text variant="caption" weight="bold" tone="inverse">{on ? 'On' : 'Turn on'}</Text>
      </View>
    </Pressable>
  );
}
