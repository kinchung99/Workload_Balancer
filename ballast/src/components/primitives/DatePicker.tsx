/**
 * Control / Date picker.
 *
 * A row of the next ten days is fine for "when shall I do this" and useless for
 * "when is it due" — deadlines are months out as often as they are days. This is
 * a month grid you can page through, plus a typed entry for anyone who already
 * knows the date and would rather not tap.
 */
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { color } from '@design/tokens';
import { addDays, dayIndex, parseISO, toISO } from '@/lib/dates';
import { tapFeedback } from '@/lib/haptics';
import { Chip } from './Chip';
import { Stack } from './Stack';
import { Text } from './Text';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const startOfMonth = (iso: string): string => `${iso.slice(0, 7)}-01`;

function monthGrid(anchor: string): Array<string | null> {
  const first = parseISO(startOfMonth(anchor));
  const year = first.getUTCFullYear();
  const month = first.getUTCMonth();
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const lead = dayIndex(toISO(first));
  return [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: days }, (_, i) => toISO(new Date(Date.UTC(year, month, i + 1)))),
  ];
}

const shiftMonth = (iso: string, by: number): string => {
  const date = parseISO(startOfMonth(iso));
  date.setUTCMonth(date.getUTCMonth() + by);
  return toISO(date);
};

export function DatePicker({
  value,
  min,
  onChange,
}: {
  value: string;
  /** Nothing before this can be picked. Deadlines in the past are not deadlines. */
  min: string;
  onChange: (date: string) => void;
}) {
  const [month, setMonth] = useState(startOfMonth(value));
  const [typed, setTyped] = useState('');

  const commitTyped = (text: string) => {
    // Accept 2026-03-14 or 14/3 or 14/3/2026, because people type what they know.
    const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const slash = text.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
    let next: string | null = null;
    if (iso) next = text;
    else if (slash) {
      const year = slash[3] ? Number(slash[3].length === 2 ? `20${slash[3]}` : slash[3]) : parseISO(min).getUTCFullYear();
      next = `${year}-${String(Number(slash[2])).padStart(2, '0')}-${String(Number(slash[1])).padStart(2, '0')}`;
    }
    if (next && !Number.isNaN(parseISO(next).getTime()) && next >= min) {
      onChange(next);
      setMonth(startOfMonth(next));
      setTyped('');
    }
  };

  return (
    <Stack gap={3}>
      <Stack direction="row" gap={2} align="center" justify="between">
        <Chip label="‹" onPress={() => { tapFeedback(); setMonth(shiftMonth(month, -1)); }} accessibilityHint="Previous month" />
        <Text variant="footnote" weight="semibold">
          {MONTHS[parseISO(month).getUTCMonth()]} {parseISO(month).getUTCFullYear()}
        </Text>
        <Chip label="›" onPress={() => { tapFeedback(); setMonth(shiftMonth(month, 1)); }} accessibilityHint="Next month" />
      </Stack>

      <Stack direction="row" gap={1}>
        {LETTERS.map((letter, index) => (
          <View key={index} className="flex-1 items-center">
            <Text variant="micro" tone="subtle">{letter}</Text>
          </View>
        ))}
      </Stack>

      <Stack gap={1}>
        {Array.from({ length: Math.ceil(monthGrid(month).length / 7) }, (_, row) => (
          <Stack key={row} direction="row" gap={1}>
            {monthGrid(month).slice(row * 7, row * 7 + 7).map((date, column) => {
              if (!date) return <View key={`empty-${column}`} className="flex-1" />;
              const disabled = date < min;
              const selected = date === value;
              return (
                <Pressable
                  key={date}
                  accessibilityRole="button"
                  accessibilityState={{ selected, disabled }}
                  accessibilityLabel={date}
                  disabled={disabled}
                  onPress={() => { tapFeedback(); onChange(date); }}
                  className={`min-h-min flex-1 items-center justify-center rounded-sm py-2 ${
                    selected ? 'bg-inverse' : disabled ? '' : 'bg-sunken'
                  }`}
                >
                  <Text variant="footnote" tone={selected ? 'inverse' : disabled ? 'subtle' : 'default'}>
                    {parseISO(date).getUTCDate()}
                  </Text>
                </Pressable>
              );
            })}
          </Stack>
        ))}
      </Stack>

      <Stack direction="row" gap={2} align="center">
        <TextInput
          value={typed}
          onChangeText={setTyped}
          onSubmitEditing={(event) => commitTyped(event.nativeEvent.text.trim())}
          onEndEditing={(event) => commitTyped(event.nativeEvent.text.trim())}
          placeholder="or type 14/3"
          placeholderTextColor={color.ink.subtle}
          accessibilityLabel="Type a date"
          className="min-h-min flex-1 rounded-sm border border-line-hairline bg-page px-3 py-2 text-footnote text-ink-default"
        />
        <Chip label="Today + 7" onPress={() => { tapFeedback(); onChange(addDays(min, 7)); setMonth(startOfMonth(addDays(min, 7))); }} />
      </Stack>
    </Stack>
  );
}
