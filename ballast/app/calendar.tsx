import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Burst, Button, Card, Chip, PageHeader, Screen, Section, Stack, Sticker, Text } from '@/components';
import { color } from '@design/tokens';
import { repeatOf, type Detected } from '@/lib/gcal';
import { whenWord } from '@/lib/notify';
import { chooseCalendars, connectCalendar, disconnectCalendar, refreshCalendar, syncCalendar } from '@/lib/calendar';
import { successFeedback, tapFeedback } from '@/lib/haptics';
import { useStore } from '@/state/store';
import { useCalendar } from '@/features/calendar/useCalendar';
import { CalendarDot, EventCard, KIND_STICKER, KIND_WASH } from '@/features/calendar/EventCard';

/**
 * Google Calendar - what it has coming up, and what to do with each.
 *
 * Not connected: one card, one button. Connected: the new events first, each
 * a tap from being set up (the details are filled in; you say what only you
 * know), then what is already in your week, then what you skipped.
 */
export default function CalendarPage() {
  const router = useRouter();
  const params = useLocalSearchParams<{ calendar?: string }>();
  const { calendar, picture, expired } = useCalendar();
  const live = useStore((state) => state.mode === 'live' && !!state.account);
  const available = useStore((state) => state.calendarAvailable);
  const skip = useStore((state) => state.skipCalendar);
  const unskip = useStore((state) => state.unskipCalendar);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const [leaving, setLeaving] = useState(false);
  // The burst is a moment, not a fixture.
  useEffect(() => {
    if (!celebrate) return;
    const done = setTimeout(() => setCelebrate(false), 1600);
    return () => clearTimeout(done);
  }, [celebrate]);

  // Back from Google: read straight away, once the session is back.
  useEffect(() => {
    if (params.calendar === 'connected') {
      setCelebrate(true);
      if (live) void refreshCalendar().then(() => syncCalendar());
    } else if (params.calendar === 'cancelled') setProblem('Not connected. Try again any time.');
    else if (params.calendar === 'failed') setProblem('Google didn’t finish connecting. Try again.');
  }, [params.calendar, live]);

  const connect = async () => {
    tapFeedback();
    setBusy(true);
    setProblem(null);
    const result = await connectCalendar();
    setBusy(false);
    if (result === 'unavailable') setProblem('Google Calendar isn’t switched on for this app yet.');
    else if (result === 'offline') setProblem('Couldn’t reach Ballast. Check your connection.');
    else if (!live) { successFeedback(); setCelebrate(true); }
  };

  const sync = async () => {
    tapFeedback();
    setSyncing(true);
    await syncCalendar();
    setSyncing(false);
  };

  const open = (detected: Detected) => { tapFeedback(); router.push(`/calendar/setup?key=${encodeURIComponent(detected.key)}` as Href); };
  const inWeek = [...picture.added, ...picture.there];

  return (
    <Screen back="/" backLabel="Home">
      <Stack gap={5} className="pt-2">
        <PageHeader sticker="calendar" wash={color.decor.sky} eyebrow="Google Calendar" title={calendar ? 'Your calendar' : 'Bring it in'} />
        {celebrate ? <Burst show label="Connected" /> : null}

        {problem ? (
          <View className="rounded-lg bg-heavy-wash px-4 py-3">
            <Text variant="callout" weight="semibold" tone="heavy">{problem}</Text>
          </View>
        ) : null}

        {!calendar ? (
          <Hero busy={busy} disabled={live && !available} sample={!live} onConnect={() => void connect()} />
        ) : (
          <>
            {/* Which account, how fresh, and a refresh. */}
            <Stack direction="row" gap={3} align="center" className="rounded-xl border-2 border-line-hairline bg-raised px-4 py-3">
              <View className="items-center justify-center rounded-pill" style={{ width: 40, height: 40, backgroundColor: color.decor.sky }}>
                <Text variant="heading" weight="bold">G</Text>
              </View>
              <Stack gap={0} grow>
                <Text variant="body" weight="semibold" numberOfLines={1}>{calendar.email ?? 'Google Calendar'}</Text>
                <Text variant="micro" tone={expired ? 'heavy' : 'subtle'}>
                  {expired ? 'Disconnected by Google' : `Synced ${syncedWord(calendar.lastSyncedAt)}${calendar.via === 'sample' ? ' · sample' : ''}`}
                </Text>
              </Stack>
              {!expired ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Sync now"
                  onPress={() => void sync()}
                  className="min-h-min items-center justify-center rounded-pill border-2 border-line-hairline bg-sunken px-4 active:opacity-70"
                >
                  <Text variant="caption" weight="bold">{syncing ? '…' : '↻ Sync'}</Text>
                </Pressable>
              ) : null}
            </Stack>

            {expired ? (
              <Stack gap={3} className="rounded-xl bg-heavy-wash px-4 py-4">
                <Text variant="heading" tone="heavy">🔌 Reconnect to keep it in step</Text>
                <Button label={busy ? 'Opening Google…' : 'Reconnect Google Calendar'} onPress={() => void connect()} />
              </Stack>
            ) : null}

            {/* Which calendars: tap one off and its events go. */}
            {calendar.calendars.length > 1 ? (
              <Stack direction="row" gap={2} wrap>
                {calendar.calendars.map((cal) => (
                  <Pressable
                    key={cal.id}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: cal.on }}
                    accessibilityLabel={cal.name}
                    onPress={() => {
                      tapFeedback();
                      const on = calendar.calendars.filter((c) => (c.id === cal.id ? !c.on : c.on)).map((c) => c.id);
                      void chooseCalendars(on);
                    }}
                    className="min-h-min flex-row items-center gap-2 rounded-pill border-2 px-3 active:opacity-70"
                    style={{ borderColor: cal.on ? color.surface.inverse : color.line.hairline, backgroundColor: cal.on ? color.surface.raised : color.surface.sunken, opacity: cal.on ? 1 : 0.6 }}
                  >
                    <CalendarDot tint={cal.color} />
                    <Text variant="caption" weight="semibold">{cal.name}</Text>
                    <Text variant="caption" weight="bold">{cal.on ? '✓' : '＋'}</Text>
                  </Pressable>
                ))}
              </Stack>
            ) : null}

            {picture.fresh.length ? (
              <Section
                family="week"
                title="New"
                sticker="sparkle"
                meta={`${picture.fresh.length}`}
                action={{ label: 'Skip all', onPress: () => { tapFeedback(); skip(picture.fresh.map((d) => d.key)); } }}
              >
                {picture.fresh.map((detected) => (
                  <EventCard key={detected.key} detected={detected}>
                    <Stack direction="row" gap={2}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Set up ${detected.title}`}
                        onPress={() => open(detected)}
                        className="min-h-min flex-[2] items-center justify-center rounded-pill bg-inverse py-2 active:opacity-70"
                      >
                        <Text variant="caption" weight="bold" tone="inverse">
                          {detected.events.length > 1 ? `Set up all ${detected.events.length} ›` : 'Set up ›'}
                        </Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Skip ${detected.title}`}
                        onPress={() => { tapFeedback(); skip([detected.key]); }}
                        className="min-h-min flex-1 items-center justify-center rounded-pill border-2 border-line-hairline bg-sunken py-2 active:opacity-70"
                      >
                        <Text variant="caption" weight="bold">Skip</Text>
                      </Pressable>
                    </Stack>
                  </EventCard>
                ))}
              </Section>
            ) : !expired ? (
              <Card tone="steady" gap={2} align="center">
                <Sticker name="star" size={44} wiggle />
                <Text variant="heading">Nothing new</Text>
              </Card>
            ) : null}

            {inWeek.length ? (
              <Section family="rest" title="In your week" sticker="calendar" meta={`${inWeek.length}`}>
                {inWeek.map((detected) => (
                  <MiniRow key={detected.key} detected={detected} tag={picture.added.includes(detected) ? '🔁 Follows Google' : '✓ Already there'} />
                ))}
              </Section>
            ) : null}

            {picture.skipped.length ? (
              <Section family="you" title="Skipped" sticker="cloud" meta={`${picture.skipped.length}`}>
                {picture.skipped.map((detected) => (
                  <MiniRow key={detected.key} detected={detected} dim action={{ label: 'Bring back', onPress: () => { tapFeedback(); unskip(detected.key); } }} />
                ))}
              </Section>
            ) : null}

            {leaving ? (
              <Stack gap={2} className="rounded-xl bg-heavy-wash px-4 py-4">
                <Text variant="callout" weight="semibold" tone="heavy">Disconnect Google Calendar?</Text>
                <Text variant="micro" tone="muted">What you set up stays in your week.</Text>
                <Stack direction="row" gap={2}>
                  <Button label="Keep it" kind="secondary" className="flex-1" onPress={() => { tapFeedback(); setLeaving(false); }} />
                  <Button label="Disconnect" className="flex-1" onPress={() => { void disconnectCalendar(); setLeaving(false); setCelebrate(false); successFeedback(); }} />
                </Stack>
              </Stack>
            ) : (
              <Pressable accessibilityRole="button" onPress={() => { tapFeedback(); setLeaving(true); }} className="min-h-min items-center justify-center active:opacity-60">
                <Text variant="caption" weight="semibold" tone="subtle">Disconnect</Text>
              </Pressable>
            )}
          </>
        )}

        <View className="h-2" />
      </Stack>
    </Screen>
  );
}

