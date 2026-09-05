import { useMemo, useState } from 'react';
import { Linking } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { successFeedback } from '@/lib/haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Card, Chip, Screen, Stack, Text } from '@/components';
import { TONES, draft, reword, type Tone } from '@/lib/drafter';
import { dayName } from '@/lib/dates';
import { isMovable, loadOf } from '@/lib/load';
import { nextWeek, useStore, weekReading } from '@/state/store';
import { Card as ResultCard } from '@/components';

/**
 * The frame the interface study documents. Also what makes `/decline/...` render
 * a real screen in the static export rather than the not-found state.
 */
export async function generateStaticParams() {
  return [{ id: 'w11-birthday' }];
}

/** "Aisyah's birthday dinner" -> "Aisyah". The message has to sound like a person. */
const recipientOf = (title: string): string => title.match(/^([\w'-]+)'s\b/)?.[1] ?? 'them';

/**
 * Screen 7 — The hard part was never knowing what to cut.
 *
 * Students do not burn out because they cannot identify the problem. They burn
 * out because saying no is socially expensive, and the expensive part is sitting
 * there composing the message. Software can genuinely take that away.
 *
 * Ballast never sends anything. It drafts, you read, you send from your own app
 * under your own name.
 */
export default function Decline() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { items, ceilings, today, keepItem } = useStore();

  const item = items.find((i) => i.id === id);
  const [tone, setTone] = useState<Tone>('warm');
  const [edited, setEdited] = useState<string | null>(null);
  /** What actually happened, so the screen can report it instead of vanishing. */
  const [outcome, setOutcome] = useState<'copied' | 'opened' | 'going' | null>(null);

  const context = useMemo(
    () => ({
      to: item ? recipientOf(item.title) : 'them',
      occasion: item?.title.replace(/^[\w'-]+'s\s*/, '') ?? 'it',
      clash: 'the OS deadline on Wednesday',
      newDate: 'the week after',
      hook: 'the internship',
    }),
    [item],
  );

  if (!item) {
    return (
      <Screen back="/plan" backLabel="Plan" footer={<Button label="Back" kind="secondary" onPress={() => router.replace('/plan')} />}>
        <Text variant="heading" className="pt-8">That item is no longer in your week.</Text>
      </Screen>
    );
  }

  const nextWeekPercent = weekReading(items, nextWeek(today), ceilings).overall;
  const body = edited ?? draft(tone, context);

  if (outcome) {
    const copy = {
      copied: { head: 'Copied.', body: 'Paste it wherever you talk to them. Ballast never sends anything itself.' },
      opened: { head: 'Over to you.', body: 'The draft is in WhatsApp under your name. Read it before you send it.' },
      going: { head: "You're going.", body: 'The chapter 9 reading moved to Sunday so the week still works. That was the only change.' },
    }[outcome];

    return (
      <Screen
        back="/plan"
        backLabel="Plan"
        footer={
          <>
            <Button label="Back to the plan" onPress={() => router.replace('/plan')} />
            <Button label="Edit the message" kind="secondary" onPress={() => setOutcome(null)} />
          </>
        }
      >
        <Stack gap={6} className="pt-8">
          <Text variant="micro" tone={outcome === 'going' ? 'steady' : 'recovery'}>
            {outcome === 'going' ? 'RE-PLANNED' : 'DRAFTED'}
          </Text>
          <Text variant="title" accessibilityRole="header" accessibilityLiveRegion="polite">{copy.head}</Text>
          <ResultCard tone={outcome === 'going' ? 'steady' : 'recovery'} gap={2}>
            <Text variant="callout">{copy.body}</Text>
          </ResultCard>
        </Stack>
      </Screen>
    );
  }

  return (
    <Screen
      back="/plan"
      backLabel="Plan"
      footer={
        <>
          <Button
            label="Open in WhatsApp"
            onPress={async () => {
              // wa.me works on the phone app and in a browser, unlike whatsapp://
              const url = `https://wa.me/?text=${encodeURIComponent(body)}`;
              const ok = await Linking.canOpenURL(url).catch(() => false);
              if (ok) await Linking.openURL(url).catch(() => {});
              else await Clipboard.setStringAsync(body);
              successFeedback();
              setOutcome(ok ? 'opened' : 'copied');
            }}
          />
          <Button
            label="Copy it"
            kind="secondary"
            onPress={async () => {
              await Clipboard.setStringAsync(body);
              successFeedback();
              setOutcome('copied');
            }}
          />
          {/* c. Going is a first-class option. It sits as a real button, not a
              dismissal, and choosing it triggers a re-plan rather than a guilt
              trip. An app that only accepts one answer stops being trusted. */}
          <Button
            label="Actually, I'm going"
            kind="secondary"
            onPress={() => {
              // Going is not the wrong answer, so the week re-plans around it.
              keepItem(item.id, 'w11-ch9');
              successFeedback();
              setOutcome('going');
            }}
          />
          <Text variant="footnote" tone="subtle" className="pt-2">
            If you go, the chapter 9 reading moves to Sunday. Going is not the wrong answer.
          </Text>
        </>
      }
    >
      <Stack gap={5} className="pt-4">
        <Stack direction="row" justify="between" align="center">
          <Text variant="title" accessibilityRole="header">Saying no</Text>
          <Text variant="footnote" tone="subtle">Step 3 of 4</Text>
        </Stack>

        {/* a. It names the trade in one line. No lecture about boundaries, no
            wellbeing language, just the arithmetic that makes it obvious. */}
        <Card gap={4}>
          <Stack direction="row" gap={4} align="center" justify="between">
            <Stack gap={2} grow>
              <Text variant="body" weight="semibold">
                {item.title}{item.when ? `, ${item.when}` : ''}
              </Text>
              <Text variant="footnote" tone="muted">
                {loadOf(item)} load, and next week you are at {nextWeekPercent}%
              </Text>
            </Stack>
            <Chip label={isMovable(item) ? 'Movable' : 'Hard'} tone={isMovable(item) ? 'heavy' : 'plain'} readOnly />
          </Stack>
        </Card>

        {/* b. Three tones, because context is everything. The message you send a
            project group is not the one you send your mum or your closest friend. */}
        <Stack gap={3}>
          <Text variant="footnote" tone="subtle">Pick a tone</Text>
          <Stack direction="row" gap={3} wrap>
            {TONES.map((option) => (
              <Chip
                key={option.id}
                label={option.label}
                tone={tone === option.id ? 'selected' : 'plain'}
                accessibilityHint={option.note}
                onPress={() => {
                  setTone(option.id);
                  setEdited(null);
                }}
              />
            ))}
          </Stack>
        </Stack>

        <Card gap={4}>
          <Text variant="footnote" tone="subtle">To {context.to}, on WhatsApp</Text>
          <Text variant="body" accessibilityLabel={`Draft message. ${body}`}>{body}</Text>
          <Stack direction="row" gap={3} wrap>
            <Chip label="Reword" onPress={() => setEdited(reword(body, 'reword', context))} />
            <Chip label="Shorter" onPress={() => setEdited(reword(body, 'shorter', context))} />
            <Chip label="Offer a new date" onPress={() => setEdited(reword(body, 'newDate', context))} />
          </Stack>
        </Card>

        <Text variant="footnote" tone="subtle">
          Also drafts extension requests and shift swaps.
        </Text>
      </Stack>
    </Screen>
  );
}
