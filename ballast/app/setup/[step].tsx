import { useMemo, useState } from 'react';
import { Platform, Pressable, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import {
  Avatar, Button, Chip, Door, Mascot, PageHeader, Screen, Section, Stack, StepDots, StepNav, Sticker, Text,
  type StickerName,
} from '@/components';
import { color, radius } from '@design/tokens';
import { addDays, formatShort, startOfWeek } from '@/lib/dates';
import { frequentFriends } from '@/lib/circle';
import { VISIBILITY } from '@/lib/sharing';
import { moduleEmoji, modulesFrom, parseTimetable, toItems } from '@/lib/timetable';
import { successFeedback, tapFeedback } from '@/lib/haptics';
import { useStore } from '@/state/store';
import { useReading } from '@/state/selectors';

const STEPS = ['timetable', 'tasks', 'friends', 'ready'] as const;
const LABELS = ['Timetable', 'Tasks', 'Friends', 'Ready'];

/** Every step, so `/setup/...` renders in the static export. */
export async function generateStaticParams() {
  return STEPS.map((step) => ({ step }));
}

const SAMPLE = `Mon 09:00-11:00 CS2040 Operating Systems Lecture Kilburn LT1
Tue 14:00-16:00 CS2011 Algorithms Lab in Lab A
Thu 8-10am CS2035 Networks Lecture Stopford TH2`;

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
  const { modules, items, today, importTimetable } = useStore();
  const [paste, setPaste] = useState('');
  const [weekNow, setWeekNow] = useState(1);
  const [replacing, setReplacing] = useState(false);
  const preview = useMemo(() => (paste.trim() ? parseTimetable(paste) : null), [paste]);
  const importing = useMemo(() => (preview?.classes.length ? toItems(preview.classes, today, 2) : []), [preview, today]);
  const start = addDays(startOfWeek(today), -(weekNow - 1) * 7);
  const found = useMemo(() => modulesFrom(importing, {}, {}, start), [importing, start]);
  const weekly = (id: string) => items.filter((item) => item.moduleId === id && item.date >= startOfWeek(today) && item.date < addDays(startOfWeek(today), 7)).length;

  return (
    <Stack gap={5}>
      <PageHeader sticker="class" wash={color.decor.lilac} title="Import your timetable" sub="Paste it from your student portal." />

      {modules.length && !replacing ? (
        <Section family="week" title="Your modules" sticker="class" meta={`${modules.length}`}>
          {modules.map((module) => (
            <Stack key={module.id} direction="row" gap={3} align="center" className="rounded-lg bg-raised px-3 py-2">
              <View className="items-center justify-center rounded-pill bg-sunken" style={{ width: 40, height: 40 }}>
                <Text variant="heading">{moduleEmoji(module)}</Text>
              </View>
              <Stack gap={0} grow>
                <Text variant="micro" tone="subtle">{module.code}</Text>
                <Text variant="body" weight="semibold">{module.name}</Text>
              </Stack>
              <Text variant="micro" tone="muted">{weekly(module.id)} a week</Text>
            </Stack>
          ))}
          <Chip label="Paste a new timetable" onPress={() => { tapFeedback(); setReplacing(true); }} />
        </Section>
      ) : (
        <Stack gap={3}>
          <TextInput
            value={paste}
            onChangeText={setPaste}
            multiline
            placeholder={SAMPLE}
            placeholderTextColor={color.ink.subtle}
            accessibilityLabel="Paste your timetable"
            className="rounded-lg border-2 border-line-hairline bg-sunken px-4 py-3 text-footnote text-ink-default"
            style={[{ minHeight: 140 }, inputStyle as object]}
          />
          {preview ? (
            <Stack gap={3}>
              <Stack direction="row" gap={2} wrap>
                <Chip label={`📚 ${preview.classes.length} classes`} tone="steady" readOnly />
                <Chip label={`🎓 ${found.length} modules`} tone="steady" readOnly />
                {preview.skipped.length ? <Chip label={`${preview.skipped.length} not read`} tone="heavy" readOnly /> : null}
              </Stack>
              {found.map((module) => (
                <Stack key={module.id} direction="row" gap={3} align="center" className="rounded-lg bg-raised px-3 py-2">
                  <Text variant="heading">{module.emoji}</Text>
                  <Text variant="body" weight="semibold" className="flex-1">{module.name}</Text>
                  <Text variant="micro" tone="muted">{module.code}</Text>
                </Stack>
              ))}
              {found.length ? (
                <Stack direction="row" gap={3} align="center" className="rounded-lg bg-sunken px-3 py-2">
                  <Text variant="callout" weight="semibold" className="flex-1">Teaching week now</Text>
                  <Nudge label="−" onPress={() => setWeekNow(Math.max(1, weekNow - 1))} />
                  <Text variant="callout" weight="bold">{weekNow}</Text>
                  <Nudge label="+" onPress={() => setWeekNow(Math.min(20, weekNow + 1))} />
                </Stack>
              ) : null}
              {preview.classes.length ? (
                <Button
                  label={`Import ${preview.classes.length} classes`}
                  onPress={() => {
                    importTimetable(importing, found);
                    successFeedback();
                    setPaste('');
                    setReplacing(false);
                  }}
                />
              ) : null}
            </Stack>
          ) : (
            <Text variant="micro" tone="subtle">One class per line: day, time, module, room.</Text>
          )}
        </Stack>
      )}
    </Stack>
  );
}

/* ------------------------------------------------------------------- tasks */

const DUE = [
  { label: 'Tomorrow', days: 1 }, { label: 'In 3 days', days: 3 }, { label: 'Next week', days: 7 }, { label: 'In 2 weeks', days: 14 },
];
const WHEN = [{ label: 'Today', days: 0 }, { label: 'Tomorrow', days: 1 }, { label: 'This weekend', days: -1 }];
const NEEDS = [1, 2, 4, 8];
const TAKES = [0.25, 0.5, 1];

function TasksStep() {
  const { items, today, addItem } = useStore();
  const [kind, setKind] = useState<'owing' | 'errand'>('owing');
  const [title, setTitle] = useState('');
  const [days, setDays] = useState(3);
  const [hours, setHours] = useState(4);
  const weekend = addDays(startOfWeek(today), 5);

  const owing = items.filter((item) => item.prepHours && !item.parentId && (item.deadline ?? item.date) >= today);
  const errands = items.filter((item) => item.bucket === 'errands' && !item.repeats && item.date >= today && !item.parentId);

  const add = () => {
    const name = title.trim();
    if (!name) return;
    if (kind === 'owing') {
      const due = addDays(today, days);
      addItem({
        title: name, bucket: 'mental', hours, dread: 3, commitment: 'soft',
        date: due, deadline: due, prepHours: hours, prepDone: 0, importance: 2,
      });
    } else {
      addItem({
        title: name, bucket: 'errands', hours, dread: 2, commitment: 'self',
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

function Nudge({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label === '+' ? 'One week later' : 'One week earlier'}
      onPress={() => { tapFeedback(); onPress(); }}
      className="items-center justify-center rounded-pill border border-line-strong bg-raised active:opacity-60"
      style={{ width: 32, height: 32 }}
    >
      <Text variant="callout" weight="bold">{label}</Text>
    </Pressable>
  );
}
