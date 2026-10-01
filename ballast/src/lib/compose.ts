/**
 * Writing a message, on the phone.
 *
 * Claude writes the good version when there is a server and an account (see
 * `server/src/routes/compose.ts`). This is everything else: the public link with
 * no API, a bus with no signal, a student who never signed in. The same three
 * steps work - pick what the message is for, pick a tone, get words - from
 * hand-written parts that are put together rather than three fixed templates.
 *
 * The rule the model is held to holds here too: nothing is invented. No
 * illnesses, no emergencies. Overloaded is a reason, and it is the true one.
 */
import type { ComposeContext, ComposeIdea, MessageLength, ToneId } from '@shared/contract';

export const TONES: Array<{ id: ToneId; label: string; emoji: string; note: string }> = [
  { id: 'warm', label: 'Warm', emoji: '🤗', note: 'Keeps the relationship.' },
  { id: 'brief', label: 'Brief', emoji: '⚡', note: 'Protects your energy.' },
  { id: 'honest', label: 'Fully honest', emoji: '💬', note: 'Tells them you are struggling.' },
  { id: 'formal', label: 'Formal', emoji: '🎓', note: 'For a lecturer, tutor or manager.' },
  { id: 'playful', label: 'Playful', emoji: '😜', note: 'Light, for close friends.' },
];

export const LENGTHS: Array<{ id: MessageLength; label: string }> = [
  { id: 'short', label: 'Short' },
  { id: 'medium', label: 'Medium' },
  { id: 'long', label: 'Detailed' },
];

/** The quick tweaks under a draft. Each is one instruction to the writer. */
export const TWEAKS: Array<{ id: string; label: string; instruction: string }> = [
  { id: 'again', label: '↻ Another version', instruction: 'a different version with the same intent' },
  { id: 'shorter', label: 'Shorter', instruction: 'make it shorter' },
  { id: 'warmer', label: 'Warmer', instruction: 'make it warmer' },
  { id: 'date', label: 'Offer a new date', instruction: 'offer a specific new time instead' },
];

type Rule = ComposeIdea & { fits?: (context: ComposeContext) => boolean };

const COURSEWORK = /assignment|report|coursework|essay|problem set|lab|dissertation|project|presentation/i;

const IDEAS: Record<ComposeContext['kind'], Rule[]> = {
  decline: [
    {
      id: 'extension', title: 'Ask for an extension', emoji: '📅', detail: 'Buy time before the deadline',
      fits: (c) => COURSEWORK.test(c.subject),
    },
    { id: 'overloaded', title: 'Say no, I’m overloaded', emoji: '🫠', detail: 'Plainly, without an excuse' },
    {
      id: 'dreading', title: 'Say no, honestly', emoji: '😮‍💨', detail: 'Admit it’s too much right now',
      fits: (c) => (c.dread ?? 0) >= 3,
    },
    { id: 'reschedule', title: 'Move it to another day', emoji: '🔁', detail: 'Offer a specific new time' },
    {
      id: 'part', title: 'Come for part of it', emoji: '⏱️', detail: 'Show up, leave early',
      fits: (c) => c.commitment !== 'hard' && !COURSEWORK.test(c.subject),
    },
    {
      id: 'cover', title: 'Ask someone to cover', emoji: '🤝', detail: 'Swap or hand it over',
      fits: (c) => /shift|cover|rota/i.test(c.subject),
    },
    {
      id: 'split', title: 'Ask to split the work', emoji: '🧩', detail: 'Share it out fairly',
      fits: (c) => /group|team|presentation|project/i.test(c.subject),
    },
  ],
  checkin: [
    { id: 'thinking', title: 'Just thinking of you', emoji: '💛', detail: 'No ask, no pressure' },
    { id: 'listen', title: 'Offer to listen', emoji: '👂', detail: 'If they want to talk it out' },
    { id: 'food', title: 'Offer to bring food', emoji: '🍜', detail: 'Practical beats words' },
    { id: 'walk', title: 'Suggest a short walk', emoji: '🚶', detail: 'Twenty minutes, outside' },
    { id: 'hello', title: 'Send a light hello', emoji: '😄', detail: 'Something to smile at' },
  ],
  invite: [
    { id: 'propose', title: 'Propose the time', emoji: '📅', detail: 'Name the slot that works' },
    { id: 'lowkey', title: 'Keep it low-key', emoji: '🛋️', detail: 'Easy to say yes to' },
    { id: 'options', title: 'Offer two options', emoji: '✌️', detail: 'Let them pick' },
    { id: 'whosin', title: 'Ask who’s in', emoji: '🙋', detail: 'For a group chat' },
    { id: 'treat', title: 'Make it a treat', emoji: '🍰', detail: 'After a hard week' },
  ],
};

