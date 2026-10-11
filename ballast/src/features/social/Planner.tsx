import { useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Avatar, Button, Card, Chip, Section, Stack, Text } from '@/components';
import { color, radius } from '@design/tokens';
import { addDays, dayIndex, formatShort } from '@/lib/dates';
import { successFeedback, tapFeedback } from '@/lib/haptics';
import { formatHour } from '@/lib/schedule';
import { PLAN_FROM, PLAN_TO, planBlocks, type PlanBlock } from '@/lib/together';
import { sendPlan } from '@/lib/social';
import { useStore } from '@/state/store';
import { useItemsWithLogs } from '@/state/selectors';
import type { CircleMember, Group, PlanActivity } from '@/lib/types';
import { FriendPicker } from './FriendPicker';
import { frequentFriends } from '@/lib/circle';

const TONE = { steady: 'steady', busy: 'busy', heavy: 'heavy', recovery: 'recovery' } as const;

/** What anyone might plan. A group's own usual activities sit after these. */
export const PLANS: PlanActivity[] = [
  { id: 'dinner', label: 'Dinner', emoji: '🍝', hours: 2 },
  { id: 'walk', label: 'A walk', emoji: '🚶', hours: 1 },
  { id: 'study', label: 'Study together', emoji: '📚', hours: 2 },
  { id: 'film', label: 'Film night', emoji: '🍿', hours: 3 },
  { id: 'trip', label: 'Day trip', emoji: '🚌', hours: 6 },
];

const ACTIVITY_EMOJIS = ['🏸', '⚽', '🎳', '🎮', '🍜', '☕', '🎤', '🧗', '🏊', '🎨', '🎲', '🛍️'];
const ACTIVITY_HOURS = [0.5, 1, 1.5, 2, 3, 4, 6];
const hoursLabel = (hours: number) => (hours < 1 ? `${hours * 60}m` : `${hours}h`);

/**
 * Plan something with people - some of a group, or whoever you pick.
 *
 * Who comes is a choice made per plan, not a change to the group: tap faces to
 * ask three of the four this time and all four next time, and the group stays
 * exactly who it is. Their battery sits under each face the whole time, because
 * inviting the person at 8% to a day trip is not a kindness.
 *
 * Then it does the coordinating: a heatmap of who is free when, the windows that
 * work for everyone asked, and an invite that lands in your own week at once -
 * and in theirs once you send the message, which the app writes and you send.
 */
