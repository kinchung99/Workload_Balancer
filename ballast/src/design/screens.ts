/**
 * Which drawing and which colour each screen opens with.
 *
 * One map rather than a choice made fifteen times, so the app reads as one
 * place. A screen's colour identifies the screen the way its sticker does — it
 * is decoration, drawn from `color.decor`, and nothing is ever read off it.
 * Anything carrying a value is still band-coloured.
 */
import { color } from './tokens';
import type { StickerName } from '@/components';

export interface ScreenStyle {
  sticker: StickerName;
  wash: string;
}

export const SCREEN: Record<string, ScreenStyle> = {
  home:         { sticker: 'sun',        wash: color.decor.lemon },
  areas:        { sticker: 'sparkle',    wash: color.decor.lilac },
  plan:         { sticker: 'calendar',   wash: color.decor.sky },
  tonight:      { sticker: 'moon',       wash: color.decor.lilac },
  rebalance:    { sticker: 'scales',     wash: color.decor.candy },
  recover:      { sticker: 'battery',    wash: color.decor.mint },
  prescription: { sticker: 'leaf',       wash: color.decor.mint },
  decline:      { sticker: 'chat',       wash: color.decor.sky },
  timetable:    { sticker: 'class',      wash: color.decor.lilac },
  foundations:  { sticker: 'palette',    wash: color.decor.cream },
  welcome:      { sticker: 'wave',       wash: color.decor.lemon },
  friends:      { sticker: 'people',     wash: color.decor.candy },
  together:     { sticker: 'heart',      wash: color.decor.blush },
  you:          { sticker: 'battery',    wash: color.decor.mint },
  findFriends:  { sticker: 'chat',       wash: color.decor.candy },
  sharing:      { sticker: 'wave',       wash: color.decor.lilac },
  friendDay:    { sticker: 'calendar',   wash: color.decor.blush },
};

/** The five areas keep their own identity hue rather than a decor one. */
export const AREA_STICKER = {
  mental: 'cloud',
  time: 'clock',
  physical: 'move',
  social: 'people',
  errands: 'basket',
} as const satisfies Record<string, StickerName>;
