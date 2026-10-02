import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import {
  Avatar, Battery, Card, PageHeader, Screen, Section, Stack, Sticker, Text,
} from '@/components';
import { color, radius } from '@design/tokens';
import { SCREEN } from '@design/screens';
import { FAMILY } from '@design/families';
import { DAY_LETTER } from '@/lib/dates';
import { VISIBILITY } from '@/lib/sharing';
import { tapFeedback } from '@/lib/haptics';
import { useStore } from '@/state/store';
import { useReading } from '@/state/selectors';

/**
 * What your circle sees.
 *
 * Privacy settings normally fail in the same way: options explained in prose,
 * so people pick one at random and never trust it again. Here each answer
 * carries its consequence in one line. The per-friend preview went when the
 * circle grew to sixty - a row of every face was never going to fit.
 *
 * Three presets cover most people. "Custom hours" and "Who sees your times"
 * are one level down, for the student whose Sunday mornings are nobody's
 * business or who only wants the study group to see their evenings.
 *
 * Nothing on it is a dark pattern. `Nothing` is genuinely nothing, it is one tap
 * from here, and choosing it does not disable the rest of the app.
 */
export default function Sharing() {
  const router = useRouter();
  const { circle, sharing, setSharing, shareRules } = useStore();
  const reading = useReading();
  const friends = circle.filter((person) => !person.isYou);
  const hidden = shareRules.hiddenFrom;

  const seeing = friends.filter((person) => !hidden.includes(person.id));

  return (
    <Screen back="/friends" backLabel="Friends">
      <Stack gap={5} className="pt-2">
        <PageHeader
          {...SCREEN.sharing}
          eyebrow="Your privacy"
          title="What they see"
        />

        {/* Always shared, and worth saying plainly rather than hiding in prose. */}
        <Card tone="steady" gap={4}>
          <Stack direction="row" gap={4} align="center">
            <Battery charge={reading.charge} loadPercent={reading.overall} width={64} height={32} label={`${reading.charge} percent`} />
            <Stack gap={1} grow>
              <Text variant="body" weight="semibold">Your battery · {reading.charge}%</Text>
              <Text variant="micro" tone="subtle">Always shared</Text>
            </Stack>
          </Stack>
        </Card>

        {/* What of your calendar they get: four answers, each with its consequence. */}
        <Section family="people" title="Your calendar" sticker="calendar">
          {VISIBILITY.map((option) => {
            const picked = sharing === option.value;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityState={{ checked: picked }}
                accessibilityLabel={`${option.word}. ${option.note}`}
                onPress={() => { tapFeedback(); setSharing(option.value); }}
                className={`min-h-row flex-row items-center gap-4 rounded-lg border-2 bg-raised px-4 py-3 active:opacity-70 ${
                  picked ? 'border-inverse' : 'border-line-hairline'
                }`}
              >
                <View
                  className="items-center justify-center rounded-pill"
                  style={{ width: 40, height: 40, backgroundColor: picked ? color.decor.lilac : color.surface.sunken }}
                >
                  <Text variant="heading">{option.emoji}</Text>
                </View>
                <Stack gap={1} grow>
                  <Text variant="body" weight="semibold">{option.word}</Text>
                  <Text variant="micro" tone="muted">{option.note}</Text>
                </Stack>
                <View
                  className="items-center justify-center rounded-pill"
                  style={{ width: 24, height: 24, borderWidth: 2.5, borderColor: picked ? color.ink.default : color.line.strong }}
                >
                  {picked ? <View className="rounded-pill" style={{ width: 11, height: 11, backgroundColor: color.ink.default }} /> : null}
                </View>
              </Pressable>
            );
          })}
        </Section>

        {/* One level down: your own hours, and who sees anything at all. */}
        <Section family="people" title="Fine-tune" sticker="sparkle">
          <Door
            emoji="🎛️"
            title="Custom hours"
            sub={sharing === 'custom'
              ? shareRules.week.map((w, i) => (w ? DAY_LETTER[i] : '·')).join(' ')
              : 'Pick the days and hours you share'}
            onPress={() => router.push('/sharing/hours' as Href)}
            extra={<HoursStrip week={shareRules.week} on={sharing === 'custom'} />}
          />
          <Door
            emoji="👀"
            title="Who sees your times"
            sub={hidden.length === 0
              ? `Everyone in your circle · ${friends.length}`
              : `${seeing.length} of ${friends.length} · hidden from ${friends.filter((p) => hidden.includes(p.id)).map((p) => p.name).join(', ')}`}
            onPress={() => router.push('/sharing/people' as Href)}
          />
        </Section>

        <View className="h-2" />
      </Stack>
    </Screen>
  );
}

function Door({
  emoji, title, sub, onPress, extra,
}: { emoji: string; title: string; sub: string; onPress: () => void; extra?: ReactNode }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${sub}`}
      onPress={() => { tapFeedback(); onPress(); }}
      className="active:opacity-70"
    >
      <Stack gap={3} className="rounded-lg border border-line-hairline bg-raised px-4 py-4">
        <Stack direction="row" gap={4} align="center">
          <View className="items-center justify-center rounded-pill" style={{ width: 40, height: 40, backgroundColor: FAMILY.people.wash }}>
            <Text variant="heading">{emoji}</Text>
          </View>
          <Stack gap={1} grow>
            <Text variant="body" weight="semibold">{title}</Text>
            <Text variant="micro" tone="muted">{sub}</Text>
          </Stack>
          <Text variant="heading" tone="subtle">›</Text>
        </Stack>
        {extra}
      </Stack>
    </Pressable>
  );
}

/** The custom week at a glance: seven little bars, filled where you share. */
function HoursStrip({ week, on }: { week: Array<{ start: number; end: number } | null>; on: boolean }) {
  return (
    <Stack direction="row" gap={1} style={{ opacity: on ? 1 : 0.45 }}>
      {week.map((window, i) => (
        <Stack key={i} gap={1} align="center" className="flex-1">
          <View style={{ width: '100%', height: 26, borderRadius: radius.sm, backgroundColor: color.surface.sunken, overflow: 'hidden' }}>
            {window ? (
              <View
                style={{
                  position: 'absolute', left: 0, right: 0,
                  top: `${((window.start - 7) / 16) * 100}%`,
                  height: `${((window.end - window.start) / 16) * 100}%`,
                  backgroundColor: color.band.recovery.fill,
                }}
              />
            ) : null}
          </View>
          <Text variant="micro" tone="subtle">{DAY_LETTER[i]}</Text>
        </Stack>
      ))}
    </Stack>
  );
}
