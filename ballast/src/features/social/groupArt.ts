import { color } from '@design/tokens';

/** Pictures a group can wear. Decoration only. */
export const GROUP_EMOJIS = ['📚', '🏠', '⚽', '🎮', '🍕', '🎵', '🏃', '🎨', '☕', '🎓', '🌙', '✈️'];

const WASHES = [color.decor.mint, color.decor.sky, color.decor.lilac, color.decor.lemon, color.decor.candy, color.decor.blush];

/** A group's colour, steady across launches because it comes from its id. */
export const groupWash = (id: string): string =>
  WASHES[[...id].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % WASHES.length];
