/**
 * Writing with a model: messages, and what might help.
 *
 * The drafter used to be three templates with the blanks filled in, which reads
 * as a template the moment anyone receives two of them. Saying no, asking for an
 * extension and checking on a friend are exactly the messages that have to
 * sound like a person, so this is the one place the app asks a model for words.
 *
 * Two calls, both small. `ideas` reads the moment and offers five things the
 * message could be for ("Ask for an extension", "Say no, honestly"); `draft`
 * writes the one the student picked, in the tone they picked. The app never
 * sends anything - it drafts, the student reads it and presses send in their own
 * chat app.
 *
 * Three rules hold:
 *
 *  - **The key never leaves the server.** The app talks to this route; only this
 *    route talks to the model - Gemini when `GEMINI_API_KEY` is set, Claude when
 *    `ANTHROPIC_API_KEY` is, neither otherwise.
 *  - **Nothing is stored.** The request is the words on the screen, answered and
 *    forgotten. There is no table for it.
 *  - **No invented excuses.** The prompt forbids illnesses, emergencies and
 *    events that are not in the context. A message that lies for you is one you
 *    have to keep lying about.
 *
 * The same seam also answers "what would help" on the recovery screen: five
 * concrete things to do, drawn from how full each area of the week is and what
 * the student is in the mood for. Numbers and taps only - no task, no name.
 *
 * Signed-in only (guests count), and rate-limited per person across both, because
 * an open proxy to a paid model is a bill somebody else writes.
 */
import Anthropic from '@anthropic-ai/sdk';
import { ApiError as GeminiApiError, FinishReason, GoogleGenAI } from '@google/genai';
import { Hono } from 'hono';
import { z } from 'zod';
import {
  REST_AREAS, composeDraftSchema, composeIdeasSchema, priorityAdviceSchema, rebalanceAdviceSchema, restIdeasSchema,
  type CoachAdviceResponse, type ComposeContext, type ComposeDraftRequest, type ComposeIdea, type PriorityContext,
  type RebalanceContext, type RestContext, type RestIdea,
} from '../../../shared/contract.js';
import type { Env } from '../types.js';

/** What the route needs from a model. A seam, so the API check runs offline. */
export interface Writer {
  ideas(context: ComposeContext): Promise<ComposeIdea[]>;
  draft(request: ComposeDraftRequest): Promise<string>;
  /** Five things that might help, for the recovery screen. */
  rest(context: RestContext): Promise<RestIdea[]>;
  /** A short reason for each ranked task, in the order the phone ranked them. */
  priority(context: PriorityContext): Promise<CoachAdviceResponse>;
  /** A short reason for every priced trade, and which to take. */
  rebalance(context: RebalanceContext): Promise<CoachAdviceResponse>;
}

/** The model declined. Answered as 422 so the app falls back to its own drafts. */
export class DeclinedError extends Error {}

const MODEL = 'claude-opus-5-5';

/**
 * Flash-Lite: the free tier's most generous daily allowance, and plenty for a
 * two-line text message. `GEMINI_MODEL` swaps it without a code change.
 */
const GEMINI_MODEL = 'gemini-3.5-flash-lite';

const SYSTEM = `You help a stressed university student write short messages that they will read, edit and send themselves from their own phone, under their own name.

Rules:
- Write in the student's own voice, first person, as a text message. No subject lines, no sign-offs like "Best regards" unless the tone is formal.
- Never invent facts. No illnesses, family emergencies, broken laptops or events that are not in the context. If the real reason is being overloaded or dreading something, either say so plainly or keep the reason vague - never replace it with a made-up one.
- Be kind to the reader and to the student. No guilt-tripping, no grovelling, no therapy language.
- Use the names and details given. When the subject belongs to the person you are writing to ("Aisyah's birthday dinner", sent to Aisyah), call it theirs ("your birthday dinner").
- Do not mention load percentages, batteries, dread scores or this app.`;

const REST_SYSTEM = `You suggest recovery activities for a university student whose week is overloaded. They will pick one and put it in their calendar today.

Rules:
- Concrete and doable today: say what to do and roughly how long. Use generic places ("a park nearby", "the library garden"), never invent a specific named venue.
- Mostly free or cheap. Nothing that needs booking ahead, a long journey or special equipment.
- Rest the areas of the week that are full. Prefer activities that draw on the area that still has room - if mental is full and physical has room, a walk beats a puzzle.
- Respect what they said they are in the mood for.
- Not medical or clinical advice. No therapy language, no "self-care" cliches, nothing involving alcohol or anything risky.
- Varied: five genuinely different ideas, not five versions of a walk.`;

