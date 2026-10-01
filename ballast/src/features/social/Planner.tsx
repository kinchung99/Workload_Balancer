import { useMemo, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Avatar, Button, Card, Chip, Stack, Text } from '@/components';
import { color } from '@design/tokens';
import { addDays, formatShort } from '@/lib/dates';
import { successFeedback, tapFeedback } from '@/lib/haptics';
import { formatHour } from '@/lib/schedule';
import { PLAN_MESSAGE, whatsapp } from '@/lib/sharing';
import { everyoneFree, fitsWindow, heatmap, type HeatCell } from '@/lib/together';
import { useStore } from '@/state/store';
import { useItemsWithLogs } from '@/state/selectors';
import type { Group } from '@/lib/types';
import { Heatmap } from './Heatmap';

const TONE = { steady: 'steady', busy: 'busy', heavy: 'heavy', recovery: 'recovery' } as const;

export const PLANS = [
  { id: 'dinner', label: 'Dinner', emoji: '🍝', hours: 2 },
  { id: 'walk', label: 'A walk', emoji: '🚶', hours: 1 },
  { id: 'study', label: 'Study together', emoji: '📚', hours: 2 },
  { id: 'film', label: 'Film night', emoji: '🍿', hours: 3 },
  { id: 'trip', label: 'Day trip', emoji: '🚌', hours: 6 },
];

/**
 * Plan something with people - a group, or whoever you pick.
 *
 * Who is editable here, every time: add anyone from your circle, take anyone
 * off, or start from a group. Their battery sits next to their name the whole
 * time, because inviting the person at 8% to a day trip is not a kindness.
 *
 * Then it does the coordinating: a heatmap of who is free when, the windows that
 * work for everyone, and an invite that lands in your own week at once - and in
 * theirs once you send the message, which the app writes and you send.
 */
