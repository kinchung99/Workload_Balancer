import { useState } from 'react';
import { Card, Chip, Divider, MoodGrid, Stack, Text, Button, quadrantLabel, quadrantTone } from '@/components';
import type { ContributionTag, MoodQuadrant } from '@/lib/types';
import { useStore } from '@/state/store';
import { readingFrom, useReading } from '@/state/selectors';
import { logItems } from '@/lib/logs';
import { successFeedback } from '@/lib/haptics';

const TAGS: ContributionTag[] = ['Academics', 'Social', 'Finances', 'Health', 'Personal'];

/** Mental — a check-in that takes two taps and says more than a five-point scale. */
export function MentalArea() {
  const { items, ceilings, today, meals, moods, sleepHours, logMood } = useStore();
  const reading = useReading();
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
