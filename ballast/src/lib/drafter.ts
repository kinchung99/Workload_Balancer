/**
 * The decline drafter.
 *
 * Students do not burn out because they cannot identify the problem. They burn
 * out because saying no is socially expensive, and the expensive part is sitting
 * there composing the message.
 *
 * Ballast never sends anything. It drafts, you read, you send from your own app
 * under your own name - so the message has to sound like the person, which is
 * also why every draft offers a specific new date rather than a vague one.
 */
export type Tone = 'warm' | 'brief' | 'honest';

export const TONES: Array<{ id: Tone; label: string; note: string }> = [
  { id: 'warm',   label: 'Warm',         note: 'Keeps the relationship.' },
  { id: 'brief',  label: 'Brief',        note: 'Protects your energy.' },
  { id: 'honest', label: 'Fully honest', note: 'Tells them you are struggling.' },
];

export interface DraftContext {
  /** Who it is going to. */
  to: string;
  /** The thing being declined, in the student's own words. */
  occasion: string;
  /** What is actually in the way, e.g. "the OS deadline on Wednesday". */
  clash: string;
  /** The specific new date offered instead. Never a vague one. */
  newDate: string;
  /** Something to give the message a reason to exist beyond the apology. */
  hook?: string;
}

export function draft(tone: Tone, context: DraftContext): string {
  const { to, occasion, clash, newDate, hook } = context;
  const hookLine = hook ? ` and I want to hear about ${hook}` : '';

  switch (tone) {
    case 'brief':
      return `Hey ${to} — so sorry, I can't make ${occasion}. This week has got away from me. ${newDate} instead? My treat.`;

    case 'honest':
      return `Hey ${to}, I need to be honest with you. I'm not coping brilliantly this week — ${clash} has taken over and I'm running on very little sleep.\n\nI don't think I'd be good company at ${occasion} and I'd rather tell you that than turn up and be somewhere else in my head. Can we do ${newDate}?${hook ? ` I properly want to hear about ${hook}.` : ''}`;

    case 'warm':
    default:
      return `Hey, I'm so sorry to do this. I'm completely underwater with ${clash} and I don't think I'd be good company at ${occasion}.\n\nCan I take you out properly ${newDate}? My treat,${hookLine || ' and I want to hear everything'}.`;
  }
}

/** The three editing affordances under every draft. */
export function reword(text: string, action: 'shorter' | 'reword' | 'newDate', context: DraftContext): string {
  switch (action) {
    case 'shorter':
      return text.split('\n\n')[0];
    case 'newDate':
      return `${text}\n\nWould ${context.newDate} work instead?`;
    case 'reword':
    default:
      return draft('brief', context);
  }
}
