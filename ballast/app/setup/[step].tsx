import { useMemo, useState } from 'react';
import { Platform, Pressable, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import {
  Avatar, Button, Chip, Door, DrainBadge, DrainPicker, Mascot, PageHeader, Screen, Section, Stack, StepDots, StepNav, Sticker, Text,
  type StickerName,
} from '@/components';
import { color, radius } from '@design/tokens';
import { addDays, formatShort, startOfWeek } from '@/lib/dates';
import { frequentFriends } from '@/lib/circle';
import { VISIBILITY } from '@/lib/sharing';
import { COMMITMENT_LABEL } from '@/lib/load';
import type { CommitmentKind, Dread } from '@/lib/types';
import { successFeedback, tapFeedback } from '@/lib/haptics';
import { useStore } from '@/state/store';
import { ClassBuilder } from '@/features/timetable/ClassBuilder';
import { useReading } from '@/state/selectors';

const STEPS = ['timetable', 'tasks', 'friends', 'ready'] as const;
const LABELS = ['Timetable', 'Tasks', 'Friends', 'Ready'];

/** Every step, so `/setup/...` renders in the static export. */
export async function generateStaticParams() {
  return STEPS.map((step) => ({ step }));
}


const inputStyle = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : undefined;

/**
 * Setting up - four short steps after making an account.
 *
 * What a new student needs before the app can be any use: their classes, what
 * is on their plate, and their people. Each is one screen with one job, every
 * one skippable, and the last says the three things worth knowing - then opens
 * their week. A guest in a preview build walks the same steps with the sample
 * week already filled in.
 */
export default function Setup() {
  const router = useRouter();
  const { step } = useLocalSearchParams<{ step: string }>();
  const index = Math.max(0, STEPS.indexOf((step ?? 'timetable') as (typeof STEPS)[number]));
  const { finishOnboarding, modules, items, circle, today } = useStore();

  const go = (to: number) => { tapFeedback(); router.push(`/setup/${STEPS[to]}` as Href); };
  const finish = () => { finishOnboarding(); successFeedback(); router.replace('/'); };

  const friends = circle.filter((person) => !person.isYou).length;
  const tasks = items.filter((item) => item.date >= today && !item.moduleId && !item.repeats && !item.parentId && !item.isLog).length;
  const nextLabel = [
    modules.length ? 'Next: your tasks' : 'Skip for now',
    tasks ? 'Next: your friends' : 'Skip for now',
    friends ? 'Next' : 'Skip for now',
    'Open my week',
  ][index];

  return (
    <Screen
      footer={
        <StepNav
          step={index}
          last={STEPS.length - 1}
          nextLabel={nextLabel}
          onBack={() => go(index - 1)}
          onNext={() => (index === STEPS.length - 1 ? finish() : go(index + 1))}
        />
      }
    >
      <Stack gap={5} className="pt-2">
        <StepDots labels={LABELS} current={index} onJump={(to) => go(to)} />
        {index === 0 ? <TimetableStep /> : index === 1 ? <TasksStep /> : index === 2 ? <FriendsStep /> : <ReadyStep />}
        <View className="h-2" />
      </Stack>
    </Screen>
  );
}

/* --------------------------------------------------------------- timetable */

function TimetableStep() {
  return (
    <Stack gap={5}>
      <PageHeader sticker="class" wash={color.decor.lilac} title="Your timetable" sub="Add each module, then its classes." />
      <ClassBuilder />
    </Stack>
  );
}

/* ------------------------------------------------------------------- tasks */

const DUE = [
  { label: 'Tomorrow', days: 1 }, { label: 'In 3 days', days: 3 }, { label: 'Next week', days: 7 }, { label: 'In 2 weeks', days: 14 },
];
const WHEN = [{ label: 'Today', days: 0 }, { label: 'Tomorrow', days: 1 }, { label: 'This weekend', days: -1 }];
const NEEDS = [1, 2, 4, 8];
/** Whether it can move, at a glance. */
const MOVE_EMOJI: Record<CommitmentKind, string> = { hard: '🔒', soft: '↔️', self: '🙋' };
const TAKES = [0.25, 0.5, 1];

function TasksStep() {
  const { items, today, addItem } = useStore();
  const [kind, setKind] = useState<'owing' | 'errand'>('owing');
  const [title, setTitle] = useState('');
  const [days, setDays] = useState(3);
  const [hours, setHours] = useState(4);
  const [dread, setDread] = useState<Dread>(3);
  const [commitment, setCommitment] = useState<CommitmentKind>('soft');
  const weekend = addDays(startOfWeek(today), 5);

  const owing = items.filter((item) => item.prepHours && !item.parentId && (item.deadline ?? item.date) >= today);
  const errands = items.filter((item) => item.bucket === 'errands' && !item.repeats && item.date >= today && !item.parentId);

  const add = () => {
    const name = title.trim();
    if (!name) return;
    if (kind === 'owing') {
      const due = addDays(today, days);
      addItem({
        title: name, bucket: 'mental', hours, dread, commitment,
        date: due, deadline: due, prepHours: hours, prepDone: 0, importance: commitment === 'hard' ? 3 : 2,
      });
    } else {
      addItem({
        title: name, bucket: 'errands', hours, dread, commitment,
        date: days < 0 ? weekend : addDays(today, days),
      });
    }
    successFeedback();
    setTitle('');
  };

  const pick = (next: 'owing' | 'errand') => {
    tapFeedback();
    setKind(next);
    setDays(next === 'owing' ? 3 : 0);
    setHours(next === 'owing' ? 4 : 0.5);
    setDread(next === 'owing' ? 3 : 2);
    setCommitment(next === 'owing' ? 'soft' : 'self');
  };

  return (
    <Stack gap={5}>
      <PageHeader sticker="assignment" wash={color.decor.lemon} title="What’s on your plate?" sub="Add a few now. More any time." />

      {/* Two kinds of thing, as two big tiles. */}
      <Stack direction="row" gap={3}>
        <Kind on={kind === 'owing'} emoji="📚" title="Owing work" sub="Assignments, prep, revision" onPress={() => pick('owing')} />
        <Kind on={kind === 'errand'} emoji="🧺" title="Errand" sub="Quick things to get done" onPress={() => pick('errand')} />
      </Stack>

      <Stack gap={3} className="rounded-xl border border-line-hairline bg-raised px-4 py-4">
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder={kind === 'owing' ? 'Algorithms problem set' : 'Return the library books'}
          placeholderTextColor={color.ink.subtle}
          accessibilityLabel={kind === 'owing' ? 'What is the work' : 'What is the errand'}
          onSubmitEditing={add}
          className="min-h-row rounded-pill border-2 border-line-hairline bg-sunken px-5 py-3 text-body text-ink-default"
          style={inputStyle}
        />
        <Text variant="micro" tone="subtle">{kind === 'owing' ? 'DUE' : 'WHEN'}</Text>
        <Stack direction="row" gap={2} wrap>
          {(kind === 'owing' ? DUE : WHEN).map((option) => (
            <Chip key={option.label} label={option.label} tone={days === option.days ? 'selected' : 'plain'} onPress={() => { tapFeedback(); setDays(option.days); }} />
          ))}
        </Stack>
        <Text variant="micro" tone="subtle">{kind === 'owing' ? 'NEEDS' : 'TAKES'}</Text>
        <Stack direction="row" gap={2} wrap>
          {(kind === 'owing' ? NEEDS : TAKES).map((option) => (
            <Chip
              key={option}
              label={option < 1 ? `${option * 60}m` : `${option}h`}
              tone={hours === option ? 'selected' : 'plain'}
              onPress={() => { tapFeedback(); setHours(option); }}
            />
          ))}
        </Stack>
        {/* The two answers the priority list runs on. */}
        <Text variant="micro" tone="subtle">HOW DRAINING</Text>
        <DrainPicker compact value={dread} onChange={(next) => { setDread(next); }} />
        <Text variant="micro" tone="subtle">CAN IT MOVE?</Text>
        <Stack direction="row" gap={2} wrap>
          {(['hard', 'soft', 'self'] as CommitmentKind[]).map((option) => (
            <Chip
              key={option}
              label={`${MOVE_EMOJI[option]} ${COMMITMENT_LABEL[option]}`}
              tone={commitment === option ? 'selected' : 'plain'}
              onPress={() => { tapFeedback(); setCommitment(option); }}
            />
          ))}
        </Stack>
        <Button label={title.trim() ? `Add “${title.trim()}”` : 'Name it first'} kind={title.trim() ? 'primary' : 'secondary'} onPress={add} />
      </Stack>

      {owing.length || errands.length ? (
        <Section family="focus" title="On your plate" sticker="star" meta={`${owing.length + errands.length}`}>
          {[...owing.slice(0, 4), ...errands.slice(0, 3)].map((item) => (
            <Stack key={item.id} direction="row" gap={3} align="center" className="rounded-lg bg-raised px-3 py-2">
              <Text variant="heading">{item.prepHours ? '📚' : '🧺'}</Text>
              <Text variant="body" weight="semibold" className="flex-1" numberOfLines={1}>{item.title}</Text>
              <Text variant="micro" tone="muted">
                {item.prepHours ? `Due ${formatShort(item.deadline ?? item.date).slice(0, 3)} · ${item.prepHours}h` : formatShort(item.date).slice(0, 3)}
              </Text>
              <Text variant="micro">{MOVE_EMOJI[item.commitment]}</Text>
              <DrainBadge value={item.dread} />
            </Stack>
          ))}
          {owing.length + errands.length > 7 ? (
            <Text variant="micro" tone="subtle" className="text-center">+{owing.length + errands.length - 7} more</Text>
          ) : null}
        </Section>
      ) : null}
    </Stack>
  );
}

function Kind({ on, emoji, title, sub, onPress }: { on: boolean; emoji: string; title: string; sub: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: on }}
      accessibilityLabel={title}
      onPress={onPress}
      className={`min-h-row flex-1 items-center gap-1 rounded-xl border-2 px-3 py-4 active:opacity-70 ${on ? 'border-inverse bg-inverse' : 'border-line-hairline bg-raised'}`}
    >
      <Text variant="title">{emoji}</Text>
      <Text variant="callout" weight="bold" tone={on ? 'inverse' : 'default'}>{title}</Text>
      <Text variant="micro" tone={on ? 'inverse' : 'muted'} className="text-center">{sub}</Text>
    </Pressable>
  );
}