export function Planner({
  people,
  onAdd,
  onRemove,
  onUseGroup,
  group,
}: {
  people: string[];
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  /** Start from a group's members. Absent inside a group, where the group is the who. */
  onUseGroup?: (group: Group) => void;
  group?: Group;
}) {
  const router = useRouter();
  const { today, invites, sendInvite, circle, groups } = useStore();
  const items = useItemsWithLogs();
  const friends = useMemo(() => circle.filter((person) => !person.isYou), [circle]);
  const chosen = useMemo(() => friends.filter((person) => people.includes(person.id)), [friends, people]);
  const others = friends.filter((person) => !people.includes(person.id));

  const [plan, setPlan] = useState(PLANS[0]);
  const [choice, setChoice] = useState<{ date: string; start: number } | null>(null);
  const [focus, setFocus] = useState<HeatCell | null>(null);
  const [week, setWeek] = useState(0);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(today, week * 7 + i)), [today, week]);
  const allDays = useMemo(() => Array.from({ length: 14 }, (_, i) => addDays(today, i)), [today]);
  const cells = useMemo(() => heatmap(items, chosen, days), [items, chosen, days]);
  const windows = useMemo(() => everyoneFree(items, chosen, allDays, plan.hours), [items, chosen, allDays, plan]);
  const mine = invites.filter((invite) => (group ? invite.groupId === group.id : !invite.groupId));

  const tapCell = (cell: HeatCell) => {
    tapFeedback();
    setFocus(cell);
    if (fitsWindow(windows, cell.date, cell.hour, plan.hours)) setChoice({ date: cell.date, start: cell.hour });
  };

  return (
    <Stack gap={5}>
      {/* WHO: the people in it, removable, and everyone else, addable. */}
      <Stack gap={3}>
        <Text variant="micro" tone="subtle">WHO · {chosen.length + 1} WITH YOU</Text>
        {onUseGroup && groups.length ? (
          <Stack direction="row" gap={2} wrap>
            {groups.map((g) => (
              <Chip key={g.id} label={`${g.emoji} ${g.name}`} onPress={() => { tapFeedback(); onUseGroup(g); setChoice(null); }} />
            ))}
          </Stack>
        ) : null}
        {chosen.length ? (
          <Stack direction="row" gap={3} wrap>
            {chosen.map((person) => (
              <View key={person.id} className="items-center gap-1 rounded-lg border-2 border-inverse bg-sunken px-3 py-3" style={{ width: 92 }}>
                <Avatar initials={person.initials} band={person.band} size={42} />
                <Text variant="caption" weight="semibold">{person.name}</Text>
                <Text variant="micro" tone={TONE[person.band]}>{person.charge}%</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${person.name}`}
                  onPress={() => { tapFeedback(); onRemove(person.id); setChoice(null); setFocus(null); }}
                  className="absolute items-center justify-center rounded-pill bg-raised active:opacity-60"
                  style={{ top: -8, right: -8, width: 26, height: 26, borderWidth: 1.5, borderColor: color.ink.default }}
                >
                  <Text variant="micro" weight="bold">✕</Text>
                </Pressable>
              </View>
            ))}
          </Stack>
        ) : (
          <Card tone="sunken" gap={1}>
            <Text variant="callout" weight="semibold">Just you so far.</Text>
            <Text variant="footnote" tone="muted">Add someone below.</Text>
          </Card>
        )}
        {others.length ? (
          <Stack gap={2}>
            <Text variant="micro" tone="subtle">ADD SOMEONE</Text>
            {others.map((person) => (
              <Pressable
                key={person.id}
                accessibilityRole="button"
                accessibilityLabel={`Add ${person.name}, ${person.charge}% battery`}
                onPress={() => { tapFeedback(); onAdd(person.id); setChoice(null); }}
                className="active:opacity-70"
              >
                <Stack direction="row" gap={3} align="center" className="rounded-md border border-line-hairline px-3 py-2">
                  <Avatar initials={person.initials} band={person.band} size={32} />
                  <Text variant="callout" weight="semibold" className="flex-1">{person.name}</Text>
                  <Text variant="footnote" tone={TONE[person.band]}>{person.charge}%</Text>
                  <View className="rounded-pill bg-inverse px-3 py-1">
                    <Text variant="micro" tone="inverse">＋ Add</Text>
                  </View>
                </Stack>
              </Pressable>
            ))}
          </Stack>
        ) : null}
      </Stack>

      <Stack gap={3}>
        <Text variant="micro" tone="subtle">WHAT</Text>
        <Stack direction="row" gap={2} wrap>
          {PLANS.map((option) => (
            <Chip
              key={option.id}
              label={`${option.emoji} ${option.label} · ${option.hours}h`}
              tone={option.id === plan.id ? 'selected' : 'plain'}
              onPress={() => { tapFeedback(); setPlan(option); setChoice(null); }}
            />
          ))}
        </Stack>
      </Stack>

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

      <Stack gap={3}>
        <Text variant="micro" tone="subtle">
          WHEN EVERYONE IS FREE · {windows.length} OPTION{windows.length === 1 ? '' : 'S'}
        </Text>
        {windows.length === 0 ? (
          <Card tone="sunken" gap={2}>
            <Text variant="callout" weight="semibold">
              {chosen.length === 0 ? 'Pick someone first.' : `No ${plan.hours}h window works for all ${chosen.length + 1}.`}
            </Text>
            <Text variant="footnote" tone="muted">
              {chosen.length > 1 ? 'Try a shorter plan, or fewer people.' : 'Try a shorter plan.'}
            </Text>
          </Card>
        ) : (
          <Stack gap={3}>
            {windows.slice(0, 4).map((window) => {
              const on = choice?.date === window.date && choice?.start === window.start;
              return (
                <Pressable
                  key={`${window.date}-${window.start}`}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${formatShort(window.date)} at ${formatHour(window.start)}`}
                  onPress={() => { tapFeedback(); setChoice({ date: window.date, start: window.start }); }}
                  className={`min-h-row justify-center rounded-md border-2 px-5 py-4 ${
                    on ? 'border-steady-fill bg-steady-wash' : 'border-line-hairline'
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
      </Stack>

      <Button
        label={choice ? `${plan.emoji} Invite ${chosen.length} to ${plan.label.toLowerCase()}` : 'Pick a time'}
        kind={choice ? 'steady' : 'secondary'}
        onPress={() => {
          if (!choice || !chosen.length) return;
          sendInvite({
            title: group ? `${plan.label} · ${group.name}` : `${plan.label} with ${chosen.map((f) => f.name).join(' and ')}`,
            date: choice.date,
            startHour: choice.start,
            hours: plan.hours,
            people: chosen.map((f) => f.id),
            groupId: group?.id,
          });
          successFeedback();
          setChoice(null);
        }}
      />

      {/*
        An invite that only exists in this app is not an invite. It lands in your
        week the moment you make it - time you have committed - but the people in
        it do not know yet. So the last step is a message, written for you.
      */}
      {mine.length ? (
        <Card tone="steady" gap={4}>
          <Text variant="micro" tone="steady">INVITED</Text>
          {mine.map((invite) => (
            <Stack key={invite.id} gap={3}>
              <Stack gap={1}>
                <Text variant="callout" weight="semibold">{invite.title}</Text>
                <Text variant="footnote" tone="muted">
                  {formatShort(invite.date)}, {formatHour(invite.startHour)} · already in your week
                </Text>
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
        </Card>
      ) : null}
    </Stack>
  );
}
