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
  committedOnDay, composition, daysLeft, isAtRisk, percentUndone, percentUnplanned, planSessions,
  remaining, scheduledHours, sittingsOf, unplanned, unplaced,
} from '@/lib/prep';
import { formatHour, startOptions } from '@/lib/schedule';
import { addDays, formatShort } from '@/lib/dates';
import { BUCKET_LABEL } from '@/lib/load';
import { color } from '@design/tokens';
import { tapFeedback } from '@/lib/haptics';
import type { Item } from '@/lib/types';
import { Chip } from '../primitives/Chip';
import { Sticker } from '../primitives/Sticker';
import { Stack } from '../primitives/Stack';
import { Text } from '../primitives/Text';

const UNBOOKED = [0.5, 1, 2];

export interface TodoListProps {
  todo: Item[];
  items: Item[];
  today: string;
  date: string;
  onSchedule: (item: Item, startHour: number, hours: number, note?: string) => void;
  onPlan: (item: Item, sessions: Array<{ date: string; startHour: number; hours: number }>) => void;
  /** Move this day's sittings to another day. The deadline itself never moves. */
  onDefer: (item: Item, date: string) => void;
  /** Tick a booked sitting off. Its hours become progress on the parent. */
  onDone: (sessionId: string) => void;
  /** Hours done without booking a sitting first, which happens. */
  onUnbooked: (item: Item, hours: number) => void;
  onUnschedule: (sessionId: string) => void;
  onNote: (sessionId: string, note: string) => void;
}

