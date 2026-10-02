import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { Button, PageHeader, Screen, Section, Stack, Text } from '@/components';
import { SCREEN } from '@design/screens';
import { color, radius } from '@design/tokens';
import { DEFICIT_DAYS } from '@/data/seed';
import { restOwedFrom, useStore } from '@/state/store';

/**
 * Recovery, as a bank account for rest.
 *
 * A card with the balance on it, the last fourteen days as a strip of dots,
 * and the ledger as a list of transactions - a face for each, the amount in
 * its colour, a few words. Debts read red, credits green, and the shape of the
 * week is visible before a word of it is read.
 */
export default function Recover() {
  const router = useRouter();
  const { recovery, booked } = useStore();

  const balance = recovery.reduce((total, row) => total + (row.hours ?? 0), 0);
  const inDeficit = balance < 0;
  const owedHours = Math.abs(recovery.filter((row) => (row.hours ?? 0) < 0).reduce((t, r) => t + (r.hours ?? 0), 0));
  const bankedHours = recovery.filter((row) => (row.hours ?? 0) > 0).reduce((t, r) => t + (r.hours ?? 0), 0);
  const rows = recovery
    .filter((row) => row.hours !== null)
    .sort((a, b) => (a.hours ?? 0) - (b.hours ?? 0));
  const notes = recovery.filter((row) => row.hours === null);
  const worst = Math.max(...rows.map((row) => Math.abs(row.hours ?? 0)), 1);
  const tone = inDeficit ? 'heavy' : 'steady';

  return (
    <Screen
      back="/"
      backLabel="Home"
      footer={
        <Button
          label={booked.length > 0 ? 'Book more recovery' : 'What would actually help'}
          onPress={() => router.push('/prescription')}
        />
      }
    >
      <Stack gap={5} className="pt-4">
        <PageHeader {...SCREEN.recover} title="Recovery" sub="Your rest bank" />

        {/* The card: the balance, and fourteen days as dots. */}
        <View
          className="overflow-hidden rounded-xl border-2"
          style={{ backgroundColor: color.band[tone].wash, borderColor: color.band[tone].fill }}
        >
          {/* Two soft circles, the way a card has a pattern. Decoration only. */}
          <View pointerEvents="none" style={{ position: 'absolute', right: -50, top: -50, width: 170, height: 170, borderRadius: radius.pill, backgroundColor: color.decor.mint, opacity: 0.35 }} />
          <View pointerEvents="none" style={{ position: 'absolute', right: 50, bottom: -70, width: 150, height: 150, borderRadius: radius.pill, backgroundColor: color.decor.lemon, opacity: 0.3 }} />

          <Stack gap={4} className="px-5 py-5">
            <Stack direction="row" justify="between" align="center">
              <Text variant="micro" weight="bold" tone={tone}>🔋 REST BANK</Text>
              {booked.length > 0 ? (
                <View className="rounded-pill bg-raised px-3 py-1">
                  <Text variant="micro" weight="bold" tone="steady">✅ {booked.length} booked</Text>
                </View>
              ) : null}
            </Stack>

            <Stack gap={0}>
              <Text
                variant="hero"
                tone={tone}
                accessibilityLiveRegion="polite"
                accessibilityLabel={`${restOwedFrom(recovery)} hours ${inDeficit ? 'owed' : 'in credit'}`}
              >
                {inDeficit ? '−' : '+'}{restOwedFrom(recovery)}h
              </Text>
              <Text variant="caption" weight="semibold" tone="muted">{inDeficit ? 'owed to you' : 'in credit'}</Text>
            </Stack>

            {/* Owed against banked, as one bar. */}
            <View className="h-3 w-full flex-row overflow-hidden rounded-pill bg-raised">
              <View className="h-3 bg-heavy-fill" style={{ flexGrow: owedHours || 0.001 }} />
              <View className="h-3 bg-steady-fill" style={{ flexGrow: bankedHours || 0.001 }} />
            </View>

            {/* The last fourteen days: the run in the red, as dots. */}
            <Stack gap={2}>
              <Stack direction="row" gap={1}>
                {Array.from({ length: 14 }, (_, i) => {
                  const red = inDeficit && i >= 14 - DEFICIT_DAYS;
                  return (
                    <View
                      key={i}
                      className="flex-1 rounded-pill"
                      style={{ height: 10, backgroundColor: red ? color.band.heavy.fill : color.band.steady.fill, opacity: red ? 1 : 0.35 }}
                    />
                  );
                })}
              </Stack>
              <Stack direction="row" justify="between">
                <Text variant="micro" tone="subtle">14 days ago</Text>
                {inDeficit ? <Text variant="micro" weight="bold" tone="heavy">🔥 {DEFICIT_DAYS} days in the red</Text> : null}
                <Text variant="micro" tone="subtle">today</Text>
              </Stack>
            </Stack>

            {notes.length ? (
              <Stack direction="row" gap={2} wrap>
                {notes.map((row) => (
                  <View key={row.id} className="flex-row items-center gap-1 rounded-pill bg-raised px-3 py-2">
                    <Text variant="micro">{row.emoji ?? '•'}</Text>
                    <Text variant="micro" weight="semibold">{row.label} · {row.tag ?? row.detail}</Text>
                  </View>
                ))}
              </Stack>
            ) : null}
          </Stack>
        </View>

        {/* The ledger, as transactions: a face, a few words, the amount. */}
        <Section family="rest" title="Where it went" sticker="scales">
          <View className="overflow-hidden rounded-lg bg-raised">
            {rows.map((row, index) => {
              const down = (row.hours ?? 0) < 0;
              return (
                <Stack
                  key={row.id}
                  direction="row"
                  gap={3}
                  align="center"
                  className={`px-4 py-3 ${index > 0 ? 'border-t border-line-hairline' : ''}`}
                  accessible
                  accessibilityLabel={`${row.label}, ${row.detail}, ${Math.abs(row.hours ?? 0)} hours ${down ? 'down' : 'banked'}`}
                >
                  <View
                    className="items-center justify-center rounded-pill"
                    style={{ width: 44, height: 44, backgroundColor: down ? color.band.heavy.wash : color.band.steady.wash }}
                  >
                    <Text variant="heading">{row.emoji ?? (down ? '🔻' : '🌱')}</Text>
                  </View>
                  <Stack gap={1} grow>
                    <Text variant="body" weight="semibold">{row.label}</Text>
                    <View className="h-2 w-full overflow-hidden rounded-pill bg-track">
                      <View
                        className={`h-2 rounded-pill ${down ? 'bg-heavy-fill' : 'bg-steady-fill'}`}
                        style={{ width: `${(Math.abs(row.hours ?? 0) / worst) * 100}%` }}
                      />
                    </View>
                    <Text variant="micro" tone="subtle">{row.tag ?? row.detail}</Text>
                  </Stack>
                  <Text variant="title" tone={down ? 'heavy' : 'steady'}>
                    {down ? '−' : '+'}{Math.abs(row.hours ?? 0)}h
                  </Text>
                </Stack>
              );
            })}
          </View>
        </Section>
      </Stack>
    </Screen>
  );
}
