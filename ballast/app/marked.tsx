import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, MarkBadge, PageHeader, Screen, Section, Stack, Sticker, Text } from '@/components';
import { color } from '@design/tokens';
import { formatShort, addDays } from '@/lib/dates';
import { formatHour } from '@/lib/schedule';
import { KIND, autoMarkedIn, markKind, markStatus, outcomeWord } from '@/lib/marking';
import { successFeedback, tapFeedback } from '@/lib/haptics';
import { MarkSheet } from '@/features/marking/MarkSheet';
import { AutoMarkedRow } from '@/features/marking/AutoMarkedRow';
import { useStore } from '@/state/store';
import type { Item } from '@/lib/types';

/**
 * Marked for you — what the app assumed the morning after.
 *
 * Nobody answers every question, so anything left unanswered by the next day is
 * taken as done. That guess is only fair if it is easy to correct, so every one
 * of them is here: keep it, say it did not happen, or open it and say how much.
 */
export default function Marked() {
  const router = useRouter();
  const { items, today, markItem } = useStore();
  const [marking, setMarking] = useState<string | null>(null);
  const auto = autoMarkedIn(items);
  const days = [...new Set(auto.map((item) => item.date))];

  return (
    <Screen
      back="/"
      backLabel="Home"
      footer={
        auto.length ? (
          <Button
            label={`Keep all ${auto.length}`}
            onPress={() => {
              auto.forEach((item) => markItem(item.id, item.outcome ?? 'done', item.fraction));
              successFeedback();
              router.navigate('/');
            }}
          />
        ) : (
          <Button label="Back home" kind="secondary" onPress={() => router.navigate('/')} />
        )
      }
    >
      <Stack gap={5} className="pt-2">
        <PageHeader sticker="star" wash={color.decor.sky} eyebrow="The morning after" title="Marked for you" />

        {auto.length === 0 ? (
          <Stack gap={3} align="center" className="rounded-lg border-2 border-dashed border-line-hairline px-5 py-8">
            <Sticker name="star" size={48} />
            <Text variant="callout" tone="subtle" className="text-center">All checked.</Text>
          </Stack>
        ) : null}

        {days.map((date) => (
          <Section
            key={date}
            family="week"
            sticker="calendar"
            title={date === addDays(today, -1) ? 'Yesterday' : formatShort(date)}
            meta={`${auto.filter((item) => item.date === date).length}`}
          >
            {auto.filter((item) => item.date === date).map((item) => (
              <AutoMarkedRow
                key={item.id}
                item={item}
                today={today}
                onKeep={() => { markItem(item.id, item.outcome ?? 'done', item.fraction); successFeedback(); }}
                onMissed={() => { markItem(item.id, 'missed'); tapFeedback(); }}
                onOpen={() => { tapFeedback(); setMarking(item.id); }}
              />
            ))}
          </Section>
        ))}

        <View className="h-2" />
      </Stack>
      <MarkSheet itemId={marking} onClose={() => setMarking(null)} />
    </Screen>
  );
}
