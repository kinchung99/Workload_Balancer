import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Mascot, PageHeader, Screen, Stack, Sticker, Text, type StickerName } from '@/components';
import { color, radius } from '@design/tokens';
import { whenWord, type Bell } from '@/lib/notify';
import { answerFriend, answerGroup, answerPlan } from '@/lib/social';
import { successFeedback, tapFeedback } from '@/lib/haptics';
import { useStore } from '@/state/store';
import { useBells } from '@/features/notify/useBells';
import { noticeApi, popDue } from '@/hooks/usePopups';
import { useHydrated } from '@/hooks/useHydrated';

/**
 * Notifications - one list, read like a feed.
 *
 * Each one is a picture for what kind of thing it is (a friend, a group, a
 * plan, the calendar, a deadline) and a sentence for what happened. The three
 * that ask something - a friend request, a group, a plan - carry their two
 * answers right under the sentence; the rest open where they are dealt with.
 * What was new when the page opened stays tinted until you leave.
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
  const open = (bell: Bell) => { if (bell.to) { tapFeedback(); router.push(bell.to as Href); } };
  const answer = (bell: Bell, yes: boolean) => {
    void (bell.kind === 'group' ? answerGroup(bell.ref!, yes) : bell.kind === 'plan' ? answerPlan(bell.ref!, yes) : answerFriend(bell.ref!, yes));
    if (yes) successFeedback(); else tapFeedback();
  };

  return (
    <Screen back="/" backLabel="Home">
      <Stack gap={4} className="pt-2">
        <PageHeader sticker="bell" wash={color.decor.lemon} title="Notifications" />

        <PopupSwitch />

        {!list.length ? (
          <View className="items-center gap-2 rounded-xl px-5 py-6" style={{ backgroundColor: color.band.steady.wash }}>
            <Mascot charge={88} loadPercent={12} size={92} />
            <Text variant="heading">You’re all caught up</Text>
          </View>
        ) : (
          // One list, newest questions first: a picture for what it is, a sentence for what happened.
          <View className="overflow-hidden rounded-xl bg-raised" style={{ borderWidth: 1, borderColor: color.line.hairline }}>
            {list.map((bell, index) => (
              <Pressable
                key={bell.id}
                accessibilityRole={bell.to ? 'button' : undefined}
                accessibilityLabel={[bell.title, bell.body].filter(Boolean).join('. ')}
                disabled={!bell.to || asks(bell)}
                onPress={() => open(bell)}
                className="active:opacity-70"
                style={{
                  borderTopWidth: index ? 1 : 0, borderColor: color.line.hairline,
                  backgroundColor: fresh.has(bell.id) ? color.band.recovery.wash : 'transparent',
                }}
              >
                <Stack direction="row" gap={3} align="start" className="px-4 py-3">
                  <Picture bell={bell} />
                  <Stack gap={2} grow>
                    <Text variant="callout">
                      <Text variant="callout" weight="semibold">{bell.title}</Text>
                      {bell.body ? <Text variant="callout" tone="muted">{` · ${bell.body}`}</Text> : null}
                      {bell.kind !== 'plan' && whenWord(bell.at) ? <Text variant="callout" tone="subtle">{`  ${whenWord(bell.at)}`}</Text> : null}
                    </Text>
                    {asks(bell) ? (
                      <Stack direction="row" gap={2}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`${bell.kind === 'group' ? 'Join' : 'Accept'}: ${bell.title}`}
                          onPress={() => answer(bell, true)}
                          className="min-h-min items-center justify-center rounded-pill bg-steady-fill px-5 active:opacity-70"
                        >
                          <Text variant="caption" weight="bold" tone="inverse">{bell.kind === 'group' ? 'Join' : 'Accept'}</Text>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Decline: ${bell.title}`}
                          onPress={() => answer(bell, false)}
                          className="min-h-min items-center justify-center rounded-pill border border-line-hairline bg-sunken px-5 active:opacity-70"
                        >
                          <Text variant="caption" weight="bold">Decline</Text>
                        </Pressable>
                      </Stack>
                    ) : null}
                  </Stack>
                  {fresh.has(bell.id) ? <View style={{ width: 9, height: 9, marginTop: 6, borderRadius: radius.pill, backgroundColor: color.band.heavy.fill }} /> : null}
                </Stack>
              </Pressable>
            ))}
          </View>
        )}

        <View className="h-2" />
      </Stack>
    </Screen>
  );
}

/** One picture per kind of thing, so the list can be read by shape before words. */
const PICTURE: Record<Bell['kind'], { sticker: StickerName; wash: string }> = {
  friend:   { sticker: 'wave',       wash: color.decor.candy },
  group:    { sticker: 'people',     wash: color.decor.lilac },
  plan:     { sticker: 'heart',      wash: color.decor.blush },
  ready:    { sticker: 'star',       wash: color.band.steady.wash },
  update:   { sticker: 'clock',      wash: color.decor.sky },
  calendar: { sticker: 'calendar',   wash: color.decor.sky },
  due:      { sticker: 'assignment', wash: color.decor.lemon },
  wall:     { sticker: 'wall',       wash: color.band.heavy.wash },
  nudge:    { sticker: 'chat',       wash: color.decor.lilac },
  rest:     { sticker: 'leaf',       wash: color.decor.mint },
  low:      { sticker: 'battery',    wash: color.band.heavy.wash },
  event:    { sticker: 'sparkle',    wash: color.decor.cream },
};

/** What happened, by what the app stamped on it. */
function eventPicture(bell: Bell): { sticker: StickerName; wash: string } {
  if (bell.emoji === '📅') return PICTURE.calendar;
  if (bell.emoji === '✅' || bell.emoji === '❌') return PICTURE.plan;
  if (bell.emoji === '🎉') return PICTURE.friend;
  if (bell.to?.startsWith('/group')) return PICTURE.group;
  return PICTURE.event;
}

function Picture({ bell }: { bell: Bell }) {
  const { sticker, wash } = bell.kind === 'event' ? eventPicture(bell) : PICTURE[bell.kind];
  return (
    <View className="items-center justify-center rounded-pill" style={{ width: 44, height: 44, backgroundColor: wash }}>
      <Sticker name={sticker} size={28} />
    </View>
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
