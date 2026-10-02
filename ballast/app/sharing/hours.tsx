import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, Chip, PageHeader, Screen, Stack, Text, Toggle } from '@/components';
import { color } from '@design/tokens';
import { formatShort } from '@/lib/dates';
import { SHARE_TEMPLATES, published } from '@/lib/sharing';
import { formatHour, freeSlots, slotHours, weekDays } from '@/lib/schedule';
import { successFeedback, tapFeedback } from '@/lib/haptics';
import { useStore } from '@/state/store';
import { useItemsWithLogs } from '@/state/selectors';
import { RangeBar } from '@/features/sharing/RangeBar';

const WINDOWS = [1, 2, 3];

/**
 * `/sharing/hours` — your own sharing rules, one day at a time.
 *
 * Each day is a range you drag, drawn over the time that is actually free that
 * day this week, so the solid part is literally what a friend will see. Editing
 * anything switches you to "Custom hours": nobody edits hours to have them
 * ignored.
 */
export default function ShareHours() {
  const router = useRouter();
  const { sharing, setSharing, shareRules, setShareDay, setShareRules, today } = useStore();
  const items = useItemsWithLogs();
  const days = weekDays(today);
  const custom = sharing === 'custom';

  const edit = (change: () => void) => {
    if (!custom) setSharing('custom');
    change();
  };

  const rules = shareRules;
  const shown = days.map((date) => published(items, date, 'custom', 1, rules));
  const total = shown.flat().reduce((hours, slot) => hours + slotHours(slot), 0);

  return (
    <Screen
      back="/sharing"
      backLabel="What they see"
      footer={
        <Button
          label={custom ? `Done · ${shown.flat().length} windows this week` : 'Use custom hours'}
          onPress={() => {
            if (!custom) { setSharing('custom'); successFeedback(); return; }
            router.back();
          }}
        />
      }
    >
      <Stack gap={5} className="pt-2">
        <PageHeader sticker="clock" wash={color.decor.lilac} eyebrow="Your privacy" title="Custom hours" sub="Solid blue is what friends see." />

        {!custom ? (
          <Card tone="busy" gap={2}>
            <Text variant="callout" weight="semibold">Not on yet</Text>
            <Text variant="footnote" tone="muted">Change anything here and your circle sees these hours instead.</Text>
          </Card>
        ) : null}

        <Stack gap={2}>
          <Text variant="micro" tone="subtle">START FROM</Text>
          <Stack direction="row" gap={2} wrap>
            {SHARE_TEMPLATES.map((template) => (
              <Chip
                key={template.id}
                label={`${template.emoji} ${template.label}`}
                onPress={() => { tapFeedback(); edit(() => setShareRules({ week: template.week })); }}
              />
            ))}
          </Stack>
        </Stack>

        <Card gap={4}>
          {days.map((date, index) => {
            const window = rules.week[index];
            return (
              <Stack key={date} gap={2}>
                <Stack direction="row" gap={3} align="center">
                  <Stack gap={1} grow>
                    <Text variant="body" weight="semibold">{formatShort(date).slice(0, 3)}{date === today ? ' · today' : ''}</Text>
                    <Text variant="micro" tone={window ? 'recovery' : 'subtle'}>
                      {window
                        ? `${formatHour(window.start)}–${formatHour(window.end)}${shown[index].length ? ` · ${shown[index].length} free window${shown[index].length === 1 ? '' : 's'}` : ' · nothing free this week'}`
                        : 'Never shared'}
                    </Text>
                  </Stack>
                  <Toggle
                    state={window ? 'on' : 'off'}
                    label={`Share ${formatShort(date).slice(0, 3)}`}
                    onPress={() => edit(() => setShareDay(index, window ? null : { start: 17, end: 23 }))}
                  />
                </Stack>
                {window ? (
                  <RangeBar
                    label={`${formatShort(date).slice(0, 3)} shared hours`}
                    value={window}
                    free={freeSlots(items, date, 0.5)}
                    shown={shown[index]}
                    onChange={(next) => edit(() => setShareDay(index, next))}
                  />
                ) : null}
              </Stack>
            );
          })}
          <Stack direction="row" justify="between" className="px-3">
            {[7, 11, 15, 19, 23].map((hour) => <Text key={hour} variant="micro" tone="subtle">{formatHour(hour)}</Text>)}
          </Stack>
        </Card>

        <Card gap={4}>
          <Stack gap={2}>
            <Text variant="micro" tone="subtle">SHORTEST WINDOW WORTH SHOWING</Text>
            <Stack direction="row" gap={2}>
              {WINDOWS.map((hours) => (
                <Chip
                  key={hours}
                  label={`${hours}h+`}
                  tone={rules.minHours === hours ? 'selected' : 'plain'}
                  onPress={() => { tapFeedback(); edit(() => setShareRules({ minHours: hours })); }}
                />
              ))}
            </Stack>
          </Stack>
          <Stack gap={2}>
            <Text variant="micro" tone="subtle">HOW FAR AHEAD</Text>
            <Stack direction="row" gap={2}>
              {([7, 14] as const).map((ahead) => (
                <Pressable
                  key={ahead}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: rules.ahead === ahead }}
                  onPress={() => { tapFeedback(); edit(() => setShareRules({ ahead })); }}
                  className={`min-h-min flex-1 items-center justify-center rounded-md border-2 py-3 ${rules.ahead === ahead ? 'border-inverse bg-decor-cream' : 'border-line-hairline'}`}
                >
                  <Text variant="callout" weight="semibold">{ahead === 7 ? 'One week' : 'Two weeks'}</Text>
                </Pressable>
              ))}
            </Stack>
          </Stack>
        </Card>

        <View className="rounded-lg px-4 py-4" style={{ backgroundColor: color.band.recovery.wash }}>
          <Text variant="footnote" tone="recovery">
            This week, friends would see {shown.flat().length} free window{shown.flat().length === 1 ? '' : 's'} · {Math.round(total)}h in all. Never what fills the rest.
          </Text>
        </View>
      </Stack>
    </Screen>
  );
}
