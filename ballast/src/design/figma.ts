/**
 * The Figma bridge.
 *
 * This file is the contract between the codebase and the design file. It exists
 * so that "convert this to Figma" is a mechanical job rather than a redraw.
 *
 * Four rules the whole component library obeys, and they are the reason the
 * conversion works:
 *
 *   1. AUTO-LAYOUT ONLY. Every container is a <Stack>, which is a flex row or
 *      column with a gap and padding and nothing else. No absolute positioning,
 *      no negative margins, no transforms, no fixed heights on text. A <Stack>
 *      pastes into Figma as an auto-layout frame with the same three settings.
 *
 *   2. NO RAW VALUES. Every colour, size, radius and type step is a token from
 *      figma/tokens.json. There is no `#fff` and no `13` anywhere in a screen,
 *      so every property in Figma can be bound to a variable rather than typed.
 *
 *   3. ONE NAME. A component's file name, its exported name and its Figma
 *      component name are the same string. FIGMA_COMPONENTS below is the index.
 *
 *   4. FLAT FRAMES. Each screen renders inside a 390x844 box, which is the
 *      artboard size, so a screenshot drops onto a frame at 1:1 with no scaling.
 */
import { frame } from './tokens';

export const ARTBOARD = {
  width: frame.width,
  height: frame.height,
  /** iPhone 16 / 14 Pro. The device the deck's mockups are drawn at. */
  device: 'iPhone 16 — 390 x 844',
} as const;

/**
 * Screen -> Figma frame name. Numbering follows the interface study so a
 * reviewer can hold the PDF next to the file and match them page by page.
 */
export const FIGMA_FRAMES = [
  { route: '/welcome',              frame: '00 Intro — the whole idea',      page: 2,  note: 'Teaches load = hours x dread by letting you feel it. First run.' },
  { route: '/',                     frame: '01 Home — battery and areas',    page: 3,  note: 'One battery, then the part of you that is empty.' },
  { route: '/add',                  frame: '02a Add — what',                 page: 4,  note: 'One box, or a drawing to start from. No fields.' },
  { route: '/add/size',             frame: '02b Add — how big',              page: 4,  note: 'Turn up, or work first. Asked before anything else.' },
  { route: '/add/takes',            frame: '02c Add — what it takes',        page: 4,  note: 'Five dials, five faces. Where the load actually lands.' },
  { route: '/add/when',             frame: '02d Add — when',                 page: 4,  note: 'Day, time, and the battery before you commit.' },
  { route: '/plan',                 frame: '03 Plan — 14 day forecast',      page: 5,  note: 'The only screen that can prevent anything.' },
  { route: '/rebalance',            frame: '04 Rebalance — trade sheet',     page: 6,  note: 'Live battery. Hard deadlines locked, recovery protected.' },
  { route: '/recover',              frame: '05 Recover — ledger',            page: 7,  note: 'Rest is a credit you are owed.' },
  { route: '/prescription',         frame: '06a Recover — what would help',  page: 7,  note: 'Matched to the area that still has room.' },
  { route: '/prescription/when',    frame: '06b Recover — when it goes',     page: 7,  note: 'Real gaps, a live battery, and the day it lands in.' },
  { route: '/decline/w11-birthday', frame: '07 Saying no — drafter',         page: 8,  note: 'Three tones. Going is a first-class option.' },
  { route: '/calm',                 frame: '09 Calm mode — the worst days',  page: 10, note: 'One number, one sentence, one button.' },
  { route: '/widget',               frame: '10 Lock screen — widget',        page: 10, note: 'The product on most days.' },
  { route: '/checkin',              frame: '11 Check in — the daily ask',    page: 0,  note: 'Mood, sleep, food, good things. One screen.' },
  { route: '/friends',              frame: '11b Friends — your circle',      page: 9,  note: 'A band, a charge, and how old the reading is.' },
  { route: '/plan-together',        frame: '11c Friends — find an evening',  page: 9,  note: 'Their free evenings against the real gaps in yours.' },
  { route: '/you',                  frame: '11d You — everything else',      page: 0,  note: 'Areas, recovery, tonight, timetable, priority.' },
  { route: '/item/algo-set',        frame: '11e One item — every verb',      page: 0,  note: 'Lists are read-only; this is where things change.' },
  { route: '/tonight/night',        frame: '12a Tonight — which night',      page: 0,  note: 'One evening, and the hour it becomes yours.' },
  { route: '/tonight/what',         frame: '12b Tonight — what you do',      page: 0,  note: 'Drag a slider, watch the battery move.' },
  { route: '/tonight/book',         frame: '12c Tonight — book it',          page: 0,  note: 'What it puts in your week, and where it lands.' },
  { route: '/priority',             frame: '16b What to do first',           page: 0,  note: 'One scale: deadline, promise, size, and what can still fit.' },
  { route: '/timetable',            frame: '17a Timetable — the week',       page: 0,  note: 'Fourteen real hours, with why each one matters.' },
  { route: '/timetable/modules',    frame: '17b Timetable — modules',        page: 0,  note: 'Dread once, and every class in it re-prices.' },
  { route: '/timetable/import',     frame: '17c Timetable — import',         page: 0,  note: 'A paste, not a scan. Unreadable lines handed back.' },
] as const;

