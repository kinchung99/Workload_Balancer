/**
 * A handle a person can say out loud.
 *
 * Six characters from an alphabet with no `0/O` and no `1/I/L`, because this
 * code's whole job is to survive being read across a table in a noisy room and
 * typed by somebody who is not looking at their hands.
 *
 * Case-insensitive on the way in, upper-case on the way out.
 */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const LENGTH = 6;

export function makeCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(LENGTH));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

/** What the user typed, made comparable. Spaces and dashes are forgiven. */
export const normaliseCode = (input: string): string =>
  input.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, LENGTH);

export const isCode = (input: string): boolean => normaliseCode(input).length === LENGTH;
