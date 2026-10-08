import { Pressable, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import {
  Button, Card, CostChip, Disclosure, MOOD_WORD, Mascot, PageHeader, Screen, Section, Stack, Text, moodFor,
} from '@/components';
import { color, radius } from '@design/tokens';
import { bandFor, capacityOf } from '@/lib/load';
import { SPEND, batteryWord, breakdown, spendKey, type SpendLine } from '@/lib/breakdown';
import { clockHour } from '@/lib/marking';
import { formatShort } from '@/lib/dates';
import { tapFeedback } from '@/lib/haptics';
import { useStore } from '@/state/store';
import { useReading } from '@/state/selectors';
import { BatterySplit } from '@/features/battery/BatterySplit';

const TONE = { steady: 'steady', busy: 'busy', heavy: 'heavy' } as const;

/**
 * Your battery - where this week's goes, as a list that adds up.
 *
 * A start of a hundred, a line for each kind of thing that spends it or gives
 * it back, and what is left. Each line's bar is split into what has already
 * happened and what is still to come. Below that, the three single things that
 * cost the most, and - folded - the one rule behind every number.
 */
export default function Battery() {
  const router = useRouter();
  const { ceilings, today } = useStore();
  const reading = useReading();
  const band = bandFor(reading.overall);
  const split = breakdown(reading.week, ceilings, today, clockHour(today));
  const widest = Math.max(1, ...split.lines.map((line) => Math.abs(line.percent)));
  const capacity = capacityOf(ceilings);
  const example = Math.max(1, Math.round((4 * 3 / capacity) * 100));

  return (
    <Screen back="/" backLabel="Home" footer={<Button label="⚡ Recharge" onPress={() => router.push('/checkin')} />}>
      <Stack gap={5} className="pt-2">
        <PageHeader sticker="battery" wash={color.decor.mint} eyebrow="This week · Mon to Sun" title="Your battery" />

        {/* How much is left, and how the rest splits: gone, booked, yours. */}
        <Card tone={band} gap={4}>
          <Stack direction="row" gap={4} align="center">
            <Mascot charge={reading.charge} loadPercent={reading.overall} size={92} />
            <Stack gap={0} grow>
              <Text variant="hero" tone={TONE[band]}>{reading.charge}%</Text>
              <Text variant="heading">{MOOD_WORD[moodFor(reading.charge)]}</Text>
            </Stack>
          </Stack>
          <BatterySplit spent={split.spent} ahead={split.ahead} left={split.left} back={split.back} />
        </Card>

        {/* The sum, line by line. */}
        <Section family="focus" title="Where it goes" sticker="scales">
          <View className="overflow-hidden rounded-lg bg-raised">
            <Total emoji="🔋" label="Start of the week" value="100%" />
            {split.lines.map((line) => <Line key={line.key} line={line} widest={widest} />)}
            <Total emoji="🟢" label="Left" value={`${split.left}%`} strong />
          </View>
          <Stack direction="row" gap={4}>
            <Key fill={color.ink.default} word="Done" />
            <Key fill={color.band.busy.fill} word="To come" />
            {split.back ? <Key fill={color.band.steady.fill} word="Gives back" /> : null}
          </Stack>
        </Section>

        {split.top.length ? (
          <Section family="week" title="Biggest drains" sticker="clock">
            {split.top.map(({ item, percent }) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={`${item.title}, ${formatShort(item.date)}, uses ${Math.round(percent)} percent`}
                onPress={() => { tapFeedback(); router.push(`/item/${item.parentId ?? item.id}` as Href); }}
                className="flex-row items-center gap-3 rounded-lg bg-raised px-4 py-3 active:opacity-70"
              >
                <Text variant="title">{SPEND[spendKey(item)].emoji}</Text>
                <Stack gap={0} grow>
                  <Text variant="body" weight="semibold" numberOfLines={1}>{item.title}</Text>
                  <Text variant="micro" tone="subtle">{item.spread ? 'Across the week' : formatShort(item.date)} · {item.hours}h</Text>
                </Stack>
                <CostChip percent={percent} />
              </Pressable>
            ))}
          </Section>
        ) : null}

        {/* The one rule behind every number, for anyone who wants it. */}
        <Disclosure lead="💡" title="How it’s counted" summary="Hours × how draining">
          <Stack gap={3}>
            <Rule emoji="⏱️" text="Hours × how draining = what it costs" sub={`4h of Tiring ≈ −${example}%`} />
            <Rule emoji="📅" text="Your whole week = 100%" sub="It refills every Monday" />
            <Rule emoji="😴" text="Sleep, food and mood move it either way" />
            <Rule emoji="🌿" text="Rest and good moments give some back" />
          </Stack>
        </Disclosure>

        <View className="h-2" />
      </Stack>
    </Screen>
  );
}