/**
 * Component -> Figma component name, and the variant properties each one needs.
 * Build these as Figma components with exactly these variant names and the
 * export from code lands on top of them.
 */
export const FIGMA_COMPONENTS = {
  'primitives/Stack':      { name: 'Layout / Stack',        variants: ['direction', 'gap', 'pad', 'align', 'justify'], note: 'Auto-layout frame. Not a real Figma component - it is what every frame is.' },
  'primitives/Text':       { name: 'Type / Text',           variants: ['variant', 'tone'] },
  'primitives/Card':       { name: 'Surface / Card',        variants: ['tone'] },
  'primitives/Button':     { name: 'Control / Button',      variants: ['kind'] },
  'primitives/Chip':       { name: 'Control / Chip',        variants: ['tone', 'selected'] },
  'primitives/AreaDial':   { name: 'Control / Area dial',   variants: ['area', 'value'], note: 'Six notches, a face on the knob. Hue is the area, never the reading.' },
  'primitives/StepDots':   { name: 'Control / Step dots',   variants: ['current', 'count'] },
  'primitives/Sticker':    { name: 'Foundations / Sticker', variants: ['name'], note: 'Decorative only. color.decor, never a value.' },
  'layout/PageHeader':     { name: 'Frame / Page header',   variants: ['sticker', 'wash'], note: 'How every screen opens: a drawing on a coloured disc, a title, one line.' },
  'layout/StepNav':        { name: 'Frame / Step nav',      variants: ['step'], note: 'Back at a third, forward at two thirds, on every stepped screen.' },
  'primitives/Toggle':     { name: 'Control / Toggle',      variants: ['state'] },
  'primitives/DreadDots':  { name: 'Data / Dread dots',     variants: ['value'] },
  'primitives/Divider':    { name: 'Surface / Divider',     variants: [] },
  'primitives/ItemRow':    { name: 'Data / Item row',       variants: ['showDread', 'showBand'] },
  'primitives/Slider':     { name: 'Control / Slider',      variants: ['tone'], note: 'Draggable, tappable and screen-reader adjustable.' },
  'primitives/Checkbox':   { name: 'Control / Checkbox',    variants: ['checked'] },
  'primitives/MoodGrid':   { name: 'Control / Mood grid',   variants: ['quadrant'], note: 'Energy against pleasantness. Two taps.' },
  'primitives/AreaTile':   { name: 'Data / Area tile',      variants: ['band'] },
  'charts/BandPattern':    { name: 'Foundations / Pattern', variants: ['band'], note: 'Four SVG swatches. The non-colour half of every band.' },
  'charts/Bar':            { name: 'Data / Bar',            variants: ['band', 'overCeiling'] },
  'charts/Battery':        { name: 'Data / Battery',        variants: ['band', 'size'], note: 'The headline reading. Charge, not load.' },
  'charts/WeekGrid':       { name: 'Data / Week grid',      variants: [], note: 'Committed blocks and protected recovery.' },
  'charts/ForecastStrip':  { name: 'Data / Forecast strip', variants: [] },
  'layout/TabBar':         { name: 'Navigation / Tab bar',  variants: ['active'] },
  'layout/PhoneFrame':     { name: 'Frame / Device',        variants: ['surface'], note: 'Web preview only. Delete the chrome layer after importing.' },
} as const;

/**
 * Figma variable collections to create, and which token group fills each.
 * Tokens Studio creates these for you from figma/tokens.json; this is the map
 * for anyone doing it by hand.
 */
export const FIGMA_COLLECTIONS = [
  { collection: 'Colour',    from: 'color.*',          modes: ['Light', 'Dark'], note: 'Dark mode swaps band.* to band.*.onDark and surface.page to surface.night.' },
  { collection: 'Dimension', from: 'dimension.*',      modes: ['Default'],       note: 'space, radius, target, bar, frame.' },
  { collection: 'Type',      from: 'typography.style', modes: ['Default'],       note: 'One Figma text style per key. Not variables - styles.' },
] as const;
