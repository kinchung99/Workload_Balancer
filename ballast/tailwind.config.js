/**
 * Tailwind theme, read straight out of the tokens Figma imports.
 *
 * This file parses figma/tokens.json (W3C DTCG) at config time, so a Tailwind
 * class in a screen and a variable in Figma are literally the same decision.
 * src/design/tokens.ts is the typed mirror for app code and
 * `npm run tokens:check` proves the two have not drifted.
 */
const tokens = require('./figma/tokens.json');

/** DTCG leaves are `{ $type, $value }`. Collapse a group down to plain values. */
const flat = (node, transform = (v) => v) =>
  Object.fromEntries(
    Object.entries(node)
      .filter(([k]) => !k.startsWith('$'))
      .map(([k, v]) => ['$value' in v ? [k, transform(v.$value)] : [k, flat(v, transform)]][0]),
  );

const dim = (v) => (typeof v === 'string' ? v : `${v}px`);

const colors = flat(tokens.color);
const spacing = flat(tokens.dimension.space, dim);
const radii = flat(tokens.dimension.radius, dim);
const targets = flat(tokens.dimension.target, dim);
const bars = flat(tokens.dimension.bar, dim);
const frame = flat(tokens.dimension.frame, dim);

const fontSize = Object.fromEntries(
  Object.entries(tokens.typography.style).map(([name, tok]) => [
    name,
    [
      tok.$value.fontSize,
      {
        lineHeight: tok.$value.lineHeight,
        letterSpacing: tok.$value.letterSpacing ?? '0px',
        fontWeight: String(tok.$value.fontWeight),
      },
    ],
  ]),
);

module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    // Deliberately `theme`, not `theme.extend`. A class that is not a token
    // should not exist: no `text-[13px]`, no `bg-[#fff]`, no arbitrary values.
    // That constraint is what makes the export to Figma mechanical.
    colors: {
      transparent: 'transparent',
      steady: colors.band.steady,
      busy: colors.band.busy,
      heavy: colors.band.heavy,
      recovery: colors.band.recovery,
      area: colors.area,
      ink: colors.ink,
      line: colors.line,
      control: colors.control,
      ...colors.surface,
    },
    spacing: { ...spacing, ...targets },
    borderRadius: radii,
    fontSize,
    fontWeight: flat(tokens.typography.weight, String),
    extend: {
      minHeight: targets,
      minWidth: targets,
      height: bars,
      maxWidth: { frame: frame.width },
      transitionDuration: flat(tokens.motion, (v) => String(v).replace('ms', '')),
    },
  },
  plugins: [],
};
