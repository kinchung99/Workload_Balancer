/**
 * Frame / Step nav — the footer of any screen split into pages.
 *
 * Back on the left at one third, forward on the right at two thirds, and the
 * forward label says what pressing it does rather than "Next" wherever it can.
 * Capture established the pattern; this is it extracted so every stepped screen
 * behaves identically.
 */
import { Button } from '../primitives/Button';
import { Stack } from '../primitives/Stack';

export function StepNav({
  step,
  last,
  nextLabel,
  canNext = true,
  onBack,
  onNext,
  backLabel = 'Back',
}: {
  step: number;
  /** Index of the final page. On it, `onNext` is the commit. */
  last: number;
  nextLabel: string;
  canNext?: boolean;
  onBack: () => void;
  onNext: () => void;
  backLabel?: string;
}) {
  return (
    <Stack direction="row" gap={3}>
      {step > 0 ? <Button label={backLabel} kind="secondary" onPress={onBack} className="flex-1" /> : null}
      <Button
        label={nextLabel}
        kind={canNext ? 'primary' : 'secondary'}
        accessibilityState={{ disabled: !canNext }}
        onPress={() => { if (canNext) onNext(); }}
        className={step > 0 ? 'flex-[2]' : 'flex-1'}
      />
    </Stack>
  );
}
