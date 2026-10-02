import { Pressable, View } from 'react-native';
import { Stack, Text } from '@/components';
import { color, radius } from '@design/tokens';
import { formatShort } from '@/lib/dates';
import { formatHour } from '@/lib/schedule';
import type { HeatCell } from '@/lib/together';

const TICKS = [9, 12, 15, 18, 21];
const LABEL = 46;

/**
 * When everyone is free, as a picture.
 *
 * Each square is an hour; the more of you are free, the deeper the blue, and an
 * hour that works for everybody turns green. A group chat spends forty messages
 * building this table in people's heads. Tap any square to see who is free
 * then; tap a green one and that is your time.
 */
export function Heatmap({
  cells,
  hours,
  selected,
  focus,
  onTap,
}: {
  cells: HeatCell[][];
  /** Length of the plan, so the chosen time is drawn at its real size. */
  hours: number;
  selected: { date: string; start: number } | null;
  focus: HeatCell | null;
  onTap: (cell: HeatCell) => void;
}) {
  return (
    <Stack gap={2}>
      <Stack direction="row" style={{ paddingLeft: LABEL }}>
        {TICKS.map((hour, i) => (
          // Fourteen hour columns, labelled every third: the last label spans two.
          <Text key={hour} variant="micro" tone="subtle" style={{ flex: i === TICKS.length - 1 ? 2 : 3 }}>{formatHour(hour)}</Text>
        ))}
      </Stack>
      {cells.map((row) => (
        <Stack key={row[0].date} direction="row" align="center">
          <Text variant="micro" weight="semibold" tone="muted" style={{ width: LABEL }}>{formatShort(row[0].date).slice(0, 6)}</Text>
          <Stack direction="row" gap={1} grow>
            {row.map((cell) => {
              const all = cell.free === cell.of;
              const share = cell.free / cell.of;
              const inChoice = selected?.date === cell.date && cell.hour >= selected.start && cell.hour < selected.start + hours;
              const focused = focus?.date === cell.date && focus.hour === cell.hour;
              return (
                <Pressable
                  key={cell.hour}
                  accessibilityRole="button"
                  accessibilityLabel={`${formatShort(cell.date)} ${formatHour(cell.hour)}, ${cell.free} of ${cell.of} free`}
                  onPress={() => onTap(cell)}
                  style={{
                    flex: 1, height: 24,
                    borderRadius: radius.sm / 2,
                    backgroundColor: all ? color.band.steady.fill : cell.free ? color.band.recovery.fill : color.surface.sunken,
                    opacity: all || !cell.free ? 1 : 0.25 + share * 0.6,
                    borderWidth: inChoice || focused ? 2 : 0,
                    borderColor: color.ink.default,
                  }}
                />
              );
            })}
          </Stack>
        </Stack>
      ))}
      <Stack direction="row" gap={4} align="center" style={{ paddingLeft: LABEL }}>
        <Key fill={color.surface.sunken} label="Nobody" />
        <Key fill={color.band.recovery.fill} label="Some" faded />
        <Key fill={color.band.steady.fill} label="Everyone" />
      </Stack>
      {focus ? (
        <View className="rounded-md px-3 py-2" style={{ backgroundColor: focus.free === focus.of ? color.band.steady.wash : color.surface.sunken }}>
          <Text variant="footnote" weight="semibold">
            {formatShort(focus.date)}, {formatHour(focus.hour)} · {focus.free} of {focus.of} free
          </Text>
          <Text variant="micro" tone="muted">{focus.who.length ? focus.who.join(', ') : 'Nobody has this hour free.'}</Text>
        </View>
      ) : null}
    </Stack>
  );
}

function Key({ fill, label, faded }: { fill: string; label: string; faded?: boolean }) {
  return (
    <Stack direction="row" gap={1} align="center">
      <View style={{ width: 12, height: 12, borderRadius: radius.sm / 2, backgroundColor: fill, opacity: faded ? 0.55 : 1 }} />
      <Text variant="micro" tone="subtle">{label}</Text>
    </Stack>
  );
}

