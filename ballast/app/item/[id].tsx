import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  AreaIcon, Button, Card, Chip, PageHeader, Screen, Stack, Sticker, Text,
} from '@/components';
import { color } from '@design/tokens';
import { BUCKET_LABEL, COMMITMENT_LABEL, describeMix, loadOf } from '@/lib/load';
import { needsPrep, remaining, sittingsOf } from '@/lib/prep';
import { formatHour, startOptions } from '@/lib/schedule';
import { addDays, formatShort } from '@/lib/dates';
import { successFeedback } from '@/lib/haptics';
import { useStore } from '@/state/store';
import { useItemsWithLogs } from '@/state/selectors';
import { flagInfo, isProtectedClass } from '@/lib/timetable';
import { LogTime, OwingSummary } from '@/features/item/Owing';
import { Sittings } from '@/features/item/Sittings';
import { DreadCard } from '@/features/item/Dread';

/**
 * Two real items, so `/item/...` renders in the static export rather than the
 * not-found state — one piece of owing work and one flagged class.
 */
export async function generateStaticParams() {
  return [{ id: 'algo-set' }, { id: 'class-os-0-9' }];
}

/**
 * One thing, and everything you can do to it.
 *
 * The lists used to carry their own controls: every owing card had Plan it,
 * Progress, Book sittings and Push, every timeline row had Move, Unschedule and
 * a slot picker. Three pieces of work on one day meant a dozen buttons on a
 * screen whose job was to tell you what your day looked like.
 *
 * So the lists are read-only now, and this is where the verbs live. Tap a row,
 * get a page. Nothing is hidden — it is one tap further away, and the screen you
 * came from is legible again.
 */
export default function ItemDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { today, scheduleItem, moveItem, customFlags } = useStore();
  const items = useItemsWithLogs();

  const item = items.find((candidate) => candidate.id === id);
  if (!item) {
    return (
      <Screen back="/plan" backLabel="Plan">
        <Stack gap={4} className="pt-6">
          <PageHeader sticker="cloud" wash={color.decor.sky} title="Not in your week" sub="It may have been done or given back." />
        </Stack>
      </Screen>
    );
  }

  const owing = needsPrep(item);
  /** Work that had preparation and has none left. Worth saying so, once. */
  const finished = !!item.prepHours && remaining(item) === 0;
  const ticked = sittingsOf(item, items).filter((s) => s.sessionDone).length;
  const slots = startOptions(items, item.date, item.hours);
  const locked = isProtectedClass(item) || item.commitment === 'hard';

  return (
    <Screen
      back="/plan"
      backLabel="Plan"
      footer={<Button label="Done" kind="secondary" onPress={() => router.back()} />}
    >
      <Stack gap={5} className="pt-2">
        <PageHeader
          sticker={owing || finished ? 'assignment' : item.isRecovery ? 'leaf' : item.moduleId ? 'class' : 'basket'}
          wash={color.area[item.bucket].wash}
          eyebrow={owing || finished ? `Due ${formatShort(item.deadline ?? item.date)}` : formatShort(item.date)}
          title={item.title}
          sub={describeMix(item.mix, item.bucket)}
          wiggle={false}
        />

        {/* What it is, before what you can do to it. */}
        <Card gap={4}>
          <Stack direction="row" gap={2} wrap>
            <View className="flex-row items-center gap-2 rounded-pill px-3 py-2" style={{ backgroundColor: color.area[item.bucket].wash }}>
              <AreaIcon area={item.bucket} size={15} />
              <Text variant="micro">{BUCKET_LABEL[item.bucket]}</Text>
            </View>
            <Chip label={`${loadOf(item)} load`} readOnly />
            <Chip label={COMMITMENT_LABEL[item.commitment]} tone={item.commitment === 'hard' ? 'heavy' : 'plain'} readOnly />
            {item.room ? <Chip label={item.room} readOnly /> : null}
            {item.startHour !== undefined ? (
              <Chip label={`${formatHour(item.startHour)}–${formatHour(item.startHour + item.hours)}`} readOnly />
            ) : finished ? null : (
              <Chip label="No time yet" tone="busy" readOnly />
            )}
          </Stack>
          {item.flags?.length ? (
            <Stack direction="row" gap={2} wrap>
              {item.flags.map((flag) => {
                const info = flagInfo(flag, customFlags);
                return info ? <Chip key={flag} label={`${info.emoji} ${info.label}`} tone={info.protect ? 'heavy' : 'plain'} readOnly /> : null;
              })}
            </Stack>
          ) : null}
          {locked ? (
            <Stack direction="row" gap={3} align="center" className="rounded-md bg-heavy-wash px-3 py-3">
              <Sticker name="wall" size={26} />
              <Text variant="micro" tone="heavy" className="flex-1">
                Locked. Nothing in this app will propose moving it.
              </Text>
            </Stack>
          ) : null}
        </Card>

        {/* Owing work: where it stands, when it happens, and what you did off-plan. */}
        {owing ? (
          <>
            <OwingSummary item={item} items={items} today={today} />
            <Sittings item={item} items={items} />
            <LogTime item={item} />
          </>
        ) : null}

        {finished ? (
          <Card tone="steady" gap={3}>
            <Stack direction="row" gap={4} align="center">
              <Sticker name="star" size={48} wiggle />
              <Stack gap={1} grow>
                <Text variant="heading" tone="steady">All {item.prepHours}h done</Text>
                <Text variant="footnote" tone="muted">
                  {ticked ? `${ticked} sitting${ticked === 1 ? '' : 's'} ticked off · ` : ''}Off every list.
                </Text>
              </Stack>
            </Stack>
          </Card>
        ) : null}

        {/* Anything with a slot, or wanting one. */}
        {!owing && !finished && !locked && !item.repeats ? (
          <Card gap={4}>
            <Text variant="heading">{item.startHour === undefined ? 'Give it a time' : 'Move it'}</Text>
            {slots.length ? (
              <Stack direction="row" gap={2} wrap>
                {slots.map((hour) => (
                  <Chip
                    key={hour}
                    label={formatHour(hour)}
                    tone={hour === item.startHour ? 'selected' : 'plain'}
                    onPress={() => { scheduleItem(item.id, hour); successFeedback(); }}
                  />
                ))}
              </Stack>
            ) : (
              <Text variant="footnote" tone="muted">
                No gap on {formatShort(item.date)} is {item.hours}h long. Try another day.
              </Text>
            )}
            <Stack direction="row" gap={2} wrap>
              {item.startHour !== undefined ? (
                <Chip label="Take the time away" onPress={() => { scheduleItem(item.id, undefined); successFeedback(); }} />
              ) : null}
              {Array.from({ length: 3 }, (_, offset) => addDays(today, offset + 1)).map((date) => (
                <Chip key={date} label={`Move to ${formatShort(date)}`} onPress={() => { moveItem(item.id, date); successFeedback(); }} />
              ))}
            </Stack>
          </Card>
        ) : null}

        {/* How much you mind it — the one number only you can set. */}
        {!item.isRecovery && !item.isLog ? <DreadCard item={item} items={items} /> : null}

        {!locked && item.commitment !== 'hard' && !item.repeats && !item.moduleId ? (
          <Button label="Write a message to get out of it" kind="secondary" onPress={() => router.push(`/decline/${item.id}`)} />
        ) : null}

        <View className="h-2" />
      </Stack>
    </Screen>
  );
}