export function Planner({
  pool,
  initial,
  group,
  quickGroups,
  initialPlan,
}: {
  /** Everyone who could come: the group's members, or your whole circle. */
  pool: CircleMember[];
  /** Who starts picked. Absent means everyone in the pool. */
  initial?: string[];
  group?: Group;
  /** Groups to start a one-off plan from. */
  quickGroups?: Group[];
  /** An activity to start on - a group's usual one, tapped on the group page. */
  initialPlan?: string;
}) {
  const router = useRouter();
  const { today, planActivities, addActivity, removeActivity } = useStore();
  const items = useItemsWithLogs();

  const [picked, setPicked] = useState<string[] | null>(initial ?? null);
  const chosen = useMemo(
    () => (picked === null ? pool : pool.filter((person) => picked.includes(person.id))),
    [pool, picked],
  );

  const usual = group ? group.activities ?? [] : planActivities;
  const activities = [...PLANS, ...usual];
  const [planId, setPlanId] = useState(initialPlan ?? PLANS[0].id);
  const plan = activities.find((a) => a.id === planId) ?? PLANS[0];
  const custom = usual.some((a) => a.id === plan.id);
  const [making, setMaking] = useState(false);

  const [choice, setChoice] = useState<PlanBlock | null>(null);
  const [week, setWeek] = useState(0);
  const [sent, setSent] = useState<{ title: string; count: number } | null>(null);
  const [failed, setFailed] = useState(false);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(today, week * 7 + i)), [today, week]);
  // The week as blocks the length of the plan: green for everyone, blue for some.
  const blocks = useMemo(() => planBlocks(items, chosen, days, plan.hours), [items, chosen, days, plan]);
  const forEveryone = blocks.filter((block) => block.everyone).length;

  const reset = () => { setChoice(null); setSent(null); };

  const toggle = (id: string) => {
    tapFeedback();
    const current = picked ?? pool.map((person) => person.id);
    setPicked(current.includes(id) ? current.filter((p) => p !== id) : [...current, id]);
    reset();
  };

  const everyone = chosen.length === pool.length;
  /**
   * A whole circle is too many faces to lay out. With more than a handful, the
   * row shows who is coming and the few you see most; everyone else is in the
   * picker, a page of its own with a search.
   */
  const large = pool.length > 8;
  const [choosing, setChoosing] = useState(false);
  const frequent = useMemo(() => frequentFriends(pool, 6), [pool]);
  const faces = large
    ? [...chosen, ...frequent.filter((person) => !chosen.some((c) => c.id === person.id))]
    : pool;

  return (
    <Stack gap={5}>
      {/* Who: tap faces in and out. This plan only - the group stays who it is. */}
      <Section
        family="people"
        title={group ? 'Who to invite' : 'Who’s coming'}
        meta={`${chosen.length} of ${pool.length}`}
        action={
          large
            ? chosen.length ? { label: 'Clear', onPress: () => { setPicked([]); reset(); } } : undefined
            : pool.length > 1 ? { label: everyone ? 'Clear' : `All ${pool.length}`, onPress: () => { setPicked(everyone ? [] : null); reset(); } } : undefined
        }
      >
        {quickGroups?.length ? (
          <Stack direction="row" gap={2} wrap>
            {quickGroups.map((g) => (
              <Chip
                key={g.id}
                label={`${g.emoji} ${g.name}`}
                onPress={() => { tapFeedback(); setPicked(g.members.filter((id) => pool.some((p) => p.id === id))); reset(); }}
              />
            ))}
          </Stack>
        ) : null}
        <Stack direction="row" gap={2} wrap>
          {faces.map((person) => {
            const on = chosen.some((p) => p.id === person.id);
            return (
              <Pressable
                key={person.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={`${person.name}, ${person.charge}% battery. ${on ? 'Invited' : 'Not invited'}`}
                onPress={() => toggle(person.id)}
                className={`items-center gap-1 rounded-lg border-2 px-2 py-3 active:opacity-70 ${on ? 'border-inverse bg-raised' : 'border-line-hairline bg-raised'}`}
                style={{ width: '31%', opacity: on ? 1 : 0.55 }}
              >
                <Avatar initials={person.initials} band={person.band} size={42} pic={person.pic} />
                <Text variant="caption" weight="semibold">{person.name}</Text>
                <Text variant="micro" tone={TONE[person.band]}>{person.charge}%</Text>
                <View
                  className="absolute items-center justify-center rounded-pill"
                  style={{
                    top: 6, right: 6, width: 20, height: 20,
                    backgroundColor: on ? color.surface.inverse : color.surface.sunken,
                  }}
                >
                  <Text variant="micro" tone={on ? 'inverse' : 'subtle'}>{on ? '✓' : '＋'}</Text>
                </View>
              </Pressable>
            );
          })}
          {large ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Choose from all ${pool.length} friends`}
              onPress={() => { tapFeedback(); setChoosing(true); }}
              className="items-center justify-center gap-1 rounded-lg border-2 border-dashed border-line-strong bg-raised px-2 py-3 active:opacity-70"
              style={{ width: '31%', minHeight: 112 }}
            >
              <Text variant="title">🔍</Text>
              <Text variant="caption" weight="semibold">More</Text>
              <Text variant="micro" tone="subtle">{pool.length} friends</Text>
            </Pressable>
          ) : null}
        </Stack>
        <FriendPicker
          visible={choosing}
          title={group ? 'Who to invite' : 'Who’s coming'}
          people={pool}
          frequent={frequent}
          selected={chosen.map((person) => person.id)}
          onClose={() => setChoosing(false)}
          onDone={(ids) => { setPicked(ids); setChoosing(false); reset(); }}
        />
        {pool.length === 0 ? (
          <Text variant="footnote" tone="muted">{group ? 'Add members to the group first.' : 'Find friends first.'}</Text>
        ) : null}
      </Section>

      {/* What: the usual suspects, then whatever this group actually does. */}
      <Section family="people" title="What" sticker="sparkle" meta={usual.length ? `${usual.length} usual` : undefined}>
        <Stack direction="row" gap={2} wrap>
          {activities.map((option) => (
            <Chip
              key={option.id}
              label={`${option.emoji} ${option.label} · ${hoursLabel(option.hours)}`}
              tone={option.id === plan.id ? 'selected' : usual.includes(option) ? 'recovery' : 'plain'}
              onPress={() => { tapFeedback(); setPlanId(option.id); reset(); }}
            />
          ))}
          {!making ? (
            <Chip label="＋ Your own" accessibilityHint="Save an activity you do often" onPress={() => { tapFeedback(); setMaking(true); }} />
          ) : null}
        </Stack>
        {making ? (
          <ActivityMaker
            where={group ? group.name : 'your plans'}
            onCancel={() => setMaking(false)}
            onMade={(activity) => {
              const id = addActivity(activity, group?.id);
              successFeedback();
              setPlanId(id);
              setMaking(false);
              reset();
            }}
          />
        ) : custom ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => { tapFeedback(); removeActivity(plan.id, group?.id); setPlanId(PLANS[0].id); reset(); }}
            className="min-h-min justify-center self-start active:opacity-60"
          >
            <Text variant="caption" tone="muted" className="underline">Remove “{plan.label}” from usual</Text>
          </Pressable>
        ) : null}
      </Section>

      {/* When: the week as blocks the length of the plan. Tap one to pick it. */}
      <Section family="week" title="When" sticker="clock" meta={chosen.length ? `${forEveryone} for everyone` : undefined}>
        {chosen.length ? (
          <Card gap={3}>
            <Stack direction="row" gap={2}>
              <Chip label="This week" tone={week === 0 ? 'selected' : 'plain'} onPress={() => { tapFeedback(); setWeek(0); setChoice(null); }} />
              <Chip label="Next week" tone={week === 1 ? 'selected' : 'plain'} onPress={() => { tapFeedback(); setWeek(1); setChoice(null); }} />
            </Stack>
            <WeekBlocks days={days} blocks={blocks} choice={choice} onPick={(block) => { tapFeedback(); setChoice(block); setSent(null); }} />
          </Card>
        ) : (
          <Card tone="sunken" gap={1}>
            <Text variant="callout" weight="semibold">Pick who’s coming first.</Text>
          </Card>
        )}

        {choice ? (
          <Stack direction="row" gap={3} align="center" className="rounded-lg px-4 py-3" style={{ backgroundColor: choice.everyone ? color.band.steady.wash : color.band.recovery.wash }}>
            <Text variant="title">{plan.emoji}</Text>
            <Stack gap={0} grow>
              <Text variant="body" weight="semibold">{formatShort(choice.date)} · {formatHour(choice.start)}–{formatHour(choice.end)}</Text>
              <Text variant="micro" tone={choice.everyone ? 'steady' : 'recovery'}>
                {choice.everyone ? `Everyone’s free · ${chosen.length + 1} of ${chosen.length + 1}` : `${choice.who.join(', ')} free · ${choice.who.length + 1} of ${chosen.length + 1}`}
              </Text>
            </Stack>
          </Stack>
        ) : null}
      </Section>

      {sent ? (
        // Sent: it waits for their answers; it goes in your week when you say.
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${sent.title} sent to ${sent.count}. See your plans`}
          onPress={() => { tapFeedback(); router.push('/plans?tab=sent' as Href); }}
          className="flex-row items-center gap-3 rounded-lg px-4 py-4 active:opacity-70"
          style={{ backgroundColor: color.band.steady.wash, borderWidth: 2, borderColor: color.band.steady.fill }}
        >
          <Text variant="title">✉️</Text>
          <Stack gap={0} grow>
            <Text variant="body" weight="semibold">Sent to {sent.count} · waiting for answers</Text>
            <Text variant="micro" tone="steady">See it in Plans ›</Text>
          </Stack>
        </Pressable>
      ) : (
        <Button
          label={choice ? `${plan.emoji} Invite ${chosen.length} to ${plan.label.toLowerCase()}` : 'Pick a time'}
          kind={choice ? 'steady' : 'secondary'}
          onPress={async () => {
            if (!choice || !chosen.length) return;
            const title = group
              ? `${plan.label} · ${group.name}${chosen.length < pool.length ? ` (${chosen.length} of ${pool.length})` : ''}`
              : `${plan.label} with ${listNames(chosen.map((f) => f.name))}`;
            const ok = await sendPlan({
              title, date: choice.date, startHour: choice.start, hours: plan.hours,
              people: chosen.map((f) => f.id), groupId: group?.id,
            });
            if (!ok) { setFailed(true); return; }
            setFailed(false);
            successFeedback();
            setChoice(null);
            setSent({ title, count: chosen.length });
          }}
        />
      )}
      {failed && !sent ? (
        <View className="rounded-md px-3 py-2" style={{ backgroundColor: color.band.heavy.wash }}>
          <Text variant="micro" weight="bold" tone="heavy">Didn’t send - check your connection and try again</Text>
        </View>
      ) : null}
    </Stack>
  );
}

