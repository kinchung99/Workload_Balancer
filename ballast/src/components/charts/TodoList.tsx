/**
 * Data / To-do list — work that is owing, not work that is today.
 *
 * A deadline is not a task. An assignment due Thursday is hours spread across
 * the days before Thursday, so it sits on every day's list until it is done.
 *
 * The bar tracks three things, because they are genuinely different states:
 * done, booked into a day, and neither. Booking a sitting takes work out of the
 * unplanned part even though none of it is finished yet, and giving the sitting
 * back puts it straight in again.
 */
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import {
  composition, daysLeft, isAtRisk, percentUndone, percentUnplanned, planSessions,
  remaining, scheduledHours, unplanned, unplaced,
} from '@/lib/prep';
import { formatHour, startOptions } from '@/lib/schedule';
import { addDays, formatShort } from '@/lib/dates';
import { BUCKET_LABEL } from '@/lib/load';
import { color } from '@design/tokens';
import { tapFeedback } from '@/lib/haptics';
import type { Item } from '@/lib/types';
import { Chip } from '../primitives/Chip';
import { Stack } from '../primitives/Stack';
import { Text } from '../primitives/Text';

const PERCENTS = [0, 10, 25, 50, 75, 90, 100];

export interface TodoListProps {
  todo: Item[];
  items: Item[];
  today: string;
  date: string;
  onSchedule: (item: Item, startHour: number, hours: number, note?: string) => void;
  onPlan: (item: Item, sessions: Array<{ date: string; startHour: number; hours: number }>) => void;
  onDefer: (item: Item, date: string) => void;
  onSetPercent: (item: Item, percent: number) => void;
  onUnschedule: (sessionId: string) => void;
  onNote: (sessionId: string, note: string) => void;
}