/* ----------------------------------------------------------------- friends */

function FriendsStep() {
  const router = useRouter();
  const { circle, sharing, setSharing } = useStore();
  const friends = circle.filter((person) => !person.isYou);
  const faces = frequentFriends(circle, 7).length ? frequentFriends(circle, 7) : friends.slice(0, 7);
  const choice = VISIBILITY.find((option) => option.value === sharing);

  return (
    <Stack gap={5}>
      <PageHeader sticker="people" wash={color.decor.candy} title="Bring your people" sub="See who’s free, and plan together." />

      <Door
        family="people"
        sticker="chat"
        title="Find friends"
        sub="From your contacts, or by email"
        onPress={() => router.push('/find-friends?from=setup' as Href)}
      />

      <Section family="people" title="Your circle" meta={`${friends.length}`}>
        {friends.length ? (
          <Stack direction="row" align="center">
            {faces.map((person, i) => (
              <View key={person.id} style={{ marginLeft: i ? -12 : 0, borderRadius: radius.pill, borderWidth: 2, borderColor: color.surface.page }}>
                <Avatar initials={person.initials} band={person.band} size={44} pic={person.pic} />
              </View>
            ))}
            {friends.length > faces.length ? (
              <Text variant="callout" weight="semibold" className="pl-3">+{friends.length - faces.length}</Text>
            ) : null}
          </Stack>
        ) : (
          <Text variant="footnote" tone="muted">No one yet.</Text>
        )}
      </Section>

      {/* What they see of you - worth choosing on purpose, before anyone looks. */}
      <Section family="you" title="What friends see" sticker="wave">
        <Stack direction="row" gap={2} wrap>
          {VISIBILITY.filter((option) => option.value !== 'custom').map((option) => (
            <Chip
              key={option.value}
              label={`${option.emoji} ${option.word}`}
              tone={sharing === option.value ? 'selected' : 'plain'}
              onPress={() => { tapFeedback(); setSharing(option.value); }}
            />
          ))}
        </Stack>
        {choice ? <Text variant="micro" tone="muted">{choice.note}</Text> : null}
      </Section>
    </Stack>
  );
}