/** "Amin", "Amin and Jo", "Amin, Jo and Ravi". */
const listNames = (names: string[]): string =>
  names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

const LABEL_WIDTH = 46;
const TICKS = [9, 12, 15, 18, 21];

/** As much of the start time as the block has room for: "7:30pm", "7½", "7". */
function blockLabel(start: number, hours: number): string {
  if (hours >= 3) return formatHour(start);
  const h12 = ((Math.floor(start) + 11) % 12) + 1;
  const half = start % 1 ? '½' : '';
  if (hours >= 2) return half ? `${h12}${half}` : `${h12}${start >= 12 ? 'pm' : 'am'}`;
  return `${h12}${half}`;
}

/**
 * One row per day, nine in the morning to eleven at night. Green blocks are
 * the plan's length with everyone free; blue, the same length with some free;
 * grey is everything else. Each block is a time you can pick.
 */
function WeekBlocks({
  days, blocks, choice, onPick,
}: { days: string[]; blocks: PlanBlock[]; choice: PlanBlock | null; onPick: (block: PlanBlock) => void }) {
  const span = PLAN_TO - PLAN_FROM;
  const at = (hour: number) => `${((hour - PLAN_FROM) / span) * 100}%` as `${number}%`;
  return (
    <Stack gap={2}>
      <View style={{ marginLeft: LABEL_WIDTH + 8, height: 14 }}>
        {TICKS.map((hour) => (
          <Text key={hour} variant="micro" tone="subtle" style={{ position: 'absolute', left: at(hour), transform: [{ translateX: -10 }] }}>
            {formatHour(hour).replace(':00', '')}
          </Text>
        ))}
      </View>
      {days.map((date) => {
        const row = blocks.filter((block) => block.date === date);
        return (
          <Stack key={date} direction="row" gap={2} align="center">
            <Stack gap={0} style={{ width: LABEL_WIDTH }}>
              <Text variant="caption" weight="bold">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][dayIndex(date)]}</Text>
              <Text variant="micro" tone="subtle">{formatShort(date).slice(4)}</Text>
            </Stack>
            <View className="flex-1" style={{ height: 36, borderRadius: radius.sm, backgroundColor: color.surface.sunken }}>
              {row.map((block) => {
                const on = choice?.date === block.date && choice.start === block.start;
                return (
                  <Pressable
                    key={block.start}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={`${formatShort(date)} ${formatHour(block.start)} to ${formatHour(block.end)}, ${block.everyone ? 'everyone free' : `${block.who.join(', ')} free`}`}
                    onPress={() => onPick(block)}
                    className="items-center justify-center active:opacity-70"
                    style={{
                      position: 'absolute', left: at(block.start), width: at(PLAN_FROM + block.end - block.start), top: 3, bottom: 3,
                      marginHorizontal: 1, borderRadius: radius.sm,
                      backgroundColor: block.everyone ? color.band.steady.fill : color.band.recovery.fill,
                      borderWidth: on ? 3 : 0, borderColor: color.ink.default,
                    }}
                  >
                    <Text variant="micro" tone="inverse" numberOfLines={1}>{blockLabel(block.start, block.end - block.start)}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Stack>
        );
      })}
      <Stack direction="row" gap={4} style={{ marginLeft: LABEL_WIDTH + 8 }}>
        <Key fill={color.band.steady.fill} word="Everyone" />
        <Key fill={color.band.recovery.fill} word="Some" />
        <Key fill={color.surface.sunken} word="Nobody" />
      </Stack>
    </Stack>
  );
}

function Key({ fill, word }: { fill: string; word: string }) {
  return (
    <Stack direction="row" gap={1} align="center">
      <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: fill, borderWidth: 1, borderColor: color.line.hairline }} />
      <Text variant="micro" tone="muted">{word}</Text>
    </Stack>
  );
}