/** Five things the message could be for, chosen by what the moment actually is. */
export function offlineIdeas(context: ComposeContext): ComposeIdea[] {
  return IDEAS[context.kind]
    .filter((rule) => !rule.fits || rule.fits(context))
    .slice(0, 5)
    .map(({ id, title, emoji, detail }) => ({ id, title, emoji, detail }));
}

const first = (name: string) => name.split(' ')[0];

const OPENER: Record<ToneId, (to: string) => string> = {
  warm: (to) => `Hey ${first(to)},`,
  brief: (to) => `Hey ${first(to)} —`,
  honest: (to) => `Hey ${first(to)}, I want to be straight with you.`,
  formal: (to) => `Hi ${to},`,
  playful: (to) => `Heyyy ${first(to)} 👋`,
};

const CLOSER: Record<ToneId, string> = {
  warm: 'Thank you for understanding, it means a lot.',
  brief: 'Thanks.',
  honest: 'I’d rather tell you the truth than half turn up.',
  formal: 'Thank you for considering it.',
  playful: 'You’re the best, I owe you one 🫶',
};

/**
 * What each intent says, as a core line and a second one for longer drafts.
 *
 * Two variants each, so "Another version" offline is a genuinely different
 * message rather than the same one again.
 */
const BODY: Record<string, (c: ComposeContext, v: number) => [string, string]> = {
  extension: (c, v) => [
    v % 2
      ? `Would it be possible to have a few extra days on ${c.subject}${c.when ? ` (due ${c.when})` : ''}?`
      : `I’m writing to ask whether I could have a short extension on ${c.subject}${c.when ? `, currently due ${c.when}` : ''}.`,
    c.pressure
      ? `It lands in the same stretch as ${c.pressure}, and I want to hand in work I’m actually happy with.`
      : 'I want to hand in something I’m actually happy with rather than rush it.',
  ],
  overloaded: (c, v) => [
    v % 2
      ? `I have to pull out of ${c.subject}${c.when ? ` on ${c.when}` : ''}. My week has got completely away from me.`
      : `I’m so sorry, I can’t make ${c.subject}${c.when ? ` on ${c.when}` : ''}. I’m properly overloaded this week.`,
    c.pressure ? `${c.pressure} is taking everything I’ve got right now.` : 'I’ve taken on more than I can do well right now.',
  ],
  dreading: (c, v) => [
    v % 2
      ? `I’ve been putting off telling you, but I’m not going to manage ${c.subject}.`
      : `Honestly, I’m not in a good place for ${c.subject} this week and I don’t want to fake it.`,
    'I’m running on very little and I need to look after that before anything else.',
  ],
  reschedule: (c, v) => [
    v % 2
      ? `Could we move ${c.subject} to another day?`
      : `Any chance we could push ${c.subject} back a bit${c.when ? ` from ${c.when}` : ''}?`,
    'Next week would let me actually be there properly instead of half there.',
  ],
  part: (c, v) => [
    v % 2
      ? `I can’t do all of ${c.subject}, but I’d love to come for the first hour.`
      : `Would it be okay if I came to ${c.subject} for a bit and headed off early?`,
    'I really want to see you, I just can’t do a late one this week.',
  ],
  cover: (c, v) => [
    v % 2
      ? `Is anyone able to cover ${c.subject}${c.when ? ` on ${c.when}` : ''}?`
      : `Could you possibly cover ${c.subject}${c.when ? ` on ${c.when}` : ''}? I’d swap you any shift you like.`,
    'I’ve got more on that week than I can safely fit.',
  ],
  split: (c, v) => [
    v % 2
      ? `Could we split ${c.subject} up a bit more evenly?`
      : `Can we talk about how we share out ${c.subject}?`,
    'I want to do my part well, and right now I can’t do it all.',
  ],
  thinking: (_c, v) => [
    v % 2 ? 'Just checking in. How are you doing, really?' : 'Thinking of you. How have you been?',
    'No need to reply properly, I just wanted you to know.',
  ],
  listen: (_c, v) => [
    v % 2 ? 'If you want to talk anything through, I’m around tonight.' : 'Sounds like it’s been a lot. Want to vent? I’m all ears.',
    'Or not, that’s fine too.',
  ],
  food: (_c, v) => [
    v % 2 ? 'Can I drop some food round this week?' : 'I’m making too much dinner anyway, want me to bring you some?',
    'Zero effort required from you.',
  ],
  walk: (_c, v) => [
    v % 2 ? 'Fancy a twenty minute walk later?' : 'Want to get some air with me this week? Just a short walk.',
    'Good for both of us, honestly.',
  ],
  hello: (_c, v) => [
    v % 2 ? 'Saw something today that made me think of you. Hope you’re hanging in there.' : 'Hello from the land of deadlines. Hope yours are kinder than mine.',
    'Miss you, let’s catch up soon.',
  ],
  propose: (c, v) => [
    v % 2 ? `Are you free ${c.when ?? 'this week'} for ${c.subject.toLowerCase()}?` : `${c.subject} ${c.when ?? 'this week'}? Looks like it works for everyone.`,
    'It’s the one slot we’re all free, so let’s grab it.',
  ],
  lowkey: (c, v) => [
    v % 2 ? `Something chill ${c.when ?? 'this week'}? ${c.subject}, nothing fancy.` : `No big plans, just ${c.subject.toLowerCase()} ${c.when ?? 'this week'} if you’re up for it.`,
    'Totally fine to say no.',
  ],
  options: (c) => [
    `${c.subject} ${c.when ?? 'this week'}, or another evening if that’s easier?`,
    'Whichever suits you, I’ll make it work.',
  ],
  whosin: (c) => [
    `Who’s in for ${c.subject.toLowerCase()} ${c.when ?? 'this week'}?`,
    'Reply with a 👍 and I’ll sort it.',
  ],
  treat: (c) => [
    `We’ve all had a week. ${c.subject} ${c.when ?? 'soon'}, my treat?`,
    'We deserve it.',
  ],
};

