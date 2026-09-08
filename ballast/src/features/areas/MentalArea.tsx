import { useState } from 'react';
import { color } from '@design/tokens';
import { Pressable, TextInput, View } from 'react-native';
import { Burst, Card, Chip, Divider, MoodGrid, Stack, Text, Button, quadrantLabel, quadrantTone } from '@/components';
import type { ContributionTag, MoodQuadrant } from '@/lib/types';
import { useStore } from '@/state/store';
import { readingFrom, useReading } from '@/state/selectors';
import { logItems } from '@/lib/logs';
import { MOMENT_KINDS, WHY_SUGGESTIONS, nextWorth } from '@/lib/moments';
import { successFeedback, tapFeedback } from '@/lib/haptics';

const TAGS: ContributionTag[] = ['Academics', 'Social', 'Finances', 'Health', 'Personal'];

/** Mental — a check-in that takes two taps and says more than a five-point scale. */
export function MentalArea() {
  const { items, ceilings, today, meals, moods, sleepHours, errands, moments, logMood, logMoment } = useStore();
  const reading = useReading();
  const todaysMoments = moments.filter((moment) => moment.date === today);
  const [picked, setPicked] = useState<string | null>(null);
  const [why, setWhy] = useState('');
  const [celebrating, setCelebrating] = useState(false);
  const kind = MOMENT_KINDS.find((k) => k.id === picked);
  const alreadyLogged = picked ? todaysMoments.filter((m) => m.kind === picked).length : 0;
  const [quadrant, setQuadrant] = useState<MoodQuadrant | null>(null);
  const [tags, setTags] = useState<ContributionTag[]>([]);

  /** The battery this check-in would produce, shown before it is logged. */
  const preview = (next: MoodQuadrant) =>
    readingFrom(
      [...items, ...logItems({
        today,
        sleepHours,
        meals,
        moods: [{ id: 'preview', date: today, at: 'now', quadrant: next, tags: [] }, ...moods.filter((m) => m.date !== today)],
        errands,
        moments,
      })],
      today,
      ceilings,
    ).charge;

  const toggle = (tag: ContributionTag) =>
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));

  return (
    <Stack gap={6}>
      <Card gap={5}>
        <Text variant="micro" tone="subtle">LOG YOUR MOOD</Text>
        <MoodGrid value={quadrant} onChange={setQuadrant} />
        {quadrant ? (
          <Stack gap={1} align="center" accessibilityLiveRegion="polite">
            <Text variant="heading" tone={quadrantTone(quadrant)}>{quadrantLabel(quadrant)}</Text>
            {/* What logging this would do, before you commit to it. */}
            <Text variant="micro" tone={preview(quadrant) >= reading.charge ? 'steady' : 'heavy'}>
              {preview(quadrant) === reading.charge
                ? 'No change to your battery'
                : `Battery would read ${preview(quadrant)}%`}
            </Text>
          </Stack>
        ) : null}
      </Card>

      <Card gap={4}>
        <Text variant="micro" tone="subtle">WHAT'S CONTRIBUTING?</Text>
        <Stack direction="row" gap={3} wrap>
          {TAGS.map((tag) => (
            <Chip
              key={tag}
              label={tag}
              tone={tags.includes(tag) ? 'selected' : 'plain'}
              onPress={() => toggle(tag)}
            />
          ))}
        </Stack>
        <Button
          label="Log check-in"
          onPress={() => {
            if (!quadrant) return;
            logMood(quadrant, tags);
            successFeedback();
            setQuadrant(null);
            setTags([]);
          }}
        />
      </Card>

      {/* The only input in the app that gives charge back. A battery that only
          ever falls is both bleak and inaccurate - days do go well, and a good
          one should be able to lift it a long way. */}
      <Stack gap={3}>
        <Text variant="micro" tone="subtle">SOMETHING GOOD HAPPENED?</Text>
        <Card gap={4}>
          <Stack direction="row" gap={3} wrap>
            {MOMENT_KINDS.map((option) => {
              const count = todaysMoments.filter((moment) => moment.kind === option.id).length;
              const worth = nextWorth(option, count);
              return (
                <Pressable
                  key={option.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: picked === option.id }}
                  accessibilityLabel={`${option.label}. ${option.note}. Worth ${worth} back.`}
                  onPress={() => {
                    tapFeedback();
                    setPicked(picked === option.id ? null : option.id);
                    setWhy('');
                  }}
                  className={`min-h-min flex-row items-center gap-2 rounded-pill border px-4 py-3 active:opacity-70 ${
                    picked === option.id
                      ? 'border-inverse bg-inverse'
                      : count > 0
                        ? 'border-steady-fill bg-steady-wash'
                        : 'border-line-hairline'
                  }`}
                >
                  <Text variant="body">{option.emoji}</Text>
                  <Text variant="caption" tone={picked === option.id ? 'inverse' : count > 0 ? 'steady' : 'muted'}>
                    {option.label}
                  </Text>
                  {count > 0 ? (
                    <Text variant="micro" tone={picked === option.id ? 'inverse' : 'steady'}>×{count}</Text>
                  ) : null}
                </Pressable>
              );
            })}
          </Stack>

          {/* Why, in your own words - the part worth reading back in a bad week. */}
          {kind ? (
            <Stack gap={4} className="rounded-md bg-sunken px-4 py-4">
              <Stack gap={1}>
                <Text variant="heading">{kind.emoji} {kind.label}</Text>
                <Text variant="footnote" tone="muted">{kind.note}</Text>
              </Stack>

              <Stack gap={2}>
                <Text variant="micro" tone="subtle">WHAT HAPPENED?</Text>
                <TextInput
                  value={why}
                  onChangeText={setWhy}
                  placeholder="In your own words — optional"
                  placeholderTextColor={color.ink.subtle}
                  accessibilityLabel="What happened"
                  className="min-h-min rounded-sm border border-line-hairline bg-page px-3 py-3 text-footnote text-ink-default"
                />
                <Stack direction="row" gap={2} wrap>
                  {(WHY_SUGGESTIONS[kind.id] ?? []).map((suggestion) => (
                    <Chip
                      key={suggestion}
                      label={suggestion}
                      tone={why === suggestion ? 'selected' : 'plain'}
                      onPress={() => { tapFeedback(); setWhy(suggestion); }}
                    />
                  ))}
                </Stack>
              </Stack>

              <Button
                label={`Log it — worth +${nextWorth(kind, alreadyLogged)}`}
                kind="steady"
                onPress={() => {
                  logMoment(kind.id, kind.bucket, kind.credit, why.trim() || undefined);
                  successFeedback();
                  setCelebrating(true);
                  setTimeout(() => setCelebrating(false), 2200);
                  setPicked(null);
                  setWhy('');
                }}
              />
              {alreadyLogged > 0 ? (
                <Text variant="micro" tone="subtle">
                  {alreadyLogged}× today, so this one is worth less than the first.
                </Text>
              ) : null}
            </Stack>
          ) : (
            <Text variant="footnote" tone="subtle">Pick one and say why.</Text>
          )}

          <Burst show={celebrating} label="Logged. Your battery went up." />

          {todaysMoments.length ? (
            <Stack gap={2}>
              <Text variant="micro" tone="subtle">TODAY'S GOOD BITS</Text>
              {todaysMoments.slice(-4).reverse().map((moment) => {
                const info = MOMENT_KINDS.find((k) => k.id === moment.kind);
                return (
                  <Text key={moment.id} variant="footnote" tone="muted">
                    {info?.emoji} {moment.note || info?.label}
                  </Text>
                );
              })}
            </Stack>
          ) : null}
        </Card>
      </Stack>

      <Stack gap={3}>
        <Text variant="micro" tone="subtle">RECENT CHECK-INS</Text>
        <Card pad={0} gap={0} className="px-5">
          {moods.slice(0, 5).map((entry, index) => (
            <Stack key={entry.id}>
              {index > 0 ? <Divider /> : null}
              <Stack gap={2} className="py-4" accessible accessibilityLabel={`${quadrantLabel(entry.quadrant)}, ${entry.at}`}>
                <Stack direction="row" justify="between" align="center" gap={3}>
                  <Text variant="callout" weight="semibold" tone={quadrantTone(entry.quadrant)}>
                    {quadrantLabel(entry.quadrant)}
                  </Text>
                  <Text variant="micro" tone="subtle">{entry.at}</Text>
                </Stack>
                {entry.tags.length ? (
                  <Stack direction="row" gap={2} wrap>
                    {entry.tags.map((tag) => <Chip key={tag} label={tag} readOnly />)}
                  </Stack>
                ) : null}
              </Stack>
            </Stack>
          ))}
        </Card>
      </Stack>
    </Stack>
  );
}
