import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { BatteryMini, Button, Card, Chip, Stack, Text } from '@/components';
import { BAND_LABEL } from '@/lib/load';
import { formatHour, freeSlots, overlap, type Slot } from '@/lib/schedule';
import { formatShort } from '@/lib/dates';
import { successFeedback } from '@/lib/haptics';
import { circle } from '@/data/seed';
import { useStore } from '@/state/store';
import { useItemsWithLogs } from '@/state/selectors';

const RING = {
  steady: 'border-steady-fill', busy: 'border-busy-fill',
  heavy: 'border-heavy-fill', recovery: 'border-recovery-fill',
} as const;
const TONE = { steady: 'steady', busy: 'busy', heavy: 'heavy', recovery: 'recovery' } as const;

const PLANS = [
  { id: 'dinner', label: 'Dinner', hours: 2 },
  { id: 'walk', label: 'A walk', hours: 1 },
  { id: 'study', label: 'Study together', hours: 2 },
  { id: 'trip', label: 'Day trip', hours: 6 },
];

/**
 * Plan something.
 *
 * The obstacle to seeing people is not motivation, it is coordination between
 * several people who are all quietly assuming everyone else is busier than they
 * are. So this does the coordinating: pick who, and it intersects their free
 * evenings with the gaps in your own week and offers the times that actually
 * exist. Their battery is shown next to their name, because inviting the person
 * who is at 8% to a day trip is not a kindness.
 */
export function SocialPlanner() {
  const { today, invites, sendInvite } = useStore();
  const items = useItemsWithLogs();
  const friends = circle.filter((person) => !person.isYou);

  const [picked, setPicked] = useState<string[]>(['amin', 'ravi']);
  const [plan, setPlan] = useState(PLANS[0]);
  const [choice, setChoice] = useState<{ date: string; start: number } | null>(null);

  const toggle = (id: string) =>
    setPicked((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));

  /** Windows that work for everyone chosen, and for you. */
  const windows = useMemo(() => {
    const chosen = friends.filter((f) => picked.includes(f.id));
    if (!chosen.length) return [];
    const dates = [...new Set(chosen.flatMap((f) => (f.free ?? []).map((slot) => slot.date)))].sort();

    return dates.flatMap((date) => {
      const theirs = chosen.map((f) => (f.free ?? []).filter((s) => s.date === date).map(({ start, end }) => ({ start, end })));
      if (theirs.some((list) => list.length === 0)) return [];
      const mine: Slot[] = freeSlots(items, date, plan.hours);
      const shared = overlap([...theirs, mine], plan.hours);
      return shared.map((slot) => ({ date, start: slot.start, end: slot.end }));
    });
  }, [friends, picked, items, plan]);

  const already = invites.length > 0;

  return (
    <Stack gap={5}>
      <Stack gap={3}>
        <Text variant="micro" tone="subtle">WHO</Text>
        <Stack direction="row" gap={3} justify="between">
          {friends.map((person) => {
            const on = picked.includes(person.id);
            return (
              <Pressable
                key={person.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={`${person.name}, ${BAND_LABEL[person.band].toLowerCase()}, ${person.charge}% battery`}
                onPress={() => toggle(person.id)}
                className={`min-h-min flex-1 items-center gap-2 rounded-md border px-2 py-3 ${
                  on ? 'border-inverse bg-sunken' : 'border-line-hairline'
                }`}
              >
                <View className={`h-10 w-10 items-center justify-center rounded-pill border-2 ${RING[person.band]}`}>
                  <Text variant="footnote" weight="semibold" tone={TONE[person.band]}>{person.initials}</Text>
                </View>
                <Text variant="micro" tone="subtle">{person.name}</Text>
                <BatteryMini charge={person.charge ?? 50} loadPercent={100 - (person.charge ?? 50)} />
                <Text variant="micro" tone={TONE[person.band]}>{person.charge}%</Text>
              </Pressable>
            );
          })}
        </Stack>
      </Stack>

      <Stack gap={3}>
        <Text variant="micro" tone="subtle">WHAT</Text>
        <Stack direction="row" gap={3} wrap>
          {PLANS.map((option) => (
            <Chip
              key={option.id}
              label={`${option.label} · ${option.hours}h`}
              tone={option.id === plan.id ? 'selected' : 'plain'}
              onPress={() => { setPlan(option); setChoice(null); }}
            />
          ))}
        </Stack>
      </Stack>

      <Stack gap={3}>
        <Text variant="micro" tone="subtle">
          WHEN EVERYONE IS FREE · {windows.length} OPTION{windows.length === 1 ? '' : 'S'}
        </Text>
        {windows.length === 0 ? (
          <Card tone="sunken" gap={2}>
            <Text variant="callout" weight="semibold">
              {picked.length === 0 ? 'Pick someone first.' : `No ${plan.hours}h window works for all ${picked.length}.`}
            </Text>
            <Text variant="footnote" tone="muted">
              {picked.length > 1 ? 'Try a shorter plan, or fewer people.' : 'Try a shorter plan.'}
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
                  onPress={() => setChoice({ date: window.date, start: window.start })}
                  className={`min-h-row justify-center rounded-md border px-5 py-4 ${
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
                    <Chip label={`${picked.length + 1} free`} tone={on ? 'steady' : 'plain'} readOnly />
                  </Stack>
                </Pressable>
              );
            })}
          </Stack>
        )}
      </Stack>

      <Button
        label={choice ? `Invite ${picked.length} to ${plan.label.toLowerCase()}` : 'Pick a time'}
        kind={choice ? 'steady' : 'secondary'}
        onPress={() => {
          if (!choice) return;
          sendInvite({
            title: `${plan.label} with ${friends.filter((f) => picked.includes(f.id)).map((f) => f.name).join(' and ')}`,
            date: choice.date,
            startHour: choice.start,
            hours: plan.hours,
            people: picked,
          });
          successFeedback();
          setChoice(null);
        }}
      />

      {already ? (
        <Card tone="steady" gap={3}>
          <Text variant="micro" tone="steady">INVITED</Text>
          {invites.map((invite) => (
            <Stack key={invite.id} gap={1}>
              <Text variant="callout" weight="semibold">{invite.title}</Text>
              <Text variant="footnote" tone="muted">
                {formatShort(invite.date)}, {formatHour(invite.startHour)} · already in your week
              </Text>
            </Stack>
          ))}
        </Card>
      ) : null}
    </Stack>
  );
}
