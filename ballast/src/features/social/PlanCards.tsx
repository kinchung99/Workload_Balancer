/**
 * A plan, as a card - one you sent, or one you were asked to.
 *
 * Only what decides it: what, when, who has said yes (green) or no (red), and
 * - for one you were asked to - how full that day already is. The buttons are
 * the next step and nothing else.
 */
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Avatar, Stack, Text } from '@/components';
import { color, radius } from '@design/tokens';
import { dayIndex, formatShort } from '@/lib/dates';
import { formatHour } from '@/lib/schedule';
import { capacityOf, loadOf } from '@/lib/load';
import { countedOnce } from '@/lib/prep';
import { answerPlan, cancelPlan, schedulePlan } from '@/lib/social';
import { successFeedback, tapFeedback } from '@/lib/haptics';
import { useStore } from '@/state/store';
import type { Invite, ReceivedInvite } from '@/lib/types';

const DAY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** A picture for the plan, from what it is. */
export function planEmoji(title: string): string {
  const t = title.toLowerCase();
  if (/dinner|lunch|noodle|food|brunch|pizza/.test(t)) return '🍜';
  if (/walk|hike/.test(t)) return '🚶';
  if (/study|library|revis/.test(t)) return '📚';
  if (/film|movie|cinema/.test(t)) return '🍿';
  if (/trip|beach|day out/.test(t)) return '🚌';
  if (/badminton|gym|football|sport|swim/.test(t)) return '🏸';
  if (/coffee|bubble tea|cafe/.test(t)) return '☕';
  return '🎉';
}

/** "Dinner with Amin and Ravi" → "Dinner". */
export const planName = (title: string): string => title.split(/ with | · /)[0] ?? title;

/** "Wed 12 Nov · 7–9pm". */
export const planWhen = (plan: { date: string; startHour: number; hours: number }): string =>
  `${formatShort(plan.date)} · ${formatHour(plan.startHour)}–${formatHour(plan.startHour + plan.hours)}`;

/** A face with its answer on it: a green tick, a red cross, or nothing yet. */
function Face({ name, initials, pic, answer }: { name: string; initials: string; pic?: string | null; answer?: 'yes' | 'no' }) {
  const ring = answer === 'yes' ? color.band.steady.fill : answer === 'no' ? color.band.heavy.fill : color.line.strong;
  return (
    <Stack gap={1} align="center" style={{ width: 52 }}>
      <View style={{ borderRadius: radius.pill, borderWidth: 3, borderColor: ring, opacity: answer === 'no' ? 0.6 : 1 }}>
        <Avatar initials={initials} size={38} pic={pic} />
        {answer ? (
          <View
            className="absolute items-center justify-center rounded-pill"
            style={{ right: -6, bottom: -4, width: 18, height: 18, backgroundColor: ring, borderWidth: 2, borderColor: color.surface.raised }}
          >
            <Text variant="micro" tone="inverse">{answer === 'yes' ? '✓' : '✕'}</Text>
          </View>
        ) : null}
      </View>
      <Text variant="micro" numberOfLines={1}>{name.split(' ')[0]}</Text>
    </Stack>
  );
}

function Head({ title, when, tint }: { title: string; when: string; tint: string }) {
  return (
    <Stack direction="row" gap={3} align="center">
      <View className="items-center justify-center rounded-lg" style={{ width: 50, height: 50, backgroundColor: tint }}>
        <Text variant="title">{planEmoji(title)}</Text>
      </View>
      <Stack gap={0} grow>
        <Text variant="heading" numberOfLines={1}>{planName(title)}</Text>
        <Text variant="caption" weight="semibold" tone="muted">{when}</Text>
      </Stack>
    </Stack>
  );
}

