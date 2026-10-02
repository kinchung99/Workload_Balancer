import { View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import {
  AreaIcon, Button, Chip, Disclosure, Door, PageHeader, Screen, Section, Stack, Sticker, Text,
} from '@/components';
import { color } from '@design/tokens';
import { BUCKET_LABEL, COMMITMENT_LABEL, describeMix, loadOf } from '@/lib/load';
import { daysLeft, needsPrep, remaining, sittingsOf } from '@/lib/prep';
import { formatHour, startOptions } from '@/lib/schedule';
import { addDays, formatShort } from '@/lib/dates';
import { successFeedback } from '@/lib/haptics';
import { useStore } from '@/state/store';
import { useItemsWithLogs } from '@/state/selectors';
import { flagInfo, isProtectedClass } from '@/lib/timetable';
import { LogTime, OwingSummary } from '@/features/item/Owing';
import { SittingsPreview } from '@/features/item/Sittings';
import { DrainDisclosure } from '@/features/item/Dread';

/**
 * Two real items, so `/item/...` renders in the static export rather than the
 * not-found state — one piece of owing work and one flagged class.
 */
export async function generateStaticParams() {
  return [{ id: 'algo-set' }, { id: 'class-os-0-9' }];
}

/**
 * One thing, and everything you can do to it - in panels, not a pile.
 *
 * The page had grown a ring, a sittings planner, a time logger, a drain picker
 * and a decline button, all open at once. Now: the facts at the top; a Progress
 * panel (the ring, with "did some without booking it" folded inside); a
 * Sittings panel (the next few, one tap from done, and the way into the full
 * planner on its own page); how draining it is, folded to one row; and a door to
 * the message writer. Each panel is one family's colour, so the page reads as
 * four different things rather than eleven similar ones.
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
  const left = daysLeft(item, today);

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

        {/* The facts, in one row. */}
        <Stack gap={2}>
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
            {item.flags?.map((flag) => {
              const info = flagInfo(flag, customFlags);
              return info ? <Chip key={flag} label={`${info.emoji} ${info.short}`} tone={info.protect ? 'heavy' : 'plain'} readOnly /> : null;
            })}
          </Stack>
          {locked ? (
            <Stack direction="row" gap={3} align="center" className="rounded-md bg-heavy-wash px-3 py-2">
              <Sticker name="wall" size={22} />
              <Text variant="micro" tone="heavy" className="flex-1">Locked · never suggested for moving</Text>
            </Stack>
          ) : null}
        </Stack>

        {/* Owing work: how far along, then when the rest happens. */}
        {owing ? (
          <>
            <Section family="focus" title="Progress" meta={left === 0 ? 'Due today' : `${left} day${left === 1 ? '' : 's'} left`}>
              <OwingSummary item={item} items={items} today={today} />
              <Disclosure lead="⏱" title="Did some without booking it?" summary="Log time you already put in">
                <LogTime item={item} />
              </Disclosure>
            </Section>

            <Section family="week" title="Sittings" sticker="clock">
              <SittingsPreview
                item={item}
                items={items}
                onOpen={() => router.push(`/item/${item.id}/sittings` as Href)}
                onSuggest={() => router.push(`/item/${item.id}/sittings?suggest=1` as Href)}
              />
            </Section>
          </>
        ) : null}

        {finished ? (
          <Section family="focus" title={`All ${item.prepHours}h done`} meta={ticked ? `${ticked} sittings` : undefined}>
            <Stack direction="row" gap={4} align="center" className="rounded-md bg-raised px-4 py-3">
              <Sticker name="star" size={40} wiggle />
              <Text variant="footnote" tone="muted" className="flex-1">Off every list.</Text>
            </Stack>
          </Section>
        ) : null}

        {/* Anything with a slot, or wanting one. */}
        {!owing && !finished && !locked && !item.repeats ? (
          <Section family="week" title={item.startHour === undefined ? 'Give it a time' : 'Move it'} sticker="clock">
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
              <Text variant="footnote" tone="muted">No {item.hours}h gap on {formatShort(item.date)}.</Text>
            )}
            <Stack direction="row" gap={2} wrap>
              {item.startHour !== undefined ? (
                <Chip label="Take the time away" onPress={() => { scheduleItem(item.id, undefined); successFeedback(); }} />
              ) : null}
              {Array.from({ length: 3 }, (_, offset) => addDays(today, offset + 1)).map((date) => (
                <Chip key={date} label={`Move to ${formatShort(date)}`} onPress={() => { moveItem(item.id, date); successFeedback(); }} />
              ))}
            </Stack>
          </Section>
        ) : null}

        {/* How much you mind it — folded to one row until you want to change it. */}
        {!item.isRecovery && !item.isLog ? <DrainDisclosure item={item} items={items} /> : null}

        {!locked && item.commitment !== 'hard' && !item.repeats && !item.moduleId ? (
          <Door
            family="people"
            sticker="chat"
            title="Get out of it"
            sub="Write a message to get out of it"
            onPress={() => router.push(`/decline/${item.id}`)}
          />
        ) : null}

        <View className="h-2" />
      </Stack>
    </Screen>
  );
}
