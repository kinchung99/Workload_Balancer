import { View } from 'react-native';
import { Pressable } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Battery, Button, Card, PageHeader, Screen, Stack, Sticker, Text, type StickerName } from '@/components';
import { color } from '@design/tokens';
import { SCREEN } from '@design/screens';
import { bandFor } from '@/lib/load';
import { restOwedFrom, useStore } from '@/state/store';
import { useReading } from '@/state/selectors';
import { useItemsWithLogs } from '@/state/selectors';
import { prioritise } from '@/lib/priority';
import { tapFeedback } from '@/lib/haptics';

const TONE = { steady: 'steady', busy: 'busy', heavy: 'heavy' } as const;

/**
 * You — everything about your own week that is not today.
 *
 * Areas, Tonight, Recovery and the timetable were all tabs at one point, which
 * made a four-item bar carry seven destinations badly. They are one list here,
 * and the bar goes back to four things a student can name.
 */
export default function You() {
  const router = useRouter();
  const { recovery, reset } = useStore();
  const reading = useReading();
  const items = useItemsWithLogs();
  const { first } = prioritise(items, useStore.getState().today);
  const band = bandFor(reading.overall);
  const owed = restOwedFrom(recovery);

  const rows: Array<{ sticker: StickerName; wash: string; title: string; sub: string; to: Href }> = [
    { sticker: 'sun', wash: color.decor.lemon, title: 'Check in', sub: 'Mood, sleep, food, good things', to: '/checkin' },
    { sticker: 'battery', wash: color.decor.mint, title: 'Recovery', sub: `${owed}h owed`, to: '/recover' },
    { sticker: 'moon', wash: color.decor.sky, title: 'Tonight', sub: 'Plan an evening', to: '/tonight/night' },
    { sticker: 'class', wash: color.decor.lemon, title: 'Timetable', sub: 'Classes and flags', to: '/timetable' },
    { sticker: 'star', wash: color.decor.candy, title: 'What to do first', sub: `${first.length} ranked`, to: '/priority' },
  ];

  return (
    <Screen>
      <Stack gap={5} className="pt-2">
        <PageHeader {...SCREEN.you} eyebrow="Week 10" title="You" />

        <Card tone={band} gap={4}>
          <Stack direction="row" gap={5} align="center">
            <Battery
              charge={reading.charge}
              loadPercent={reading.overall}
              width={84}
              height={42}
              label={`${reading.charge} percent left`}
            />
            <Text variant="display" tone={TONE[band]}>{reading.charge}%</Text>
          </Stack>
        </Card>

        <Stack gap={3}>
          {rows.map((row) => (
            <Pressable
              key={row.title}
              accessibilityRole="button"
              accessibilityLabel={`${row.title}. ${row.sub}`}
              onPress={() => { tapFeedback(); router.push(row.to); }}
              className="min-h-row flex-row items-center gap-4 rounded-lg border-2 border-line-hairline bg-raised px-4 py-4 active:opacity-70"
            >
              <View className="items-center justify-center rounded-pill" style={{ width: 44, height: 44, backgroundColor: row.wash }}>
                <Sticker name={row.sticker} size={28} />
              </View>
              <Stack gap={1} grow>
                <Text variant="body" weight="semibold">{row.title}</Text>
                <Text variant="micro" tone="subtle">{row.sub}</Text>
              </Stack>
              <Text variant="heading" tone="subtle">›</Text>
            </Pressable>
          ))}
        </Stack>

        {/* A demo has to be resettable and the intro rewatchable. Nothing else. */}
        <Stack direction="row" gap={3}>
          <Button label="Replay intro" kind="quiet" onPress={() => router.push('/welcome')} className="flex-1" />
          <Button label="Reset" kind="quiet" onPress={() => { reset(); router.replace('/'); }} className="flex-1" />
        </Stack>

        <View className="h-4" />
      </Stack>
    </Screen>
  );
}