export function TodoList({
  todo, items, today, date, onSchedule, onPlan, onDefer, onDone, onUnbooked, onUnschedule, onNote,
}: TodoListProps) {
  // Two panels, opened separately: planning is a different job from recording
  // progress, and stacking them made one very long sheet nobody scrolled.
  const [open, setOpen] = useState<{ id: string; panel: 'plan' | 'sittings' } | null>(null);
  const [manual, setManual] = useState(false);
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
        const planning = open?.id === item.id && open.panel === 'plan';
        const tracking = open?.id === item.id && open.panel === 'sittings';
        const sittingsToday = items.filter((i) => i.parentId === item.id && i.date === date);
        const sessions = sittingsOf(item, items);
        const ticked = sessions.filter((session) => session.sessionDone).length;
        const slots = startOptions(items, date, Math.min(draftHours, Math.max(loose, 0.5)), 6);
        const plan = planSessions(item, items, date);
        const short = unplaced(item, plan);

        return (
          <Stack
            key={item.id}
            gap={4}
            className={`rounded-lg border-2 px-4 py-4 ${risk ? 'border-heavy-fill bg-heavy-wash' : 'border-line-hairline bg-raised'}`}
          >
            <Stack direction="row" gap={3} align="center">
              {/* A piece of work, drawn. Same language as the rest of the app. */}
              <View
                className="items-center justify-center rounded-pill"
                style={{ width: 40, height: 40, backgroundColor: risk ? color.decor.blush : color.decor.candy }}
              >
                <Sticker name={risk ? 'wall' : 'assignment'} size={27} />
              </View>
              <Stack gap={1} grow>
                <Text variant="body" weight="semibold">{item.title}</Text>
                <Text variant="micro" tone={due <= 1 ? 'heavy' : 'subtle'}>
                  {due === 0 ? 'Due today' : due === 1 ? 'Due tomorrow' : `${due} days left`} · {left}h to go
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
            <Stack gap={3}>
              <View className="h-4 w-full flex-row overflow-hidden rounded-pill bg-track">
                <View style={{ flexGrow: parts.done || 0.0001, backgroundColor: color.band.steady.fill }} />
                <View style={{ flexGrow: parts.scheduled || 0.0001, backgroundColor: color.band.recovery.fill }} />
                <View style={{ flexGrow: parts.unplanned || 0.0001, backgroundColor: color.surface.track }} />
              </View>
              {/* A key, because three colours with no legend is a puzzle. */}
              <Stack direction="row" gap={4} wrap>
                {([
                  [color.band.steady.fill, `${item.prepDone ?? 0}h done`, 'steady'],
                  [color.band.recovery.fill, `${booked}h booked`, 'recovery'],
                  [color.surface.track, `${loose}h loose`, 'subtle'],
                ] as const).map(([dot, label, tone]) => (
                  <Stack key={label} direction="row" gap={2} align="center">
                    <View style={{ width: 9, height: 9, borderRadius: 999, backgroundColor: dot }} />
                    <Text variant="micro" tone={tone}>{label}</Text>
                  </Stack>
                ))}
              </Stack>
            </Stack>

            {risk ? (
              <Stack direction="row" gap={3} align="center" className="rounded-md bg-heavy-wash px-3 py-3">
                <Sticker name="wall" size={26} />
                <Text variant="micro" tone="heavy" className="flex-1">
                  Not enough free time left. Something has to move.
                </Text>
              </Stack>
            ) : null}

            <Stack direction="row" gap={2} wrap>
              <Chip
                label={planning ? 'Close' : 'Plan it'}
                tone={planning ? 'selected' : 'steady'}
                onPress={() => {
                  tapFeedback();
                  setOpen(planning ? null : { id: item.id, panel: 'plan' });
                  setManual(false);
                  setDraftNote('');
                }}
              />
              {/* Sittings are folded away by default. Three pieces of work with
                  four sittings each is twelve open rows on one screen, which is
                  what the day list looked like before. */}
              {sessions.length ? (
                <Chip
                  label={tracking ? 'Close' : `Sittings · ${ticked}/${sessions.length} done`}
                  tone={tracking ? 'selected' : ticked === sessions.length ? 'steady' : 'recovery'}
                  onPress={() => { tapFeedback(); setOpen(tracking ? null : { id: item.id, panel: 'sittings' }); }}
                  accessibilityHint="Show the sittings you booked, and tick them off"
                />
              ) : null}
              {plan.length ? (
                <Chip
                  label={`Book ${plan.length} sitting${plan.length === 1 ? '' : 's'} for me`}
                  onPress={() => onPlan(item, plan)}
                  accessibilityHint={`Spreads ${loose} unplanned hours across the lightest days before it is due`}
                />
              ) : null}
              {sittingsToday.length ? (
                <Chip
                  label={`Push ${sittingsToday.length === 1 ? "today's sitting" : `${sittingsToday.length} sittings`} to tomorrow`}
                  onPress={() => onDefer(item, addDays(date, 1))}
                />
              ) : null}
            </Stack>

            {/* The sittings, and the only way progress moves. */}
            {tracking ? (
              <Stack gap={3} className="rounded-md bg-decor-cream px-4 py-4">
                <Stack direction="row" gap={2} align="center">
                  <Sticker name="calendar" size={20} />
                  <Text variant="micro" tone="subtle">
                    YOUR SITTINGS · {100 - percentUndone(item)}% DONE
                  </Text>
                </Stack>

                {sessions.map((session) => (
                  <Stack
                    key={session.id}
                    gap={3}
                    className={`rounded-md px-3 py-3 ${session.sessionDone ? 'bg-steady-wash' : 'bg-page'}`}
                  >
                    <Stack direction="row" gap={3} justify="between" align="center">
                      <Stack direction="row" gap={3} align="center" grow>
                        {session.sessionDone ? <Sticker name="star" size={22} /> : null}
                        <Text
                          variant="footnote"
                          weight="semibold"
                          tone={session.sessionDone ? 'steady' : 'recovery'}
                        >
                          {formatShort(session.date)} · {formatHour(session.startHour ?? 0)}–
                          {formatHour((session.startHour ?? 0) + session.hours)}
                        </Text>
                      </Stack>
                      <Text variant="micro" tone="subtle">{session.hours}h</Text>
                    </Stack>

                    {session.note && session.sessionDone ? (
                      <Text variant="micro" tone="subtle">{session.note}</Text>
                    ) : null}

                    {session.sessionDone ? (
                      <Text variant="micro" tone="steady">
                        Done — {session.hours}h went onto the bar.
                      </Text>
                    ) : (
                      <>
                        <TextInput
                          defaultValue={session.note}
                          onEndEditing={(event) => onNote(session.id, event.nativeEvent.text)}
                          placeholder="What are you aiming to get through?"
                          placeholderTextColor={color.ink.subtle}
                          accessibilityLabel={`Note for the sitting on ${formatShort(session.date)}`}
                          className="min-h-min rounded-sm border border-line-hairline bg-page px-3 py-2 text-footnote text-ink-default"
                        />
                        <Stack direction="row" gap={2} wrap>
                          <Chip
                            label={`Done · +${session.hours}h`}
                            tone="steady"
                            onPress={() => onDone(session.id)}
                            accessibilityHint={`Marks the ${formatShort(session.date)} sitting finished and moves the bar`}
                          />
                          <Chip label="Give it back" onPress={() => onUnschedule(session.id)} />
                        </Stack>
                      </>
                    )}
                  </Stack>
                ))}

                <Text variant="micro" tone="subtle">{left}h of {item.prepHours}h still to do.</Text>

                {/* Work happens without being booked, and it should still count. */}
                <Stack gap={2}>
                  <Text variant="micro" tone="subtle">DID SOME WITHOUT BOOKING IT?</Text>
                  <Stack direction="row" gap={2} wrap>
                    {UNBOOKED.filter((hours) => hours <= left).map((hours) => (
                      <Chip
                        key={hours}
                        label={`+${hours < 1 ? `${hours * 60}m` : `${hours}h`}`}
                        onPress={() => onUnbooked(item, hours)}
                      />
                    ))}
                  </Stack>
                </Stack>
              </Stack>
            ) : null}

            {planning ? (
              <Stack gap={4} className="rounded-md bg-decor-cream px-4 py-4">
                {plan.length ? (
                  <Stack gap={2}>
                    <Text variant="micro" tone="subtle">WHAT IT WOULD BOOK</Text>
                    {plan.map((session) => (
                      <Text key={`${session.date}-${session.startHour}`} variant="footnote" tone="muted">
                        {formatShort(session.date)} · {formatHour(session.startHour)}–
                        {formatHour(session.startHour + session.hours)} · {session.hours}h
                        {'  '}
                        <Text variant="micro" tone="subtle">
                          ({committedOnDay(items, session.date)}h already booked that day)
                        </Text>
                      </Text>
                    ))}
                    <Text variant="micro" tone="subtle">Lightest days first.</Text>
                    {short > 0 ? (
                      <Text variant="footnote" tone="heavy">{short}h will not fit before the deadline.</Text>
                    ) : null}
                  </Stack>
                ) : null}

                <Chip
                  label={manual ? 'Close' : 'Or book one yourself'}
                  tone={manual ? 'selected' : 'plain'}
                  onPress={() => { tapFeedback(); setManual(!manual); }}
                />

                {manual ? (
                <Stack gap={2}>
                  <Text variant="micro" tone="subtle">HOW LONG</Text>
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
                ) : null}
              </Stack>
            ) : null}
          </Stack>
        );
      })}
    </Stack>
  );
}
