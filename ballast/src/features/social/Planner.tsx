import { useMemo, useState } from 'react';
import { Linking, Pressable, TextInput, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Avatar, Button, Card, Chip, Section, Stack, Text } from '@/components';
import { color } from '@design/tokens';
import { addDays, formatShort } from '@/lib/dates';
import { successFeedback, tapFeedback } from '@/lib/haptics';
import { formatHour } from '@/lib/schedule';
import { PLAN_MESSAGE, whatsapp } from '@/lib/sharing';
import { everyoneFree, fitsWindow, heatmap, type HeatCell } from '@/lib/together';
import { useStore } from '@/state/store';
import { useItemsWithLogs } from '@/state/selectors';
import type { CircleMember, Group, Invite, PlanActivity } from '@/lib/types';
import { Heatmap } from './Heatmap';
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
  const { today, invites, sendInvite, planActivities, addActivity, removeActivity } = useStore();
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

  const [choice, setChoice] = useState<{ date: string; start: number } | null>(null);
  const [focus, setFocus] = useState<HeatCell | null>(null);
  const [week, setWeek] = useState(0);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(today, week * 7 + i)), [today, week]);
  const allDays = useMemo(() => Array.from({ length: 14 }, (_, i) => addDays(today, i)), [today]);
  const cells = useMemo(() => heatmap(items, chosen, days), [items, chosen, days]);
  const windows = useMemo(() => everyoneFree(items, chosen, allDays, plan.hours), [items, chosen, allDays, plan]);
  const mine = invites.filter((invite) => (group ? invite.groupId === group.id : !invite.groupId));

  const reset = () => { setChoice(null); setFocus(null); };

  const toggle = (id: string) => {
    tapFeedback();
    const current = picked ?? pool.map((person) => person.id);
    setPicked(current.includes(id) ? current.filter((p) => p !== id) : [...current, id]);
    reset();
  };

  const tapCell = (cell: HeatCell) => {
    tapFeedback();
    setFocus(cell);
    if (fitsWindow(windows, cell.date, cell.hour, plan.hours)) setChoice({ date: cell.date, start: cell.hour });
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

      {/* When: who is free, as a picture, and the times that work for everyone. */}
      <Section family="week" title="When" sticker="clock" meta={`${windows.length} option${windows.length === 1 ? '' : 's'}`}>
        {chosen.length ? (
          <Card gap={3}>
            <Stack direction="row" align="center" justify="between">
              <Text variant="heading">Who’s free when</Text>
              <Stack direction="row" gap={2}>
                <Chip label="This week" tone={week === 0 ? 'selected' : 'plain'} onPress={() => { tapFeedback(); setWeek(0); setFocus(null); }} />
                <Chip label="Next" tone={week === 1 ? 'selected' : 'plain'} onPress={() => { tapFeedback(); setWeek(1); setFocus(null); }} />
              </Stack>
            </Stack>
            <Heatmap cells={cells} hours={plan.hours} selected={choice} focus={focus} onTap={tapCell} />
          </Card>
        ) : null}

        <Text variant="micro" tone="subtle">WHEN EVERYONE IS FREE</Text>
        {windows.length === 0 ? (
          <Card tone="sunken" gap={1}>
            <Text variant="callout" weight="semibold">
              {chosen.length === 0 ? 'Pick someone first.' : `No ${hoursLabel(plan.hours)} window works for all ${chosen.length + 1}.`}
            </Text>
            <Text variant="footnote" tone="muted">Try something shorter, or fewer people.</Text>
          </Card>
        ) : (
          <Stack gap={2}>
            {windows.slice(0, 4).map((window) => {
              const on = choice?.date === window.date && choice?.start === window.start;
              return (
                <Pressable
                  key={`${window.date}-${window.start}`}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${formatShort(window.date)} at ${formatHour(window.start)}`}
                  onPress={() => { tapFeedback(); setChoice({ date: window.date, start: window.start }); }}
                  className={`min-h-row justify-center rounded-md border-2 px-4 py-3 ${
                    on ? 'border-steady-fill bg-steady-wash' : 'border-line-hairline bg-raised'
                  }`}
                >
                  <Stack direction="row" justify="between" align="center" gap={3}>
                    <Stack gap={1}>
                      <Text variant="body" weight="semibold">{formatShort(window.date)}</Text>
                      <Text variant="footnote" tone="subtle">
                        {formatHour(window.start)} – {formatHour(window.start + plan.hours)}
                      </Text>
                    </Stack>
                    <Chip label={`${chosen.length + 1} free`} tone={on ? 'steady' : 'plain'} readOnly />
                  </Stack>
                </Pressable>
              );
            })}
          </Stack>
        )}
      </Section>

      <Button
        label={choice ? `${plan.emoji} Invite ${chosen.length} to ${plan.label.toLowerCase()}` : 'Pick a time'}
        kind={choice ? 'steady' : 'secondary'}
        onPress={() => {
          if (!choice || !chosen.length) return;
          sendInvite({
            title: group
              ? `${plan.label} · ${group.name}${chosen.length < pool.length ? ` (${chosen.length} of ${pool.length})` : ''}`
              : `${plan.label} with ${chosen.map((f) => f.name).join(' and ')}`,
            date: choice.date,
            startHour: choice.start,
            hours: plan.hours,
            people: chosen.map((f) => f.id),
            groupId: group?.id,
          });
          successFeedback();
          reset();
        }}
      />

      {/*
        An invite that only exists in this app is not an invite. It lands in your
        week at once, but the people in it do not know yet - so the last step is
        a message, written for you.
      */}
      {mine.length ? <InvitedList invites={mine} /> : null}
    </Stack>
  );
}

/** Invites already made, each one message away from the people in it. */
export function InvitedList({ invites }: { invites: Invite[] }) {
  const router = useRouter();
  return (
    <Section family="people" title="Invited" sticker="chat" meta={`${invites.length}`}>
      {invites.map((invite) => (
        <Stack key={invite.id} gap={3} className="rounded-md bg-raised px-4 py-3">
          <Stack gap={1}>
            <Text variant="callout" weight="semibold">{invite.title}</Text>
            <Text variant="micro" tone="muted">{formatShort(invite.date)}, {formatHour(invite.startHour)} · in your week</Text>
          </Stack>
          <Stack direction="row" gap={2} wrap>
            <Chip
              label="✨ Write the invite"
              tone="selected"
              onPress={() => { tapFeedback(); router.push(`/message?kind=invite&invite=${encodeURIComponent(invite.id)}` as Href); }}
            />
            <Chip
              label="Send it as is"
              onPress={() => {
                Linking.openURL(whatsapp(PLAN_MESSAGE(`${formatShort(invite.date)} at ${formatHour(invite.startHour)}`, invite.people)));
                successFeedback();
              }}
            />
          </Stack>
        </Stack>
      ))}
    </Section>
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