const COACH_SYSTEM = `You coach a stressed university student through their week. The app has already listed and scored their options from what the student entered; you explain them in plain words.

Rules:
- Only use the ids you are given. Never invent a task, an option or an action.
- Each reason is short and precise: under 60 characters, second person, no full stop, specific to that item - the deadline, the hours left, how much they dread it, whether it can move, what it gives back.
- The headline is one encouraging, concrete line under 60 characters - a game plan, not a pep talk.
- Kind and honest. No guilt, no therapy language, no "self-care" cliches. Never mention scores, percentages of load or this app.`;

const fmt = (hour: number): string => {
  const whole = Math.floor(hour);
  const minutes = Math.round((hour - whole) * 60);
  const suffix = whole >= 12 ? 'pm' : 'am';
  const display = whole % 12 === 0 ? 12 : whole % 12;
  return minutes ? `${display}:${String(minutes).padStart(2, '0')}${suffix}` : `${display}${suffix}`;
};

const VIBE_WORDS = {
  outside: 'outside', indoors: 'indoors', alone: 'on their own', people: 'with other people',
  free: 'costing nothing', low: 'low energy',
} as const;

/** The week as a few plain lines of numbers. Only what the schema allowed in. */
function describeRest(context: RestContext): string {
  const areas = Object.entries(context.areas) as Array<[keyof RestContext['areas'], number]>;
  const fullest = [...areas].sort((a, b) => b[1] - a[1])[0];
  const roomiest = [...areas].filter(([key]) => (REST_AREAS as readonly string[]).includes(key)).sort((a, b) => a[1] - b[1])[0];
  const lines = [
    `Battery: ${context.charge}% left (lower means more drained).`,
    `How full each area of the week is, against the student's own limit: ${areas.map(([key, value]) => `${key} ${value}%`).join(', ')}. Over 100% is over their limit.`,
    `Fullest: ${fullest[0]}. Most room to give back to: ${roomiest[0]}.`,
  ];
  if (context.sleepHours !== undefined) lines.push(`Slept last night: ${context.sleepHours} hours.`);
  if (context.free?.length) lines.push(`Free on the day: ${context.free.map((w) => `${fmt(w.start)}-${fmt(w.end)}`).join(', ')}.`);
  if (context.vibes.length) lines.push(`In the mood for something ${context.vibes.map((v) => VIBE_WORDS[v]).join(', ')}.`);
  if (context.exclude.length) lines.push(`Already suggested, so do not repeat or rephrase: ${context.exclude.join('; ')}.`);
  return lines.join('\n');
}

/** The moment, as a few plain lines. Only what the schema allowed in. */
function describe(context: ComposeContext): string {
  const lines = [
    `Kind of message: ${{
      decline: 'getting out of, postponing or shrinking a commitment',
      checkin: 'checking in on a friend who may be having a hard week',
      invite: 'proposing a plan with friends',
    }[context.kind]}`,
    `About: ${context.subject}`,
    `To: ${context.to}`,
  ];
  if (context.when) lines.push(`When: ${context.when}`);
  if (context.commitment) {
    lines.push(`Commitment: ${{ hard: 'a hard commitment someone else set', soft: 'a soft commitment', self: 'something the student set themselves' }[context.commitment]}`);
  }
  if (context.pressure) lines.push(`What is in the way: ${context.pressure}`);
  if (context.weekPercent !== undefined) {
    lines.push(`How full the student's week is: ${context.weekPercent >= 80 ? 'overloaded' : context.weekPercent >= 60 ? 'very full' : 'busy'}`);
  }
  if (context.dread !== undefined) lines.push(`How much the student dreads it: ${context.dread} out of 5`);
  if (context.theirCharge !== undefined) {
    lines.push(`How the friend seems to be doing: ${context.theirCharge <= 15 ? 'running on empty' : context.theirCharge <= 40 ? 'stretched' : 'fine'}`);
  }
  return lines.join('\n');
}

const HARDNESS = { hard: 'hard deadline', soft: 'soft deadline', self: 'self-imposed' } as const;