function Line({ line, widest }: { line: SpendLine; widest: number }) {
  const info = SPEND[line.key];
  const gives = line.percent < 0;
  const width = (Math.abs(line.percent) / widest) * 100;
  const spentShare = line.percent ? Math.max(0, Math.min(1, line.spent / (line.spent + line.ahead || 1))) : 0;
  return (
    <Stack direction="row" gap={3} align="center" className="border-t border-line-hairline px-4 py-3">
      <View
        className="items-center justify-center rounded-pill"
        style={{ width: 38, height: 38, backgroundColor: gives ? color.band.steady.wash : color.surface.sunken }}
      >
        <Text variant="callout">{info.emoji}</Text>
      </View>
      <Stack gap={1} grow>
        <Text variant="body" weight="semibold">{info.label}</Text>
        <View className="h-2 w-full overflow-hidden rounded-pill bg-track">
          {gives ? (
            <View style={{ width: `${width}%`, height: '100%', backgroundColor: color.band.steady.fill }} />
          ) : (
            <View className="flex-row" style={{ width: `${width}%`, height: '100%' }}>
              <View style={{ flexGrow: spentShare, backgroundColor: color.ink.default }} />
              <View style={{ flexGrow: 1 - spentShare, backgroundColor: color.band.busy.fill }} />
            </View>
          )}
        </View>
      </Stack>
      <Text variant="heading" tone={gives ? 'steady' : 'default'} style={{ minWidth: 52, textAlign: 'right' }}>
        {batteryWord(line.percent)}
      </Text>
    </Stack>
  );
}

function Total({ emoji, label, value, strong = false }: { emoji: string; label: string; value: string; strong?: boolean }) {
  return (
    <Stack
      direction="row"
      gap={3}
      align="center"
      className={`px-4 py-3 ${strong ? 'border-t-2 border-line-strong' : ''}`}
      style={strong ? { backgroundColor: color.band.steady.wash } : undefined}
    >
      <View className="items-center justify-center rounded-pill bg-sunken" style={{ width: 38, height: 38 }}>
        <Text variant="callout">{emoji}</Text>
      </View>
      <Text variant="body" weight={strong ? 'bold' : 'semibold'} className="flex-1">{label}</Text>
      <Text variant={strong ? 'title' : 'heading'} tone={strong ? 'steady' : 'default'}>{value}</Text>
    </Stack>
  );
}

function Key({ fill, word }: { fill: string; word: string }) {
  return (
    <Stack direction="row" gap={1} align="center">
      <View style={{ width: 10, height: 10, borderRadius: radius.pill, backgroundColor: fill }} />
      <Text variant="micro" tone="muted">{word}</Text>
    </Stack>
  );
}

function Rule({ emoji, text, sub }: { emoji: string; text: string; sub?: string }) {
  return (
    <Stack direction="row" gap={3} align="center">
      <Text variant="title">{emoji}</Text>
      <Stack gap={0} grow>
        <Text variant="body" weight="semibold">{text}</Text>
        {sub ? <Text variant="micro" tone="muted">{sub}</Text> : null}
      </Stack>
    </Stack>
  );
}