/** "just now", "5m ago", "yesterday". */
function syncedWord(at: string | null): string {
  const word = whenWord(at ?? undefined);
  return !word || word === 'Just now' || word === 'Yesterday' ? (word || 'just now').toLowerCase() : word;
}

/** Not connected yet: what it does, in three lines and a picture. */
function Hero({ busy, disabled, sample, onConnect }: { busy: boolean; disabled: boolean; sample: boolean; onConnect: () => void }) {
  const fan: Array<{ sticker: 'class' | 'assignment' | 'shift'; title: string; when: string; tint: string; wash: string; tilt: string }> = [
    { sticker: 'class', title: 'Mandarin class', when: 'Tue · 6:30pm', tint: color.decor.sky, wash: KIND_WASH.class, tilt: '-4deg' },
    { sticker: 'assignment', title: 'Essay due', when: 'Fri · all day', tint: color.decor.blush, wash: KIND_WASH.assignment, tilt: '2deg' },
    { sticker: 'shift', title: 'Café shift', when: 'Sat · 10am', tint: color.decor.lilac, wash: KIND_WASH.shift, tilt: '-1deg' },
  ];
  return (
    <Stack gap={5} className="rounded-xl px-5 py-6" style={{ backgroundColor: color.decor.cream, borderWidth: 2, borderColor: color.line.hairline }}>
      {/* A few events, fanned like cards, on their way into your week. */}
      <Stack gap={2} align="center">
        {fan.map((pill) => (
          <View
            key={pill.title}
            className="flex-row items-center gap-3 overflow-hidden rounded-lg bg-raised pr-4"
            style={{ width: '82%', borderWidth: 2, borderColor: color.line.hairline, transform: [{ rotate: pill.tilt }] }}
          >
            <View style={{ width: 6, alignSelf: 'stretch', backgroundColor: pill.tint }} />
            <View className="my-2 items-center justify-center rounded-md" style={{ width: 36, height: 36, backgroundColor: pill.wash }}>
              <Sticker name={pill.sticker} size={24} />
            </View>
            <Stack gap={0} grow>
              <Text variant="callout" weight="semibold">{pill.title}</Text>
              <Text variant="micro" tone="subtle">{pill.when}</Text>
            </Stack>
            <Text variant="caption" weight="bold" tone="steady">✨</Text>
          </View>
        ))}
      </Stack>

      <Stack gap={2}>
        {[
          ['🔒', 'Read-only. Your calendar never changes.'],
          ['✨', 'Details filled in. You say how draining.'],
          ['🔁', 'Weekly classes set up once.'],
        ].map(([emoji, line]) => (
          <Stack key={line} direction="row" gap={3} align="center">
            <Text variant="heading">{emoji}</Text>
            <Text variant="callout" weight="semibold" className="flex-1">{line}</Text>
          </Stack>
        ))}
      </Stack>

      <Button
        label={disabled ? 'Not switched on yet' : busy ? 'Opening Google…' : 'Connect Google Calendar'}
        kind={disabled ? 'secondary' : 'primary'}
        accessibilityState={{ disabled: disabled || busy }}
        onPress={() => { if (!disabled && !busy) onConnect(); }}
      />
      {sample ? <Text variant="micro" tone="subtle" className="text-center">The demo connects a sample calendar.</Text> : null}
    </Stack>
  );
}

function MiniRow({ detected, tag, dim = false, action }: { detected: Detected; tag?: string; dim?: boolean; action?: { label: string; onPress: () => void } }) {
  const repeat = repeatOf(detected.repeat);
  return (
    <Stack direction="row" gap={3} align="center" className="rounded-lg bg-raised px-4 py-3" style={{ opacity: dim ? 0.7 : 1 }}>
      <View className="items-center justify-center rounded-md" style={{ width: 36, height: 36, backgroundColor: KIND_WASH[detected.guess.kind] }}>
        <Sticker name={KIND_STICKER[detected.guess.kind]} size={24} />
      </View>
      <Stack gap={0} grow>
        <Text variant="body" weight="semibold" numberOfLines={1}>{detected.title}</Text>
        <Text variant="micro" tone="subtle" numberOfLines={1}>{[repeat, tag].filter(Boolean).join(' · ')}</Text>
      </Stack>
      {action ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`${action.label}: ${detected.title}`} onPress={action.onPress} className="min-h-min items-center justify-center rounded-pill border-2 border-line-hairline bg-sunken px-3 active:opacity-70">
          <Text variant="caption" weight="bold">{action.label}</Text>
        </Pressable>
      ) : null}
    </Stack>
  );
}