/** The ranked tasks, one line each. */
function describePriority(context: PriorityContext): string {
  const lines = [
    `It is ${context.now}. Battery: ${context.charge}% left.${context.restOwed ? ` Rest owed: ${context.restOwed} hours.` : ''}`,
    'Tasks, in the order the app scored them:',
    ...context.tasks.map((task) => [
      `- [${task.id}] ${task.title}`,
      { owing: 'work to prepare', fixed: 'fixed in the calendar', loose: 'needs a time' }[task.kind],
      task.due ? `due ${task.due}` : null,
      `${task.hoursLeft}h left`,
      task.percentLeft !== undefined ? `${task.percentLeft}% still to do` : null,
      `dread ${task.dread}/5`,
      HARDNESS[task.hardness],
    ].filter(Boolean).join(' · ')),
  ];
  return lines.join('\n');
}

/** Next week's trades, one line each, with what each gives back. */
function describeRebalance(context: RebalanceContext): string {
  return [
    `Next week reads ${context.charge}% battery - too full. Options the app found to lighten it:`,
    ...context.options.map((option) => [
      `- [${option.id}] ${option.title}`,
      option.day,
      option.detail,
      `gives back ${option.saves}`,
      option.locked ? 'LOCKED: cannot be taken' : null,
      option.protected ? 'protected rest: only as a last resort' : null,
    ].filter(Boolean).join(' · ')),
    context.swap ? `A swap the app found on ${context.swap.day}: keep "${context.swap.keep}", drop "${context.swap.drop}".` : '',
  ].filter(Boolean).join('\n');
}

const LENGTH_RULE = {
  short: 'One or two sentences, under 30 words.',
  medium: 'Two to four sentences, under 70 words.',
  long: 'A short paragraph or two, under 120 words.',
} as const;

const TONE_RULE = {
  warm: 'Warm and affectionate. Protects the relationship.',
  brief: 'Brief and kind. Gets to the point, no over-explaining.',
  honest: 'Fully honest about how the student is actually doing, without drama.',
  formal: 'Polite and professional, suitable for a lecturer, tutor or manager.',
  playful: 'Light and playful, one emoji at most.',
} as const;

const ideasFormat = {
  type: 'json_schema' as const,
  schema: {
    type: 'object',
    properties: {
      ideas: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'What the message is for, starting with a verb. At most 28 characters.' },
            emoji: { type: 'string', description: 'One emoji that fits.' },
            detail: { type: 'string', description: 'One short line on when this is the right message. At most 60 characters.' },
          },
          required: ['title', 'emoji', 'detail'],
          additionalProperties: false,
        },
      },
    },
    required: ['ideas'],
    additionalProperties: false,
  },
};

const draftFormat = {
  type: 'json_schema' as const,
  schema: {
    type: 'object',
    properties: { message: { type: 'string' } },
    required: ['message'],
    additionalProperties: false,
  },
};

const restFormat = {
  type: 'json_schema' as const,
  schema: {
    type: 'object',
    properties: {
      ideas: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'The activity, starting with a verb. At most 32 characters.' },
            emoji: { type: 'string', description: 'One emoji that fits.' },
            detail: { type: 'string', description: 'One line: what exactly, and why it fits today. At most 70 characters.' },
            area: { type: 'string', enum: [...REST_AREAS], description: 'The area of the week it gives back to.' },
            minutes: { type: 'integer', description: 'How long, between 10 and 120.' },
            from: { type: 'integer', description: 'Earliest hour of the day it suits, 24h, between 7 and 22.' },
            to: { type: 'integer', description: 'Latest hour it should finish by, 24h, between 8 and 23.' },
            tags: { type: 'array', items: { type: 'string' }, description: 'One to three short tags, e.g. "Costs nothing", "Under an hour", "Alone".' },
          },
          required: ['title', 'emoji', 'detail', 'area', 'minutes', 'from', 'to', 'tags'],
          additionalProperties: false,
        },
      },
    },
    required: ['ideas'],
    additionalProperties: false,
  },
};

const coachFormat = {
  type: 'json_schema' as const,
  schema: {
    type: 'object',
    properties: {
      headline: { type: 'string', description: 'One concrete line, under 70 characters.' },
      picks: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'An id from the list, exactly as given.' },
            why: { type: 'string', description: 'Short and precise, under 60 characters.' },
          },
          required: ['id', 'why'],
          additionalProperties: false,
        },
      },
    },
    required: ['headline', 'picks'],
    additionalProperties: false,
  },
};

