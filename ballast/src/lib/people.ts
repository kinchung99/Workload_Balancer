/**
 * Small facts about people that several screens need the same way.
 */

/** "nadia.rahman@uni.edu" → "Nadia Rahman": the best guess at a name from an address. */
export function nameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? email;
  const words = local.split(/[._\-+]+/).filter(Boolean);
  if (!words.length) return email;
  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
}

/** Two letters for a face with no picture: first and last word, or the first two letters. */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/** "Nadia Rahman" → "Nadia". */
export const firstName = (name: string): string => name.trim().split(/\s+/)[0] ?? name;

/** How long the sample week's friends take to answer, so the wait is visible but short. */
export const DEMO_ANSWER_MS = 12_000;
