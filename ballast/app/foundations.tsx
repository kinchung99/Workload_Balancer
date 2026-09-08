import { View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  AreaIcon, BandSwatch, Burst, Button, Card, Chip, Divider, DreadDots, MOOD_WORD, Mascot, Screen,
  Spot, Stack, Text,
} from '@/components';
import { BAND_LABEL } from '@/lib/load';
import { color, radius, space, target, type as typeScale } from '@design/tokens';
import { BUCKETS, BUCKET_LABEL } from '@/lib/load';
import { ARTBOARD, FIGMA_FRAMES } from '@design/figma';
import type { BandName } from '@/lib/types';

const BANDS: BandName[] = ['steady', 'busy', 'heavy', 'recovery'];
const RANGE: Record<BandName, string> = {
  steady: 'under 70%', busy: '70 to 85%', heavy: 'over 85%', recovery: 'load you get back',
};
const PATTERN: Record<BandName, string> = {
  steady: 'flat fill', busy: 'diagonal hatch', heavy: 'cross hatch', recovery: 'vertical rule',
};
const GREY: Record<BandName, string> = {
  steady: '#9A9A9A', busy: '#8E8E8E', heavy: '#6F6F6F', recovery: '#B4B4B4',
};

/**
 * The quality floor — usable on the worst day, not just the demo day.
 *
 * This screen is also the Foundations page of the design file: every token, band
 * and pattern rendered from the same source the app uses, so a designer can
 * screenshot it and have the styles rather than rebuild them.
 */