const tradeFormat = {
  type: 'json_schema' as const,
  schema: {
    type: 'object',
    properties: {
      headline: { type: 'string', description: 'One concrete line, under 60 characters.' },
      picks: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'An id from the list, exactly as given.' },
            why: { type: 'string', description: 'Short and precise, under 60 characters.' },
            take: { type: 'boolean', description: 'True to recommend taking this option.' },
          },
          required: ['id', 'why', 'take'],
          additionalProperties: false,
        },
      },
      swap: { type: 'string', description: 'Why the swap makes sense, under 60 characters. Empty when there is no swap.' },
    },
    required: ['headline', 'picks', 'swap'],
    additionalProperties: false,
  },
};

const coachShape = z.object({
  headline: z.string().min(1),
  picks: z.array(z.object({ id: z.string(), why: z.string(), take: z.boolean().optional() })),
  swap: z.string().optional(),
});

/** Keep the picks that name something on the list, once each, in order. */
export function keepKnown(picks: Array<{ id: string; why: string; take?: boolean }>, known: Set<string>, limit = 3) {
  const seen = new Set<string>();
  return picks
    .filter((pick) => known.has(pick.id) && !seen.has(pick.id) && seen.add(pick.id))
    .slice(0, limit)
    .map((pick) => ({
      id: pick.id,
      why: pick.why.trim().replace(/\.$/, '').slice(0, 90),
      ...(pick.take === undefined ? {} : { take: pick.take }),
    }));
}

const restShape = z.object({
  ideas: z.array(z.object({
    title: z.string().min(1),
    emoji: z.string().min(1),
    detail: z.string(),
    area: z.enum(REST_AREAS),
    minutes: z.number(),
    from: z.number(),
    to: z.number(),
    tags: z.array(z.string()),
  })).min(1),
});

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, Math.round(value)));

/** A stable id from a title, so the same idea booked twice is the same idea. */
export const ideaId = (title: string): string =>
  `idea-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)}`;

const ideasShape = z.object({
  ideas: z.array(z.object({ title: z.string().min(1), emoji: z.string().min(1), detail: z.string() })).min(1),
});
const draftShape = z.object({ message: z.string().min(1) });

type Format = typeof ideasFormat | typeof draftFormat | typeof restFormat | typeof coachFormat | typeof tradeFormat;

/** One question to a model: a prompt, the JSON shape wanted back, the rules. */
type Ask = (prompt: string, format: Format, system?: string) => Promise<unknown>;

/**
 * Claude.
 *
 * Effort is `low`: these are short, latency-sensitive drafts a student is
 * waiting on with the screen open, which is the workload low effort is for.
 * Server-side fallbacks are on, so a request a classifier declines is retried
 * on Anthropic's recommended model inside the same call instead of failing.
 */
export function claudeWriter(client = new Anthropic({ timeout: 20_000, maxRetries: 1 })): Writer {
  return writerFrom(async (prompt, format, system = SYSTEM) => {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system,
      output_config: { effort: 'low', format },
      messages: [{ role: 'user', content: prompt }],
    });
    if (response.stop_reason === 'refusal') throw new DeclinedError('declined');
    const text = response.content.find((block) => block.type === 'text');
    if (!text || text.type !== 'text') throw new DeclinedError('empty');
    return JSON.parse(text.text);
  });
}

/** The same JSON Schema, minus the one keyword Gemini's subset does not promise to accept. */
function forGemini(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(forGemini);
  if (!schema || typeof schema !== 'object') return schema;
  return Object.fromEntries(
    Object.entries(schema).filter(([key]) => key !== 'additionalProperties').map(([key, value]) => [key, forGemini(value)]),
  );
}

/** Why Gemini stopped, when the reason is that it would not answer. */
const BLOCKED = new Set<FinishReason | undefined>([
  FinishReason.SAFETY, FinishReason.PROHIBITED_CONTENT, FinishReason.BLOCKLIST, FinishReason.SPII, FinishReason.RECITATION,
]);

/**
 * Gemini, through Google AI Studio.
 *
 * The same prompts and the same JSON shapes as Claude; the zod checks after
 * each call are what make the two interchangeable. A blocked answer is a
 * decline, so the app falls back to writing the message itself.
 */
export function geminiWriter(
  client = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY?.trim(),
    httpOptions: { timeout: 20_000, retryOptions: { attempts: 2 } },
  }),
  model = process.env.GEMINI_MODEL?.trim() || GEMINI_MODEL,
): Writer {
  return writerFrom(async (prompt, format, system = SYSTEM) => {
    const response = await client.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: system,
        responseMimeType: 'application/json',
        responseJsonSchema: forGemini(format.schema),
        maxOutputTokens: 2000,
      },
    });
    if (response.promptFeedback?.blockReason) throw new DeclinedError('declined');
    if (BLOCKED.has(response.candidates?.[0]?.finishReason)) throw new DeclinedError('declined');
    const text = response.text;
    if (!text) throw new DeclinedError('empty');
    return JSON.parse(text);
  });
}