/** A sentence for an intent the student typed themselves. */
const custom = (title: string, context: ComposeContext): [string, string] => [
  `${title.replace(/[.!?]*$/, '')}${context.kind === 'decline' ? ` — about ${context.subject}` : ''}.`,
  context.pressure ? `${context.pressure} has taken over my week.` : 'I wanted to say it properly rather than not at all.',
];

/**
 * The subject as the reader would hear it.
 *
 * "I can't make Aisyah's birthday dinner", sent to Aisyah, is a message from a
 * stranger. To her it is "your birthday dinner".
 */
export function aboutFor(context: ComposeContext): ComposeContext {
  const own = new RegExp(`^${first(context.to).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['’]s\\s+`, 'i');
  return own.test(context.subject) ? { ...context, subject: context.subject.replace(own, 'your ') } : context;
}

/** The draft, from parts. `variant` picks between the two wordings of each part. */
export function offlineDraft(
  raw: ComposeContext,
  intent: { id?: string; title: string },
  tone: ToneId,
  length: MessageLength,
  variant = 0,
): string {
  const context = aboutFor(raw);
  const [core, extra] = intent.id && BODY[intent.id] ? BODY[intent.id](context, variant) : custom(intent.title, context);
  const opener = OPENER[tone](context.to);
  if (length === 'short' || tone === 'brief') return `${opener} ${core}`;
  if (length === 'medium') return `${opener} ${core} ${extra}`;
  return `${opener} ${core}\n\n${extra} ${CLOSER[tone]}`;
}

/** The quick tweaks, offline. Each makes a visible, honest change. */
export function offlineTweak(
  text: string,
  tweak: string,
  context: ComposeContext,
  intent: { id?: string; title: string },
  tone: ToneId,
  length: MessageLength,
  variant: number,
): string {
  switch (tweak) {
    case 'shorter': {
      const sentences = text.replace(/\n+/g, ' ').match(/[^.!?]+[.!?]+/g) ?? [text];
      return sentences.slice(0, Math.max(1, sentences.length - 1)).join(' ').trim();
    }
    case 'warmer':
      return /means a lot|thank you/i.test(text) ? `${text} 💛` : `${text} Thank you for understanding, it really means a lot.`;
    case 'date':
      return /next week|another day|instead\?/i.test(text) ? text : `${text}\n\nCould we do next week instead? I’ll fit around you.`;
    default:
      return offlineDraft(context, intent, tone, length, variant + 1);
  }
}

/** "Aisyah's birthday dinner" -> "Aisyah". A message has to be to somebody. */
export const recipientOf = (title: string): string | null => title.match(/^([A-Z][\w-]+)['’]s\b/)?.[1] ?? null;

/** The fields Claude would see, as a list a student can check before sending. */
export function whatIsSent(context: ComposeContext): Array<[string, string]> {
  const rows: Array<[string, string]> = [
    ['About', context.subject],
    ['To', context.to],
  ];
  if (context.when) rows.push(['When', context.when]);
  if (context.pressure) rows.push(['In the way', context.pressure]);
  if (context.weekPercent !== undefined) rows.push(['Your week', `${context.weekPercent}% full`]);
  if (context.dread !== undefined) rows.push(['Dread', `${context.dread} of 5`]);
  if (context.theirCharge !== undefined) rows.push(['Their battery', `${context.theirCharge}%`]);
  return rows;
}
