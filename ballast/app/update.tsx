import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Mascot, PageHeader, Screen, Section, Stack, Text } from '@/components';
import { color } from '@design/tokens';
import { addDays, formatShort } from '@/lib/dates';
import { successFeedback, tapFeedback } from '@/lib/haptics';
import { useStore } from '@/state/store';
import { MarkSheet } from '@/features/marking/MarkSheet';
import { ToMarkRow } from '@/features/marking/ToMarkRow';
import { AutoMarkedRow } from '@/features/marking/AutoMarkedRow';
import { QuickCheckIn } from '@/features/checkin/QuickCheckIn';
import { useBells } from '@/features/notify/useBells';

/**
 * Quick update - everything waiting on you, on one page.
 *
 * Classes and tasks whose time has passed, what the app marked for you the
 * morning after, and today's check-in. Each one is a tap or two, and each
 * disappears from here (and from the number on Home) the moment it is done.
 */
export default function QuickUpdate() {
  const router = useRouter();
  const { today, markItem } = useStore();
  const { update } = useBells();
  const [marking, setMarking] = useState<string | null>(null);
  // Answered during this visit, the check-in stays put rather than vanishing mid-tap.
  const [showCheckIn] = useState(update.checkIn);
  const done = update.count === 0;

  return (
    <Screen
      back="/"
      backLabel="Home"
      footer={
        update.auto.length ? (
          <Button
            label={`Keep all ${update.auto.length} marked for you`}
            onPress={() => {
              update.auto.forEach((item) => markItem(item.id, item.outcome ?? 'done', item.fraction));
              successFeedback();
            }}
          />
        ) : (
          <Button label={done ? 'All caught up · Home' : 'Done'} kind={done ? 'primary' : 'secondary'} onPress={() => router.navigate('/')} />
        )
      }
    >
      <Stack gap={5} className="pt-2">
        <PageHeader
          sticker="clock"
          wash={color.decor.sky}
          eyebrow={done ? 'All caught up' : `${update.count} to update`}
          title="Quick update"
        />

        {done && !showCheckIn ? (
          <View className="items-center gap-2 rounded-xl px-5 py-6" style={{ backgroundColor: color.band.steady.wash }}>
            <Mascot charge={90} loadPercent={10} size={96} />
            <Text variant="heading">Nothing waiting on you</Text>
          </View>
        ) : null}

        {update.toMark.length ? (
          <Section family="week" title="To mark" sticker="clock" meta={`${update.toMark.length}`}>
            {update.toMark.map((item) => (
              <ToMarkRow key={item.id} item={item} today={today} onOpen={() => setMarking(item.id)} />
            ))}
          </Section>
        ) : null}

        {update.auto.length ? (
          <Section family="week" title="Marked for you" sticker="star" meta={`${update.auto.length}`}>
            {update.auto.map((item) => (
              <Stack key={item.id} gap={1}>
                <Text variant="micro" tone="subtle">{item.date === addDays(today, -1) ? 'YESTERDAY' : formatShort(item.date).toUpperCase()}</Text>
                <AutoMarkedRow
                  item={item}
                  today={today}
                  onKeep={() => { markItem(item.id, item.outcome ?? 'done', item.fraction); successFeedback(); }}
                  onMissed={() => { markItem(item.id, 'missed'); tapFeedback(); }}
                  onOpen={() => { tapFeedback(); setMarking(item.id); }}
                />
              </Stack>
            ))}
          </Section>
        ) : null}

        {showCheckIn ? (
          <Section
            family="you"
            title="Check in"
            sticker="sun"
            action={{ label: 'More ›', onPress: () => router.push('/checkin') }}
          >
            <QuickCheckIn />
          </Section>
        ) : null}

        <View className="h-2" />
      </Stack>
      <MarkSheet itemId={marking} onClose={() => setMarking(null)} />
    </Screen>
  );
}
