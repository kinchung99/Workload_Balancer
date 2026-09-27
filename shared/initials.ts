/**
 * Initials from a name, in its own file on purpose.
 *
 * `contract.ts` imports zod, which the *server* needs to parse requests but the
 * app has no use for — it only ever reads the inferred types, which vanish at
 * compile time. This one function is the exception: real runtime code that both
 * sides need. Keeping it separate means importing it does not drag a validation
 * library into a phone bundle.
 */
export const initialsFrom = (name: string): string => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
};
