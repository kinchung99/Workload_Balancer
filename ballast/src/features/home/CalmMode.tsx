/**
 * Calm mode — the interface gets simpler as the week gets worse.
 *
 * Most apps add urgency when things get bad: more red, more badges, more
 * prompts. That is precisely backwards. Above 90% the person using this has the
 * least capacity for decisions they will have all term, so we give them fewer.
 *
 * One number, one sentence, one button. The list, the charts, the forecast and
 * the circle are all still there and all deliberately out of the way.
 */
import { Battery, Button, Screen, Stack, Text } from '@/components';
import { bandFor } from '@/lib/load';
import { CHARGE_LABEL, chargeOf } from '@/lib/battery';
import { dayName } from '@/lib/dates';
import type { Item } from '@/lib/types';

export interface CalmModeProps {
  percent: number;
  today: string;
  /** The one thing. The app has already made the call so the student does not have to. */
  focus: Item;
  onHide: () => void;
  onShowEverything: () => void;
}

export function CalmMode({ percent, today, focus, onHide, onShowEverything }: CalmModeProps) {
  return (
    <Screen
      scroll={false}
      footer={
        <>
          <Button label="Hide the rest until Friday" onPress={onHide} />
          <Button label="Show me everything anyway" kind="secondary" onPress={onShowEverything} />
          <Text variant="footnote" tone="subtle" className="pt-2 text-center">
            Full view comes back on its own when you drop below 90%.
          </Text>
        </>
      }
    >
      <Stack gap={5} className="pt-8">
        <Text variant="footnote" tone="muted">{dayName(today)}</Text>

        <Stack gap={4} align="start">
          <Text variant="hero" tone="heavy" accessibilityRole="header">{chargeOf(percent)}%</Text>
          <Battery
            charge={chargeOf(percent)}
            loadPercent={percent}
            width={170}
            height={80}
            label={`${chargeOf(percent)} percent charge. ${CHARGE_LABEL[bandFor(percent)]}.`}
          />
          <Text variant="heading" tone="heavy">{CHARGE_LABEL[bandFor(percent)]}</Text>
        </Stack>

        {/* One sentence. Not a list, not a chart, not a prompt to log anything. */}
        <Text variant="heading" weight="regular" className="pt-4">
          Do the {focus.title.toLowerCase()}. Everything else on today's list can wait until Friday and
          nothing bad will happen.
        </Text>
      </Stack>
    </Screen>
  );
}