function Action({ label, kind = 'plain', onPress }: { label: string; kind?: 'strong' | 'plain' | 'danger' | 'done'; onPress?: () => void }) {
  const style = {
    strong: { bg: color.surface.inverse, tone: 'inverse' as const, border: color.surface.inverse },
    plain: { bg: color.surface.sunken, tone: 'default' as const, border: color.line.hairline },
    danger: { bg: color.band.heavy.fill, tone: 'inverse' as const, border: color.band.heavy.fill },
    done: { bg: color.band.steady.wash, tone: 'steady' as const, border: color.band.steady.wash },
  }[kind];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={!onPress}
      onPress={onPress}
      className="min-h-min flex-1 items-center justify-center rounded-pill px-3 py-2 active:opacity-70"
      style={{ backgroundColor: style.bg, borderWidth: 2, borderColor: style.border }}
    >
      <Text variant="caption" weight="bold" tone={style.tone} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

/** A plan you sent: who is in, and putting it in your week - or calling it off. */
export function SentPlanCard({ invite }: { invite: Invite }) {
  const circle = useStore((state) => state.circle);
  const [ending, setEnding] = useState(false);
  const answers = invite.answers ?? {};
  const yes = invite.people.filter((id) => answers[id] === 'yes').length;
  const no = invite.people.filter((id) => answers[id] === 'no').length;
  const waiting = invite.people.length - yes - no;

  return (
    <Stack gap={3} className="rounded-xl bg-raised px-4 py-4" style={{ borderWidth: 2, borderColor: invite.scheduled ? color.band.steady.fill : color.line.hairline }}>
      <Head title={invite.title} when={planWhen(invite)} tint={color.decor.mint} />
      <Stack direction="row" gap={1} wrap>
        {invite.people.map((id) => {
          const person = circle.find((p) => p.id === id);
          return <Face key={id} name={person?.name ?? 'Friend'} initials={person?.initials ?? '?'} pic={person?.pic} answer={answers[id]} />;
        })}
      </Stack>
      <Text variant="micro" weight="bold">
        <Text variant="micro" weight="bold" tone="steady">{yes} in</Text>
        {no ? <Text variant="micro" weight="bold" tone="heavy">{` · ${no} out`}</Text> : null}
        {waiting ? <Text variant="micro" weight="bold" tone="subtle">{` · ${waiting} waiting`}</Text> : null}
      </Text>
      {ending ? (
        <Stack gap={2} className="rounded-md bg-heavy-wash px-3 py-3">
          <Text variant="callout" weight="semibold" tone="heavy">Call it off for everyone?</Text>
          <Stack direction="row" gap={2}>
            <Action label="Keep it" onPress={() => { tapFeedback(); setEnding(false); }} />
            <Action label="Yes, cancel" kind="danger" onPress={() => { void cancelPlan(invite.id); successFeedback(); }} />
          </Stack>
        </Stack>
      ) : (
        <Stack direction="row" gap={2}>
          {invite.scheduled
            ? <Action label="✓ In your week" kind="done" />
            : <Action label="📅 Add to week" kind="strong" onPress={() => { schedulePlan(invite.id); successFeedback(); }} />}
          <Action label="Cancel" onPress={() => { tapFeedback(); setEnding(true); }} />
        </Stack>
      )}
    </Stack>
  );
}

/** A plan you were asked to: who asked, who else is going, and how full that day is. */
export function ReceivedPlanCard({ invite }: { invite: ReceivedInvite }) {
  const router = useRouter();
  const { circle, items, ceilings } = useStore();
  const dayCost = countedOnce(items)
    .filter((item) => item.date === invite.date && !item.isLog && item.id !== `going-${invite.id}`)
    .reduce((sum, item) => sum + loadOf(item), 0) / capacityOf(ceilings) * 100;
  const busy = dayCost >= 10;
  const day = DAY[dayIndex(invite.date)];

  return (
    <Stack gap={3} className="rounded-xl bg-raised px-4 py-4" style={{ borderWidth: 2, borderColor: invite.answer === 'yes' ? color.band.steady.fill : color.line.hairline, opacity: invite.answer === 'no' ? 0.6 : 1 }}>
      <Head title={invite.title} when={planWhen(invite)} tint={color.decor.candy} />
      <Stack direction="row" gap={2} wrap>
        <View className="rounded-pill px-3 py-1" style={{ backgroundColor: color.decor.lemon }}>
          <Text variant="micro" weight="bold">✉️ From {invite.from}</Text>
        </View>
        <View className="rounded-pill px-3 py-1" style={{ backgroundColor: busy ? color.band.busy.wash : color.band.steady.wash }}>
          <Text variant="micro" weight="bold" tone={busy ? 'busy' : 'steady'}>🔋 {day} already −{Math.round(dayCost)}%</Text>
        </View>
      </Stack>
      <Stack direction="row" gap={1} wrap>
        {invite.others.map((other) => {
          const person = circle.find((p) => p.id === other.id);
          return <Face key={other.id} name={other.name} initials={person?.initials ?? other.name.slice(0, 2).toUpperCase()} pic={person?.pic} answer={other.answer} />;
        })}
      </Stack>
      {invite.answer ? (
        <Stack direction="row" gap={2}>
          <Action label={invite.answer === 'yes' ? '✓ Going · in your week' : '✕ Declined'} kind={invite.answer === 'yes' ? 'done' : 'plain'} />
          <Action label={invite.answer === 'yes' ? 'Can’t go' : 'Go after all'} onPress={() => { tapFeedback(); void answerPlan(invite.id, invite.answer !== 'yes'); }} />
        </Stack>
      ) : (
        <Stack direction="row" gap={2}>
          <Action label="✓ Accept" kind="strong" onPress={() => { void answerPlan(invite.id, true); successFeedback(); }} />
          <Action label="Decline" onPress={() => { void answerPlan(invite.id, false); tapFeedback(); }} />
          <Action label={`See ${day} ›`} onPress={() => { tapFeedback(); router.push(`/plan?day=${invite.date}` as Href); }} />
        </Stack>
      )}
    </Stack>
  );
}
