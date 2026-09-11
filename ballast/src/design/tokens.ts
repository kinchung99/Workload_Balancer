/**
 * Ballast design tokens.
 *
 * SOURCE OF TRUTH: figma/tokens.json (W3C DTCG). This file is its typed mirror
 * for app code. `npm run tokens:check` walks both and fails if they drift, so
 * you can edit either one and the other is provably still in sync.
 *
 * Figma mapping
 *   color.*       -> Figma variable collection "Colour", modes Light / Dark
 *   dimension.*   -> Figma variable collection "Dimension"
 *   typography.*  -> Figma text styles, one per `type` key
 *   pattern.*     -> four SVG pattern swatches on the Foundations page
 *
 * Rule for anyone adding a value: no raw hex, px or font size may appear
 * anywhere else in src/. If it is not here, it is not a decision yet.
 */

export const color = {
  band: {
    steady:   { fill: '#2F8265', ink: '#1B5C46', wash: '#E8F2ED', onDark: '#5FBF98' },
    busy:     { fill: '#C4881B', ink: '#7A5200', wash: '#FBF0DC', onDark: '#E8B45C' },
    heavy:    { fill: '#B32540', ink: '#A31C38', wash: '#FBE9EC', onDark: '#E4607D' },
    recovery: { fill: '#6B95C9', ink: '#2C5C8F', wash: '#EAF1F9', onDark: '#9EC1E8' },
  },
  /**
   * Identity colours for the five areas.
   *
   * Used only on icons and tile washes, never on a reading. Colour on a bar, a
   * number or the battery still means which band it is in; these are a
   * deliberately different family so the two channels never compete.
   */
  area: {
    mental:   { ink: '#6B3FC0', wash: '#F0EAFC' },
    time:     { ink: '#0C6E8F', wash: '#E2F1F7' },
    physical: { ink: '#4F7A1E', wash: '#EEF5E2' },
    social:   { ink: '#A63A8C', wash: '#FAE9F5' },
    errands:  { ink: '#5A5560', wash: '#F1F0F3' },
  },
  /**
   * Decoration only.
   *
   * Stickers, confetti, the blob behind a heading. Nothing is ever *read* off
   * one of these. They are a separate group so the "colour means band" rule
   * stays checkable: a decor hue on a bar, a number or a meter is a bug.
   */
  decor: {
    blush: '#FF8FAB',
    candy: '#FFB3D1',
    lemon: '#FFD37A',
    mint:  '#8FE0C2',
    sky:   '#9CCDF5',
    lilac: '#C4A9F0',
    cream: '#FFF7EC',
  },
  surface: {
    page:    '#FFFFFF',
    raised:  '#FFFFFF',
    sunken:  '#F6F5F2',
    track:   '#EDEBE6',
    inverse: '#16261F',
    night:   '#1C1D1B',
  },
  ink: {
    default:       '#14161A',
    muted:         '#565A62',
    subtle:        '#6B7079',
    inverse:       '#F7F6F2',
    onNightMuted:  '#A8A9A3',
  },
  line: {
    hairline: '#E4E2DC',
    strong:   '#C9C6BE',
    ceiling:  '#9A9790',
  },
  control: {
    onFill:     '#2F8265',
    offFill:    '#D8D5CE',
    lockedFill: '#EDEBE6',
    knob:       '#FFFFFF',
  },
} as const;

/** 4pt base grid. Index, not pixel value, so the grid stays enforceable. */
export const space = {
  0: 0, 1: 2, 2: 4, 3: 8, 4: 12, 5: 16, 6: 20, 7: 24, 8: 32, 9: 40, 10: 48,
} as const;

export const radius = {
  sm: 8, md: 12, lg: 16, xl: 20, pill: 999,
} as const;

/** Minimum tappable geometry. 44pt is WCAG 2.5.5 and it includes the dread dots. */
export const target = {
  min: 44, button: 52, row: 56, tabBar: 56,
} as const;

export const bar = {
  bucket: 12, meter: 10, forecast: 96,
} as const;

/** The Figma artboard. Every screen is authored to exactly this box. */
export const frame = {
  width: 390, height: 844, safeTop: 59, safeBottom: 34,
} as const;

export const fontFamily = {
  sans: undefined, // system font: SF Pro on iOS, Roboto on Android. Set here if you ship a custom face.
} as const;

export const weight = {
  regular: '400', medium: '500', semibold: '600', bold: '700',
} as const;

/**
 * One entry per Figma text style. `<Text variant="body">` is the only way to
 * put type on screen, which is what keeps the two libraries aligned.
 */
export const type = {
  hero:     { fontSize: 56, lineHeight: 60, fontWeight: weight.bold,     letterSpacing: -2 },
  display:  { fontSize: 40, lineHeight: 44, fontWeight: weight.bold,     letterSpacing: -1.2 },
  title:    { fontSize: 24, lineHeight: 30, fontWeight: weight.bold,     letterSpacing: -0.5 },
  heading:  { fontSize: 18, lineHeight: 24, fontWeight: weight.semibold, letterSpacing: -0.2 },
  body:     { fontSize: 16, lineHeight: 23, fontWeight: weight.regular,  letterSpacing: 0 },
  callout:  { fontSize: 15, lineHeight: 21, fontWeight: weight.regular,  letterSpacing: 0 },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: weight.regular,  letterSpacing: 0 },
  caption:  { fontSize: 12, lineHeight: 16, fontWeight: weight.medium,   letterSpacing: 0.2 },
  micro:    { fontSize: 11, lineHeight: 14, fontWeight: weight.semibold, letterSpacing: 0.4 },
} as const;

/** The non-colour half of every band. See components/charts/BandPattern.tsx. */
export const pattern = {
  steady: 'flat', busy: 'diagonal', heavy: 'cross', recovery: 'vertical',
} as const;

/** Product constants. Tokens, not magic numbers, so the deck cannot disagree with the build. */
export const threshold = {
  steadyMax: 70,
  busyMax: 85,
  calmMode: 90,
  dreadMin: 1,
  dreadMax: 5,
  forecastDays: 14,
  warningLeadDays: 8,
  clusterWindowHours: 72,
} as const;

export const motion = { meter: 260, none: 0 } as const;

export type BandName = keyof typeof color.band;
export type TypeVariant = keyof typeof type;
export type SpaceStep = keyof typeof space;