export function TodoList({
  todo, items, today, date, onSchedule, onPlan, onDefer, onSetPercent, onUnschedule, onNote,
}: TodoListProps) {
  const [open, setOpen] = useState<string | null>(null);
  const [draftNote, setDraftNote] = useState('');
  const [draftHours, setDraftHours] = useState(2);

  if (todo.length === 0) return null;

  return (
    <Stack gap={3}>
      {todo.map((item) => {
        const left = remaining(item);
        const loose = unplanned(item, items);
        const booked = scheduledHours(item, items);
        const parts = composition(item, items);
        const due = daysLeft(item, date);
        const risk = isAtRisk(item, items, date);
        const expanded = open === item.id;
        const sessions = items
          .filter((i) => i.parentId === item.id)
          .sort((a, b) => a.date.localeCompare(b.date) || (a.startHour ?? 0) - (b.startHour ?? 0));
        const slots = startOptions(items, date, Math.min(draftHours, Math.max(loose, 0.5)), 6);
        const plan = planSessions(item, items, date);
        const short = unplaced(item, plan);

        return (
          <Stack
            key={item.id}
            gap={3}
            className={`rounded-md border px-4 py-4 ${risk ? 'border-heavy-fill bg-heavy-wash' : 'border-line-hairline bg-raised'}`}
          >
            <Stack direction="row" gap={3} justify="between" align="start">
              <Stack gap={1} grow>
                <Text variant="body" weight="semibold">{item.title}</Text>
                <Text variant="micro" tone="subtle">
                  {BUCKET_LABEL[item.bucket]} · due {formatShort(item.deadline ?? item.date)} ·{' '}
                  {due === 0 ? 'today' : due === 1 ? 'tomorrow' : `${due} days left`}
                </Text>
              </Stack>
              <Stack gap={1} align="end">
                <Text variant="heading" tone={risk ? 'heavy' : loose > 0 ? 'busy' : 'steady'}>
                  {percentUnplanned(item, items)}%
                </Text>
                <Text variant="micro" tone="subtle">unplanned</Text>
              </Stack>
            </Stack>

            {/* Done, booked, and neither — three states, one bar. */}
            <View className="h-3 w-full flex-row overflow-hidden rounded-pill bg-track">
              <View style={{ flexGrow: parts.done || 0.0001, backgroundColor: color.band.steady.fill }} />
              <View style={{ flexGrow: parts.scheduled || 0.0001, backgroundColor: color.band.recovery.fill }} />
              <View style={{ flexGrow: parts.unplanned || 0.0001, backgroundColor: color.surface.track }} />
            </View>
            <Stack direction="row" gap={4} wrap>
              <Text variant="micro" tone="steady">{item.prepDone ?? 0}h done</Text>
              <Text variant="micro" tone="recovery">{booked}h booked</Text>
              <Text variant="micro" tone="subtle">{loose}h with no plan</Text>
            </Stack>

            {risk ? (
              <Text variant="micro" tone="heavy">
                There is not enough free time left before it is due. Something has to move.
              </Text>
            ) : null}

            <Stack direction="row" gap={2} wrap>
              <Chip
                label={expanded ? 'Close' : 'Plan it'}
                tone={expanded ? 'selected' : 'steady'}
                onPress={() => { tapFeedback(); setOpen(expanded ? null : item.id); setDraftNote(''); }}
              />
              {plan.length ? (
                <Chip
                  label={`Book ${plan.length} sitting${plan.length === 1 ? '' : 's'} for me`}
                  onPress={() => onPlan(item, plan)}
                  accessibilityHint={`Spreads ${loose} unplanned hours across the days before it is due`}
                />
              ) : null}
              <Chip label="Push to tomorrow" onPress={() => onDefer(item, addDays(date, 1))} />
            </Stack>

            {/* Sittings already booked, each with what it is for. */}
            {sessions.length ? (
              <Stack gap={2}>
                <Text variant="micro" tone="subtle">BOOKED SITTINGS</Text>
                {sessions.map((session) => (
                  <Stack key={session.id} gap={2} className="rounded-sm bg-recovery-wash px-3 py-3">
                    <Stack direction="row" gap={3} justify="between" align="center">
                      <Text variant="footnote" weight="semibold" tone="recovery">
                        {formatShort(session.date)} · {formatHour(session.startHour ?? 0)}–
                        {formatHour((session.startHour ?? 0) + session.hours)}
                      </Text>
                      <Chip label="Give it back" onPress={() => onUnschedule(session.id)} />
                    </Stack>
                    <TextInput
                      defaultValue={session.note}
                      onEndEditing={(event) => onNote(session.id, event.nativeEvent.text)}
                      placeholder="What are you aiming to get through?"
                      placeholderTextColor={color.ink.subtle}
                      accessibilityLabel={`Note for the sitting on ${formatShort(session.date)}`}
                      className="min-h-min rounded-sm border border-line-hairline bg-page px-3 py-2 text-footnote text-ink-default"
                    />
                  </Stack>
                ))}
              </Stack>
            ) : null}

            {expanded ? (
              <Stack gap={4} className="rounded-sm bg-sunken px-4 py-4">
                {plan.length ? (
                  <Stack gap={2}>
                    <Text variant="micro" tone="subtle">WHAT IT WOULD BOOK</Text>
                    {plan.map((session) => (
                      <Text key={`${session.date}-${session.startHour}`} variant="footnote" tone="muted">
                        {formatShort(session.date)} · {formatHour(session.startHour)}–
                        {formatHour(session.startHour + session.hours)} · {session.hours}h
                      </Text>
                    ))}
                    {short > 0 ? (
                      <Text variant="footnote" tone="heavy">{short}h will not fit before the deadline.</Text>
                    ) : null}
                  </Stack>
                ) : null}

                <Stack gap={2}>
                  <Text variant="micro" tone="subtle">OR BOOK ONE YOURSELF · HOW LONG</Text>
                  <Stack direction="row" gap={2} wrap>
                    {[1, 2, 3].filter((h) => h <= Math.max(loose, 1)).map((option) => (
                      <Chip
                        key={option}
                        label={`${option}h`}
                        tone={option === draftHours ? 'selected' : 'plain'}
                        onPress={() => { tapFeedback(); setDraftHours(option); }}
                      />
                    ))}
                  </Stack>
                  <TextInput
                    value={draftNote}
                    onChangeText={setDraftNote}
                    placeholder="Note — e.g. finish section 2"
                    placeholderTextColor={color.ink.subtle}
                    accessibilityLabel="Note for this sitting"
                    className="min-h-min rounded-sm border border-line-hairline bg-page px-3 py-2 text-footnote text-ink-default"
                  />
                  <Text variant="micro" tone="subtle">ON {formatShort(date).toUpperCase()}</Text>
                  <Stack direction="row" gap={2} wrap>
                    {slots.length ? (
                      slots.map((hour) => (
                        <Chip
                          key={hour}
                          label={formatHour(hour)}
                          onPress={() => {
                            onSchedule(item, hour, draftHours, draftNote.trim() || undefined);
                            setDraftNote('');
                            setOpen(null);
                          }}
                        />
                      ))
                    ) : (
                      <Text variant="footnote" tone="heavy">No gap on this day is {draftHours}h long.</Text>
                    )}
                  </Stack>
                </Stack>

                {/* Progress as a percentage, which is how people think about it. */}
                <Stack gap={2}>
                  <Text variant="micro" tone="subtle">HOW FAR THROUGH ARE YOU?</Text>
                  <Stack direction="row" gap={2} wrap>
                    {PERCENTS.map((percent) => (
                      <Chip
                        key={percent}
                        label={`${percent}%`}
                        tone={100 - percentUndone(item) === percent ? 'selected' : 'plain'}
                        onPress={() => onSetPercent(item, percent)}
                      />
                    ))}
                  </Stack>
                  <Text variant="micro" tone="subtle">
                    {100 - percentUndone(item)}% done — {left}h of {item.prepHours}h still to do.
                  </Text>
                </Stack>

                <Stack gap={2}>
                  <Text variant="micro" tone="subtle">OR DO IT ANOTHER DAY</Text>
                  <Stack direction="row" gap={2} wrap>
                    {[1, 2, 3].map((offset) => (
                      <Chip
                        key={offset}
                        label={formatShort(addDays(date, offset))}
                        onPress={() => { onDefer(item, addDays(date, offset)); setOpen(null); }}
                      />
                    ))}
                  </Stack>
                </Stack>
              </Stack>
            ) : null}
          </Stack>
        );
      })}
    </Stack>
  );
}
