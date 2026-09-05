import { useState } from 'react';
import { successFeedback } from '@/lib/haptics';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Battery, Button, Card, Chip, Divider, Screen, Slider, Stack, Text,
} from '@/components';
import { ACTIONS, initialSim, note, pointsOf, project, readout, totalPoints } from '@/lib/simulate';
import { CHARGE_LABEL, chargeOf } from '@/lib/battery';
import { bandFor } from '@/lib/load';
import { useStore, weekReading } from '@/state/store';

const TONE = { steady: 'steady', busy: 'busy', heavy: 'heavy' } as const;

/**
 * What if I… — the simulator.
 *
 * Drag a slider, watch the battery move. Sleep, walking and seeing people give
 * charge back; a study session and late-night screen time take it. Nothing here
 * is a health claim: these are coefficients for one student's week, not advice.
 */
export default function Actions() {
  const router = useRouter();
  const { items, ceilings, today, applyPlan } = useStore();
  const { overall } = weekReading(items, today, ceilings);

  const now = chargeOf(overall);
  const [sim, setSim] = useState(initialSim);
  const [committed, setCommitted] = useState<{ blocks: number; points: number } | null>(null);
  const projected = project(now, sim);
  const delta = totalPoints(sim);
  const projectedLoad = 100 - projected;

  // Only the actions that give charge back become blocks. A study session and
  // late-night scrolling are things you do, not things worth protecting time for.
  const gains = ACTIONS.filter((action) => pointsOf(action, sim[action.id]) > 0).map((action) => ({
    id: action.id,
    label: action.label,
    bucket: action.bucket,
    hours: action.unit === 'min' ? sim[action.id] / 60 : Math.max(0.5, sim[action.id] - action.baseline),
    credit: pointsOf(action, sim[action.id]),
  }));

  if (committed) {
    return (
      <Screen
        footer={
          <>
            <Button label="See the ledger" onPress={() => router.push('/recover')} />
            <Button
              label="Plan something else"
              kind="secondary"
              onPress={() => {
                setCommitted(null);
                setSim(initialSim());
              }}
            />
          </>
        }
      >
        <Stack gap={6} className="pt-8">
          <Text variant="micro" tone="steady">IN YOUR WEEK</Text>
          <Text variant="title" accessibilityRole="header" accessibilityLiveRegion="polite">
            {committed.blocks} block{committed.blocks === 1 ? '' : 's'} booked.
          </Text>
          <Card tone="steady" gap={3}>
            <Text variant="callout">
              They are protected time now. Rebalancing moves work around them, never through them.
            </Text>
            <Text variant="footnote" tone="muted">+{committed.points} charge points credited to the ledger.</Text>
          </Card>
        </Stack>
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <>
          <Button
            label={gains.length ? `Put ${gains.length} block${gains.length === 1 ? '' : 's'} in my week` : 'Nothing to book yet'}
            onPress={() => {
              if (!gains.length) return;
              applyPlan(gains);
              successFeedback();
              setCommitted({ blocks: gains.length, points: delta });
            }}
          />
          <Button label="Reset" kind="quiet" onPress={() => setSim(initialSim())} />
        </>
      }
    >
      <Stack gap={6} className="pt-4">
        <Stack gap={1}>
          <Text variant="micro" tone="subtle">SIMULATOR</Text>
          <Text variant="title" accessibilityRole="header">What if I…</Text>
        </Stack>

        {/* Now, and what the plan on this screen would make of it. */}
        <Card gap={5}>
          <Stack direction="row" gap={4} align="center" justify="between">
            <Stack gap={3} grow>
              <Text variant="micro" tone="subtle">NOW</Text>
              <Battery charge={now} loadPercent={overall} width={110} height={54} label={`Now, ${now} percent`} />
              <Stack gap={1}>
                <Text variant="heading" tone={TONE[bandFor(overall)]}>{now}%</Text>
                <Text variant="micro" tone="subtle">{CHARGE_LABEL[bandFor(overall)]}</Text>
              </Stack>
            </Stack>

            <Chip
              label={delta === 0 ? '—' : `${delta > 0 ? '+' : ''}${delta}`}
              tone={delta > 0 ? 'steady' : delta < 0 ? 'heavy' : 'plain'}
              readOnly
            />

            <Stack gap={3} grow>
              <Text variant="micro" tone="subtle">PROJECTED</Text>
              <Battery
                charge={projected}
                loadPercent={projectedLoad}
                width={110}
                height={54}
                label={`Projected, ${projected} percent`}
              />
              <Stack gap={1}>
                <Text variant="heading" tone={TONE[bandFor(projectedLoad)]}>{projected}%</Text>
                <Text variant="micro" tone="subtle">{CHARGE_LABEL[bandFor(projectedLoad)]}</Text>
              </Stack>
            </Stack>
          </Stack>
          <Text
            variant="footnote"
            tone="muted"
            accessibilityLiveRegion="polite"
            accessibilityLabel={`Projected ${projected} percent, ${delta > 0 ? 'up' : 'down'} ${Math.abs(delta)} points`}
          >
            Drag the sliders to see how tonight changes your level.
          </Text>
        </Card>

        <Stack gap={3}>
          <Text variant="micro" tone="subtle">YOUR ACTIONS</Text>
          <Card pad={0} gap={0} className="px-5">
            {ACTIONS.map((action, index) => {
              const value = sim[action.id];
              const { text, points } = note(action, value);
              return (
                <Stack key={action.id}>
                  {index > 0 ? <Divider /> : null}
                  <Stack gap={2} className="py-4">
                    <Stack direction="row" justify="between" align="center" gap={3}>
                      <Text variant="body" weight="semibold">{action.label}</Text>
                      <Text variant="body" tone="muted">{readout(action, value)}</Text>
                    </Stack>
                    <Slider
                      value={value}
                      min={action.min}
                      max={action.max}
                      step={action.step}
                      tone={action.ptsPerUnit > 0 ? 'steady' : 'heavy'}
                      label={action.label}
                      readout={readout(action, value)}
                      onChange={(next) => setSim((prev) => ({ ...prev, [action.id]: next }))}
                    />
                    <Text variant="footnote" tone={points > 0 ? 'steady' : points < 0 ? 'heavy' : 'subtle'}>
                      {points !== 0 ? `${points > 0 ? '+' : ''}${points} pts · ` : ''}{text}
                    </Text>
                  </Stack>
                </Stack>
              );
            })}
          </Card>
        </Stack>

        <Stack gap={3}>
          <Text variant="micro" tone="subtle">OR GO STRAIGHT TO</Text>
          <Stack gap={3}>
            <Button label="Rebalance next week" kind="secondary" onPress={() => router.push('/rebalance')} />
            <Button label="Recovery ledger" kind="secondary" onPress={() => router.push('/recover')} />
          </Stack>
        </Stack>

        <View className="h-4" />
      </Stack>
    </Screen>
  );
}