/**
 * Save something you do together often: a picture, a name, how long it takes.
 * It sits in WHAT from then on, ready to plan in one tap.
 */
function ActivityMaker({
  where,
  onMade,
  onCancel,
}: {
  where: string;
  onMade: (activity: Omit<PlanActivity, 'id'>) => void;
  onCancel: () => void;
}) {
  const [emoji, setEmoji] = useState(ACTIVITY_EMOJIS[0]);
  const [label, setLabel] = useState('');
  const [hours, setHours] = useState(2);
  const ready = label.trim().length > 0;

  return (
    <Stack gap={3} className="rounded-lg border-2 border-dashed border-line-strong bg-sunken p-4">
      <Text variant="micro" tone="subtle">NEW USUAL ACTIVITY · SAVED TO {where.toUpperCase()}</Text>
      <Stack direction="row" gap={2} wrap>
        {ACTIVITY_EMOJIS.map((option) => (
          <Pressable
            key={option}
            accessibilityRole="radio"
            accessibilityState={{ selected: option === emoji }}
            accessibilityLabel={`Activity picture ${option}`}
            onPress={() => { tapFeedback(); setEmoji(option); }}
            className="items-center justify-center rounded-md active:opacity-60"
            style={{
              width: 38, height: 38,
              backgroundColor: option === emoji ? color.decor.lemon : color.surface.raised,
              borderWidth: option === emoji ? 2 : 1,
              borderColor: option === emoji ? color.ink.default : color.line.hairline,
            }}
          >
            <Text variant="callout">{option}</Text>
          </Pressable>
        ))}
      </Stack>
      <TextInput
        value={label}
        onChangeText={(text) => setLabel(text.slice(0, 24))}
        accessibilityLabel="What you do together"
        placeholder="e.g. Badminton, Karaoke, Bubble tea"
        placeholderTextColor={color.ink.subtle}
        className="min-h-min rounded-md border border-line-strong bg-page px-4 py-3 text-body text-ink-default"
      />
      <Stack gap={2}>
        <Text variant="micro" tone="subtle">HOW LONG IT USUALLY TAKES</Text>
        <Stack direction="row" gap={2} wrap>
          {ACTIVITY_HOURS.map((option) => (
            <Chip
              key={option}
              label={hoursLabel(option)}
              tone={option === hours ? 'selected' : 'plain'}
              onPress={() => { tapFeedback(); setHours(option); }}
            />
          ))}
        </Stack>
      </Stack>
      <Stack direction="row" gap={2} align="center">
        <Text variant="micro" tone="subtle">PREVIEW</Text>
        <View className="rounded-pill border border-recovery-fill bg-recovery-wash px-4 py-2">
          <Text variant="caption" tone="recovery">{emoji} {label.trim() || 'Your activity'} · {hoursLabel(hours)}</Text>
        </View>
      </Stack>
      <Stack direction="row" gap={2}>
        <Button label="Cancel" kind="quiet" className="flex-1" onPress={onCancel} />
        <Button
          label="Save it"
          kind={ready ? 'primary' : 'secondary'}
          className="flex-1"
          disabled={!ready}
          onPress={() => { if (ready) onMade({ label, emoji, hours }); }}
        />
      </Stack>
    </Stack>
  );
}
