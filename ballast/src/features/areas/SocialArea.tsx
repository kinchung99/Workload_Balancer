import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { successFeedback } from '@/lib/haptics';
import { Bar, Button, Card, Chip, Divider, Reveal, Stack, Text } from '@/components';
import { BAND_LABEL } from '@/lib/load';
import { circle, cohort } from '@/data/seed';
import { useStore } from '@/state/store';
import { SocialPlanner } from './SocialPlanner';

const RING = {
  steady: 'border-steady-fill', busy: 'border-busy-fill',
  heavy: 'border-heavy-fill', recovery: 'border-recovery-fill',
} as const;
const TONE = { steady: 'steady', busy: 'busy', heavy: 'heavy', recovery: 'recovery' } as const;

const STATE_LABEL = { none: 'Not yet', talked: 'Talked today', saw: 'Saw today' } as const;
const STATE_TONE = { none: 'plain', talked: 'steady', saw: 'recovery' } as const;

/**
 * Social — the gap since you last spoke, which is the thing nobody tracks, plus
 * the circle's bands and the cohort figure that says week 10 is like this for
 * everyone.
 */
export function SocialArea() {
  const router = useRouter();
  const { contacts, cycleContact, markContacted, logMoment } = useStore();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const sorted = [...contacts].sort((a, b) => b.lastSpokeDays - a.lastSpokeDays);
  const dropped = sorted[0];
  const noticed = circle.find((person) => !person.isYou && person.heavyForDays);

  return (
    <Stack gap={6}>
      {dropped && dropped.lastSpokeDays > 0 ? (
        <Card tone="recovery" gap={4}>
          <Text variant="micro" tone="recovery">LOW-EFFORT RECONNECTION</Text>
          <Stack gap={1}>
            <Text variant="heading">{dropped.name}</Text>
            <Text variant="footnote" tone="muted">{dropped.lastSpokeDays} days since you spoke</Text>
          </Stack>
          {sentTo === dropped.id ? (
            <Text variant="callout" weight="semibold" tone="recovery" accessibilityLiveRegion="polite">
              Copied. Send it whenever — the gap is reset either way.
            </Text>
          ) : (
            <Button
              label={`Send "Hey, thinking of you"`}
              onPress={async () => {
                // Drafts and copies. Ballast never sends anything itself.
                await Clipboard.setStringAsync(`Hey ${dropped.name.split(' ')[0]}, thinking of you. How have you been?`);
                markContacted(dropped.id);
                // Reaching someone is social recovery; the battery should say so.
                logMoment('good-chat', 'social', 3);
                successFeedback();
                setSentTo(dropped.id);
              }}
            />
          )}
        </Card>
      ) : null}

      <Stack gap={3}>
        <Text variant="micro" tone="subtle">CLOSE FRIENDS</Text>
        <Card pad={0} gap={0} className="px-5">
          {sorted.map((contact, index) => (
            <Stack key={contact.id}>
              {index > 0 ? <Divider /> : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${contact.name}, last spoke ${contact.lastSpokeDays} days ago, ${STATE_LABEL[contact.state]}`}
                accessibilityHint="Cycles between talked, saw and not yet"
                onPress={() => cycleContact(contact.id)}
                className="min-h-row flex-row items-center gap-4 py-4 active:opacity-70"
              >
                <View className="h-10 w-10 items-center justify-center rounded-pill bg-sunken">
                  <Text variant="callout" weight="semibold">{contact.initials}</Text>
                </View>
                <Stack gap={1} grow>
                  <Text variant="body" weight="semibold">{contact.name}</Text>
                  <Text variant="footnote" tone="subtle">
                    {contact.lastSpokeDays === 0 ? 'Today' : `Last spoke ${contact.lastSpokeDays} days ago`}
                  </Text>
                </Stack>
                <Chip label={STATE_LABEL[contact.state]} tone={STATE_TONE[contact.state]} readOnly />
              </Pressable>
            </Stack>
          ))}
        </Card>
      </Stack>

      {/* One word each. Never a task, never a number, never a mood. */}
      <Stack gap={3}>
        <Text variant="micro" tone="subtle">YOUR CIRCLE</Text>
        <Card gap={5}>
          <Stack direction="row" gap={3} justify="between">
            {circle.map((person) => (
              <Stack key={person.id} gap={2} align="center" accessible
                accessibilityLabel={`${person.name}, ${BAND_LABEL[person.band].toLowerCase()}`}>
                <View className={`h-11 w-11 items-center justify-center rounded-pill border-2 ${RING[person.band]}`}>
                  <Text variant="footnote" weight="semibold" tone={TONE[person.band]}>{person.initials}</Text>
                </View>
                <Text variant="micro" tone="subtle">{person.name}</Text>
              </Stack>
            ))}
          </Stack>
        </Card>
      </Stack>

      <Stack gap={3}>
        <Text variant="micro" tone="subtle">PLAN SOMETHING</Text>
        <Card gap={5}>
          <SocialPlanner />
        </Card>
      </Stack>

      <Card gap={4}>
        <Text variant="micro" tone="subtle">{cohort.label.toUpperCase()}</Text>
        <Stack direction="row" gap={4} align="center">
          <View className="flex-1"><Bar band="busy" percent={cohort.percent} /></View>
          <Text variant="heading" tone="busy">{cohort.percent}%</Text>
        </Stack>
        <Text variant="micro" tone="muted">Week 10 is like this every year.</Text>
      </Card>

      {noticed ? (
        <Card tone="sunken" gap={2}>
          <Text variant="footnote" tone="muted">
            {noticed.name} has been heavy for {noticed.heavyForDays} days. No prompt, no script, just so you know.
          </Text>
        </Card>
      ) : null}
    </Stack>
  );
}