export default function Foundations() {
  const router = useRouter();
  return (
    <Screen
      back="/areas"
      backLabel="Areas"
      footer={
        <>
          <Button label="Lock screen and widget" kind="secondary" onPress={() => router.push('/widget')} />
          <Button label="Rebalance sheet" kind="secondary" onPress={() => router.push('/rebalance')} />
        </>
      }
    >
      <Stack gap={5} className="pt-4">
        <Text variant="title" accessibilityRole="header">Foundations</Text>
        <Text variant="callout" tone="muted">
          Tested on a tired person, one-handed, on a bus, at 11pm, with a cracked screen. That is the design
          condition, not an edge case.
        </Text>

        {/* Colour is never the only signal. */}
        <Card gap={5}>
          <Stack gap={2}>
            <Text variant="heading">Colour is never the only signal</Text>
            <Text variant="callout" tone="muted">
              Roughly one in twelve men has some colour vision deficiency, and a red-green load scale is the worst
              possible choice for them. So every band carries three signals at once.
            </Text>
          </Stack>

          <Stack gap={4}>
            {BANDS.map((band) => (
              <Stack key={band} direction="row" gap={4} align="center">
                <BandSwatch band={band} size={28} />
                <Stack gap={1} grow>
                  <Text variant="body" weight="semibold">{BAND_LABEL[band]}</Text>
                  <Text variant="footnote" tone="subtle">{RANGE[band]}</Text>
                </Stack>
                <Text variant="footnote" tone="subtle">{PATTERN[band]}</Text>
              </Stack>
            ))}
          </Stack>

          <Divider />

          <Stack gap={3}>
            <Text variant="footnote" tone="subtle">The same four bands with the colour taken away</Text>
            <Stack direction="row" gap={3}>
              {BANDS.map((band) => (
                <Stack key={band} gap={2} grow align="center">
                  <BandSwatch band={band} size={48} fill={GREY[band]} />
                  <Text variant="micro" tone="subtle">{BAND_LABEL[band]}</Text>
                </Stack>
              ))}
            </Stack>
            <Text variant="footnote" tone="muted">
              Still four distinguishable states. Print this in greyscale and every chart still reads correctly.
              That was the test.
            </Text>
          </Stack>
        </Card>

        {/* The character, at every level it has. */}
        <Card gap={5}>
          <Stack gap={2}>
            <Text variant="heading">How it looks at each level</Text>
            <Text variant="callout" tone="muted">
              Sympathetic at every reading. A heavy week is information, not a failure, so there is no frown
              here at any charge.
            </Text>
          </Stack>
          <Stack direction="row" gap={3} justify="between">
            {[78, 45, 22, 8].map((level) => (
              <Stack key={level} gap={2} align="center" grow>
                <Mascot charge={level} loadPercent={100 - level} size={62} />
                <Text variant="micro" weight="semibold">{level}%</Text>
                <Text variant="micro" tone="subtle" className="text-center">{MOOD_WORD[level >= 60 ? 'great' : level >= 35 ? 'good' : level >= 15 ? 'tired' : 'spent']}</Text>
              </Stack>
            ))}
          </Stack>
        </Card>

        {/* Area identity: shape and hue, kept away from what colour means. */}
        <Card gap={4}>
          <Stack gap={2}>
            <Text variant="heading">The five areas</Text>
            <Text variant="callout" tone="muted">
              A hue and a glyph each, used only on icons and washes. Colour on a reading still means which band
              it is in, so the two never compete.
            </Text>
          </Stack>
          <Stack direction="row" gap={3} justify="between">
            {BUCKETS.map((bucket) => (
              <Stack key={bucket} gap={2} align="center" grow>
                <View
                  className="h-12 w-12 items-center justify-center rounded-lg"
                  style={{ backgroundColor: color.area[bucket].wash }}
                >
                  <AreaIcon area={bucket} size={24} />
                </View>
                <Text variant="micro" tone="subtle">{BUCKET_LABEL[bucket].slice(0, 4)}</Text>
              </Stack>
            ))}
          </Stack>
        </Card>

        {/* Drawings, and the one reward mechanic in the app. */}
        <Card gap={4}>
          <Text variant="heading">Drawings</Text>
          <Stack direction="row" gap={3} justify="between">
            {(['clear', 'night', 'done', 'nothing', 'wall'] as const).map((name) => (
              <Spot key={name} name={name} size={48} />
            ))}
          </Stack>
          <Burst show label="Celebration, shown when something good is logged" />
          <Text variant="footnote" tone="muted">
            Drawn as SVG, not fetched: they work offline, follow the theme and print in greyscale. The burst is
            the only reward in the app and only ever fires for something you did.
          </Text>
        </Card>

        {/* Type that can grow. */}
        <Card gap={4}>
          <Text variant="heading">Type</Text>
          {(Object.keys(typeScale) as Array<keyof typeof typeScale>).map((key) => (
            <Stack key={key} direction="row" gap={4} align="center" justify="between">
              <Text variant={key}>{key}</Text>
              <Text variant="micro" tone="subtle">
                {typeScale[key].fontSize}/{typeScale[key].lineHeight}
              </Text>
            </Stack>
          ))}
          <Text variant="footnote" tone="muted">
            Every layout holds at 200% dynamic type. Nothing is centred on a fixed height, no text sits inside a
            shape it can overflow, and rows reflow to two lines rather than truncating.
          </Text>
        </Card>

        {/* Dread dots, at the size they actually ship. */}
        <Card gap={4}>
          <Text variant="heading">Dread</Text>
          {[1, 2, 3, 4, 5].map((value) => (
            <Stack key={value} direction="row" gap={4} align="center" justify="between">
              <Text variant="footnote" tone="muted">Dread {value}</Text>
              <DreadDots value={value as 1 | 2 | 3 | 4 | 5} />
            </Stack>
          ))}
        </Card>

        {/* The rest of the quality floor, stated rather than drawn. */}
        <Card gap={4}>
          <Text variant="heading">Targets, motion and privacy</Text>
          <Stack gap={3}>
            <Text variant="callout" tone="muted">
              {target.min} by {target.min} point minimum on every tappable thing, including the dread dots. Body
              text passes 4.5 to 1 against its background and the load colours were picked to clear it, not chosen
              first and checked later.
            </Text>
            <Text variant="callout" tone="muted">
              The only animation is the meter moving as you toggle trade-offs, because it shows what changed. With
              reduced motion on, it cuts to the new value instead. Nothing else moves.
            </Text>
            <Text variant="callout" tone="muted">
              Every primary action sits in the lower half of the screen. Nothing that matters lives in a top
              corner, because the moment that matters most is one-handed on a bus.
            </Text>
            <Text variant="callout" tone="muted">
              The whole model runs on the phone. Health data and task text never leave the device. There is
              nothing to breach because there is nothing on a server.
            </Text>
          </Stack>
        </Card>

        {/* The design-file index. */}
        <Card tone="sunken" gap={4}>
          <Text variant="heading">Figma frames</Text>
          <Text variant="footnote" tone="muted">
            Artboard {ARTBOARD.width} x {ARTBOARD.height}. Spacing grid {space[2]}pt. Radius {radius.md}pt on
            cards, {radius.lg}pt on buttons.
          </Text>
          <Stack gap={3}>
            {FIGMA_FRAMES.map((entry) => (
              <Stack key={entry.frame} direction="row" gap={4} justify="between" align="center">
                <Text variant="footnote" className="flex-1">{entry.frame}</Text>
                <Chip label={`p${entry.page}`} readOnly />
              </Stack>
            ))}
          </Stack>
        </Card>

        <View className="h-8" />
      </Stack>
    </Screen>
  );
}
