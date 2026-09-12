import { View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  AreaIcon, BandSwatch, Burst, Button, Card, Chip, Divider, DrainFace, DreadDots, MOOD_WORD, Mascot,
  PageHeader, Screen, Stack, Sticker, Text,
} from '@/components';
import { SCREEN } from '@design/screens';
import { BAND_LABEL } from '@/lib/load';
import { color, radius, space, target, threshold, type as typeScale } from '@design/tokens';
import { BUCKETS, BUCKET_LABEL, MIX_WORD } from '@/lib/load';
import { ARTBOARD, FIGMA_FRAMES } from '@design/figma';
import type { BandName } from '@/lib/types';

const BANDS: BandName[] = ['steady', 'busy', 'heavy', 'recovery'];
/** Read off the tokens, so a recalibration cannot leave this page lying. */
const RANGE: Record<BandName, string> = {
  steady: `under ${threshold.steadyMax}%`,
  busy: `${threshold.steadyMax} to ${threshold.busyMax}%`,
  heavy: `over ${threshold.busyMax}%`,
  recovery: 'load you get back',
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
        <PageHeader
          {...SCREEN.foundations}
          title="Foundations"
          sub="Tested on a tired person, one-handed, on a bus, at 11pm."
        />

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
          <Stack direction="row" gap={3} wrap>
            {([
              'assignment', 'class', 'shift', 'move', 'people', 'chore', 'basket',
              'sun', 'moon', 'cloud', 'leaf', 'star', 'sparkle', 'heart', 'wall',
              'scales', 'chat', 'battery', 'clock', 'calendar', 'wave', 'palette',
            ] as const).map((name) => (
              <Sticker key={name} name={name} size={40} />
            ))}
          </Stack>
          <Burst show label="Celebration, shown when something good is logged" />
          <Text variant="footnote" tone="muted">
            Drawn as SVG, not fetched: they work offline, follow the theme and print in greyscale. The burst is
            the only reward in the app and only ever fires for something you did.
          </Text>
        </Card>

        {/* The decorative palette, and the line it must not cross. */}
        <Card gap={4}>
          <Stack gap={2}>
            <Text variant="heading">Decoration has its own palette</Text>
            <Text variant="callout" tone="muted">
              Stickers and confetti use these and only these. Nothing on screen is ever read off one, which is
              what keeps colour free to mean a band everywhere it matters.
            </Text>
          </Stack>
          <Stack direction="row" gap={3} wrap>
            {(Object.keys(color.decor) as Array<keyof typeof color.decor>).map((key) => (
              <Stack key={key} gap={2} align="center">
                <View
                  className="h-10 w-10 rounded-md border border-line-hairline"
                  style={{ backgroundColor: color.decor[key] }}
                />
                <Text variant="micro" tone="subtle">{key}</Text>
              </Stack>
            ))}
          </Stack>
          <Text variant="footnote" tone="muted">
            A decor hue on a bar, a number or a meter is a bug, not a style choice.
          </Text>
        </Card>

        {/* The control capture is built on. */}
        <Card gap={4}>
          <Stack gap={2}>
            <Text variant="heading">One thing, five areas</Text>
            <Text variant="callout" tone="muted">
              A task lands in as many of the five as it actually costs you. The dial asks with a face rather than
              a number, so nobody has to learn what &quot;dread 4&quot; means to answer it.
            </Text>
          </Stack>
          <Stack direction="row" gap={4} align="center" justify="between">
            {[0, 1, 2, 3, 4, 5].map((level) => (
              <Stack key={level} gap={2} align="center">
                <View
                  className="h-11 w-11 items-center justify-center rounded-pill border-2 border-line-strong bg-raised"
                >
                  <DrainFace level={level} size={26} />
                </View>
                <Text variant="micro" tone="subtle">{MIX_WORD[level].split(' ')[0]}</Text>
              </Stack>
            ))}
          </Stack>
          <Text variant="footnote" tone="muted">
            Strained, never scolded. This is the face of the task, not of the person holding the phone.
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
