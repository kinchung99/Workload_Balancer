import { useMemo, useState } from 'react';
import { Linking } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Card, Chip, PageHeader, Screen, Stack, Text } from '@/components';
import { SCREEN } from '@design/screens';
import { Composer } from '@/features/compose/Composer';
import { recipientOf } from '@/lib/compose';
import { daysBetween, formatShort } from '@/lib/dates';
import { successFeedback } from '@/lib/haptics';
import { isMovable, loadOf } from '@/lib/load';
import { formatHour } from '@/lib/schedule';
import { useStore, weekReading } from '@/state/store';
import type { ComposeContext } from '@shared/contract';
import type { Item } from '@/lib/types';

/**
 * The frame the interface study documents. Also what makes `/decline/...` render
 * a real screen in the static export rather than the not-found state.
 */
export async function generateStaticParams() {
  return [{ id: 'w11-birthday' }];
}

/**
 * The heaviest other thing near this one - the honest reason, in words.
 *
 * "I'm swamped" is vague and reads as an excuse; "the group presentation on
 * Wednesday" is a fact the other person can picture.
 */
function pressureNear(items: Item[], item: Item): string | undefined {
  const near = items
    .filter((other) =>
      other.id !== item.id && !other.isRecovery && !other.isLog && !other.spread && !other.parentId && !other.repeats
      && Math.abs(daysBetween(item.date, other.date)) <= 3)
    .sort((a, b) => loadOf(b) - loadOf(a))[0];
  return near ? `${near.title} on ${formatShort(near.date).slice(0, 3)}` : undefined;
}

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
  const { items, ceilings, keepItem } = useStore();

  const item = items.find((i) => i.id === id);
  const [body, setBody] = useState<string | null>(null);
  /** What actually happened, so the screen can report it instead of vanishing. */
  const [outcome, setOutcome] = useState<'copied' | 'opened' | 'going' | null>(null);

  const context = useMemo<ComposeContext | null>(() => {
    if (!item) return null;
    const coursework = !!item.deadline || !!item.moduleId;
    return {
      kind: 'decline',
      subject: item.title,
      to: recipientOf(item.title) ?? (coursework ? 'my lecturer' : 'them'),
      when: `${formatShort(item.deadline ?? item.date)}${item.startHour !== undefined ? `, ${formatHour(item.startHour)}` : ''}`,
      commitment: item.commitment,
      pressure: pressureNear(items, item),
      weekPercent: weekReading(items, item.date, ceilings).overall,
      dread: item.dread,
    };
  }, [item, items, ceilings]);

  if (!item || !context) {
    return (
      <Screen back="/plan" backLabel="Plan" footer={<Button label="Back" kind="secondary" onPress={() => router.replace('/plan')} />}>
        <Text variant="heading" className="pt-8">That item is no longer in your week.</Text>
      </Screen>
    );
  }

  const weekPercent = context.weekPercent ?? 0;
  /** The demo's re-plan is specific to the birthday; anywhere else, going just keeps it. */
  const replans = item.id === 'w11-birthday';

  if (outcome) {
    const copy = {
      copied: { head: 'Copied.', body: 'Paste it wherever you talk to them. Ballast never sends anything itself.' },
      opened: { head: 'Over to you.', body: 'The draft is in WhatsApp under your name. Read it before you send it.' },
      going: {
        head: "You're going.",
        body: replans
          ? 'The chapter 9 reading moved to Sunday so the week still works. That was the only change.'
          : 'Nothing changed. It stays in your week.',
      },
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
          <Card tone={outcome === 'going' ? 'steady' : 'recovery'} gap={2}>
            <Text variant="callout">{copy.body}</Text>
          </Card>
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
            kind={body ? 'primary' : 'secondary'}
            disabled={!body}
            onPress={async () => {
              if (!body) return;
              // wa.me works on the phone app and in a browser, unlike whatsapp://
              const url = `https://wa.me/?text=${encodeURIComponent(body)}`;
              const ok = await Linking.canOpenURL(url).catch(() => false);
              if (ok) await Linking.openURL(url).catch(() => {});
              else await Clipboard.setStringAsync(body);
              successFeedback();
              setOutcome(ok ? 'opened' : 'copied');
            }}
          />
          <Stack direction="row" gap={2}>
            {body ? (
              <Button
                label="Copy it"
                kind="secondary"
                className="flex-1"
                onPress={async () => {
                  await Clipboard.setStringAsync(body);
                  successFeedback();
                  setOutcome('copied');
                }}
              />
            ) : null}
            {/* Going is a first-class option. It sits as a real button, not a
                dismissal, and choosing it re-plans rather than guilt-trips. */}
            <Button
              label="Actually, I'm going"
              kind="quiet"
              className="flex-1"
              onPress={() => {
                if (replans) keepItem(item.id, 'w11-ch9');
                successFeedback();
                setOutcome('going');
              }}
            />
          </Stack>
        </>
      }
    >
      <Stack gap={5} className="pt-4">
        <PageHeader
          {...SCREEN.decline}
          title="Saying no"
          sub="The app writes it. It never sends it."
        />

        {/* It names the trade in one line. No lecture, just the arithmetic. */}
        <Card gap={3}>
          <Stack direction="row" gap={4} align="center" justify="between">
            <Stack gap={1} grow>
              <Text variant="body" weight="semibold">
                {item.title}{item.when ? `, ${item.when}` : ''}
              </Text>
              <Text variant="footnote" tone="muted">
                {loadOf(item)} load · that week you are at {weekPercent}%
              </Text>
            </Stack>
            <Chip label={isMovable(item) ? 'Movable' : 'Hard'} tone={isMovable(item) ? 'heavy' : 'plain'} readOnly />
          </Stack>
          <WeekMeter percent={weekPercent} />
          {replans ? (
            <Text variant="micro" tone="subtle">
              If you go, the chapter 9 reading moves to Sunday. Going is not the wrong answer.
            </Text>
          ) : null}
        </Card>

        <Composer context={context} onChange={setBody} />
      </Stack>
    </Screen>
  );
}

/** How full that week is, as a bar with the 78% line drawn on it. */
function WeekMeter({ percent }: { percent: number }) {
  const band = percent >= 78 ? 'heavy' : percent >= 60 ? 'busy' : 'steady';
  const fill = { steady: 'bg-steady-fill', busy: 'bg-busy-fill', heavy: 'bg-heavy-fill' }[band];
  return (
    <Stack gap={1}>
      <Stack direction="row" className="h-3 w-full overflow-hidden rounded-pill bg-track">
        <Stack className={`h-3 ${fill}`} style={{ width: `${Math.min(100, percent)}%` }} />
      </Stack>
      <Stack direction="row" justify="between">
        <Text variant="micro" tone="subtle">WEEK LOAD</Text>
        <Text variant="micro" tone={band}>{band === 'heavy' ? 'OVER YOUR LINE' : band === 'busy' ? 'NEAR YOUR LINE' : 'ROOM LEFT'}</Text>
      </Stack>
    </Stack>
  );
}