/* ------------------------------------------------------------------- ready */

const TIPS: Array<{ sticker: StickerName; wash: string; title: string; sub: string }> = [
  { sticker: 'battery', wash: color.decor.mint, title: 'Your battery', sub: 'Hours × how draining. It falls as your week fills.' },
  { sticker: 'clock', wash: color.decor.sky, title: 'Tap a block to mark it', sub: 'Unmarked things count as done the next morning.' },
  { sticker: 'people', wash: color.decor.candy, title: 'Friends see your battery', sub: 'And your free time. Never your tasks.' },
];

function ReadyStep() {
  const reading = useReading();
  return (
    <Stack gap={5}>
      <View className="items-center gap-2 px-4 pb-5 pt-6" style={{ borderRadius: radius.xl, backgroundColor: color.decor.mint }}>
        <Mascot charge={reading.charge} loadPercent={reading.overall} size={112} />
        <Text variant="title" accessibilityRole="header">You’re set</Text>
        <Text variant="callout" weight="semibold">Your week is at {reading.charge}%.</Text>
      </View>
      <Stack gap={2}>
        {TIPS.map((tip) => (
          <Stack key={tip.title} direction="row" gap={3} align="center" className="rounded-lg border border-line-hairline bg-raised px-3 py-3">
            <View className="items-center justify-center rounded-pill" style={{ width: 44, height: 44, backgroundColor: tip.wash }}>
              <Sticker name={tip.sticker} size={28} />
            </View>
            <Stack gap={0} grow>
              <Text variant="body" weight="semibold">{tip.title}</Text>
              <Text variant="micro" tone="muted">{tip.sub}</Text>
            </Stack>
          </Stack>
        ))}
      </Stack>
    </Stack>
  );
}