/** Ideas, drafts and rest ideas, from whichever model answers `ask`. */
function writerFrom(ask: Ask): Writer {
  return {
    async ideas(context) {
      const raw = await ask(
        `${describe(context)}\n\nSuggest five different things this message could be for - five distinct intents the student might pick, ordered from most to least likely to help. Make them specific to this situation, not generic.`,
        ideasFormat,
      );
      const parsed = ideasShape.parse(raw);
      return parsed.ideas.slice(0, 6).map((idea, index) => ({
        id: `ai-${index}`,
        title: idea.title.slice(0, 40),
        emoji: [...idea.emoji][0] ?? '💬',
        detail: idea.detail.slice(0, 90),
      }));
    },

    async draft(request) {
      const parts = [
        describe(request.context),
        `What the message is for: ${request.intent.title}${request.intent.detail ? ` (${request.intent.detail})` : ''}`,
        `Tone: ${TONE_RULE[request.tone]}`,
        `Length: ${LENGTH_RULE[request.length]}`,
      ];
      if (request.previous) {
        parts.push(`The current draft:\n"""${request.previous}"""`);
        parts.push(`Rewrite it: ${request.adjust ?? 'a different version with the same intent'}.`);
      } else {
        parts.push('Write the message.');
      }
      const raw = await ask(parts.join('\n\n'), draftFormat);
      return draftShape.parse(raw).message.trim();
    },

    async rest(context) {
      const raw = await ask(
        `${describeRest(context)}\n\nSuggest five different recovery activities for today, best fit first.`,
        restFormat,
        REST_SYSTEM,
      );
      const seen = new Set(context.exclude.map((title) => title.toLowerCase()));
      return restShape.parse(raw).ideas
        .filter((idea) => !seen.has(idea.title.toLowerCase()))
        .slice(0, 6)
        .map((idea) => {
          const from = clamp(idea.from, 6, 22);
          return {
            id: ideaId(idea.title),
            title: idea.title.slice(0, 40),
            detail: idea.detail.slice(0, 100),
            emoji: [...idea.emoji][0] ?? '🌿',
            area: idea.area,
            minutes: clamp(idea.minutes, 10, 180),
            from,
            to: Math.max(from + 1, clamp(idea.to, 7, 23)),
            tags: idea.tags.map((tag) => tag.slice(0, 20)).filter(Boolean).slice(0, 3),
          };
        });
    },

    async priority(context) {
      const raw = coachShape.parse(await ask(
        `${describePriority(context)}\n\nThe order is fixed - it comes from what the student entered; do not change it. For every task, give the reason it sits where it does. Then a headline on how to approach today.`,
        coachFormat,
        COACH_SYSTEM,
      ));
      const order = context.tasks.map((t) => t.id);
      const picks = keepKnown(raw.picks, new Set(order), order.length)
        .sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
      return { headline: raw.headline.trim().slice(0, 80), picks };
    },

    async rebalance(context) {
      const raw = coachShape.parse(await ask(
        `${describeRebalance(context)}\n\nFor every option, give the reason - what dropping it buys back, or why it should stay - and whether to take it. Take at most three, the best value for the least harm. Never a locked one; protected rest only if nothing else would do.${context.swap ? ' Then say why the swap makes sense.' : ''}`,
        tradeFormat,
        COACH_SYSTEM,
      ));
      const locked = new Set(context.options.filter((o) => o.locked).map((o) => o.id));
      let taken = 0;
      const picks = keepKnown(raw.picks, new Set(context.options.map((o) => o.id)), context.options.length)
        .map((pick) => {
          const take = !!pick.take && !locked.has(pick.id) && taken < 3;
          if (take) taken += 1;
          return { ...pick, take };
        });
      const swap = context.swap && raw.swap?.trim() ? { swap: raw.swap.trim().replace(/\.$/, '').slice(0, 90) } : {};
      return { headline: raw.headline.trim().slice(0, 80), picks, ...swap };
    },
  };
}

/** Gemini when its key is set, else Claude when that key is, else nothing. */
export const defaultWriter = (): Writer | null =>
  process.env.GEMINI_API_KEY?.trim() ? geminiWriter()
    : process.env.ANTHROPIC_API_KEY?.trim() ? claudeWriter()
      : null;

/* ------------------------------------------------------------------ limits */

const WINDOW_MS = 10 * 60_000;
const PER_WINDOW = 30;
const recent = new Map<string, number[]>();

/**
 * Thirty drafts per person per ten minutes.
 *
 * In memory and per instance, so it is a speed bump rather than a wall. It is
 * there for the stuck retry loop and the curious script, not for a determined
 * attacker - the sign-in gate is what makes this an account's spend, not the
 * internet's.
 */
function allow(userId: string, now = Date.now()): boolean {
  const kept = (recent.get(userId) ?? []).filter((at) => now - at < WINDOW_MS);
  if (kept.length >= PER_WINDOW) {
    recent.set(userId, kept);
    return false;
  }
  kept.push(now);
  recent.set(userId, kept);
  return true;
}

/* ------------------------------------------------------------------ routes */

/** No key, no model; too many calls, a pause. The same gate in front of every route here. */
function gated(writer: Writer | null) {
  const routes = new Hono<Env>();
  routes.use('*', async (c, next) => {
    if (!writer) return c.json({ error: 'ai_not_configured' }, 503);
    if (!allow(c.get('userId'))) return c.json({ error: 'slow_down' }, 429);
    await next();
  });
  return routes;
}

export function composeRoutes(writer: Writer | null) {
  const routes = gated(writer);

  routes.post('/ideas', async (c) => {
    const parsed = composeIdeasSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'bad_request', detail: parsed.error.issues[0]?.message }, 400);
    try {
      return c.json({ ideas: await writer!.ideas(parsed.data.context) });
    } catch (err) {
      const { status, error } = failure(err);
      return c.json({ error }, status);
    }
  });

  routes.post('/draft', async (c) => {
    const parsed = composeDraftSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'bad_request', detail: parsed.error.issues[0]?.message }, 400);
    try {
      return c.json({ message: await writer!.draft(parsed.data) });
    } catch (err) {
      const { status, error } = failure(err);
      return c.json({ error }, status);
    }
  });

  return routes;
}

/** `/api/suggest/*` — what might help, what to do first, what to put down, when to rest. */
export function suggestRoutes(writer: Writer | null) {
  const routes = gated(writer);

  routes.post('/recovery', async (c) => {
    const parsed = restIdeasSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'bad_request', detail: parsed.error.issues[0]?.message }, 400);
    try {
      return c.json({ ideas: await writer!.rest(parsed.data.context) });
    } catch (err) {
      const { status, error } = failure(err);
      return c.json({ error }, status);
    }
  });

  /** One shape for the three coach routes: parse, ask, answer or fail softly. */
  const coach = <T extends z.ZodType<{ context: unknown }>>(path: string, schema: T, run: (context: z.infer<T>['context']) => Promise<unknown>) =>
    routes.post(path, async (c) => {
      const parsed = schema.safeParse(await c.req.json().catch(() => null));
      if (!parsed.success) return c.json({ error: 'bad_request', detail: parsed.error.issues[0]?.message }, 400);
      try {
        return c.json(await run((parsed.data as { context: unknown }).context as z.infer<T>['context']));
      } catch (err) {
        const { status, error } = failure(err);
        return c.json({ error }, status);
      }
    });

  coach('/priority', priorityAdviceSchema, (context) => writer!.priority(context));
  coach('/rebalance', rebalanceAdviceSchema, (context) => writer!.rebalance(context));

  return routes;
}

/**
 * Every failure is one the app can recover from by writing the message itself,
 * so the answer says which kind it was and nothing more.
 */
function failure(err: unknown): { status: 422 | 502 | 503; error: string } {
  if (err instanceof DeclinedError || err instanceof z.ZodError || err instanceof SyntaxError) {
    return { status: 422, error: 'declined' };
  }
  if (err instanceof Anthropic.RateLimitError) return { status: 503, error: 'busy' };
  // Gemini's free tier runs out by the minute and by the day: both are "busy".
  if (err instanceof GeminiApiError && err.status === 429) return { status: 503, error: 'busy' };
  if (err instanceof GeminiApiError) {
    console.error('[compose:gemini]', err.status, err.message);
    return { status: 502, error: 'ai_unavailable' };
  }
  if (err instanceof Anthropic.APIError) {
    console.error('[compose]', err.status, err.message);
    return { status: 502, error: 'ai_unavailable' };
  }
  throw err;
}
