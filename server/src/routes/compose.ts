/**
 * Writing a message with Claude.
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
 *    route talks to Anthropic.
 *  - **Nothing is stored.** The request is the words on the screen, answered and
 *    forgotten. There is no table for it.
 *  - **No invented excuses.** The prompt forbids illnesses, emergencies and
 *    events that are not in the context. A message that lies for you is one you
 *    have to keep lying about.
 *
 * Signed-in only (guests count), and rate-limited per person, because an open
 * proxy to a paid model is a bill somebody else writes.
 */
import Anthropic from '@anthropic-ai/sdk';
import { Hono } from 'hono';
import { z } from 'zod';
import {
  composeDraftSchema, composeIdeasSchema,
  type ComposeContext, type ComposeDraftRequest, type ComposeIdea,
} from '../../../shared/contract.js';
import type { Env } from '../types.js';

/** What the route needs from a model. A seam, so the API check runs offline. */
export interface Writer {
  ideas(context: ComposeContext): Promise<ComposeIdea[]>;
  draft(request: ComposeDraftRequest): Promise<string>;
}

/** The model declined. Answered as 422 so the app falls back to its own drafts. */
export class DeclinedError extends Error {}

const MODEL = 'claude-opus-5-5';

const SYSTEM = `You help a stressed university student write short messages that they will read, edit and send themselves from their own phone, under their own name.

Rules:
- Write in the student's own voice, first person, as a text message. No subject lines, no sign-offs like "Best regards" unless the tone is formal.
- Never invent facts. No illnesses, family emergencies, broken laptops or events that are not in the context. If the real reason is being overloaded or dreading something, either say so plainly or keep the reason vague - never replace it with a made-up one.
- Be kind to the reader and to the student. No guilt-tripping, no grovelling, no therapy language.
- Use the names and details given. When the subject belongs to the person you are writing to ("Aisyah's birthday dinner", sent to Aisyah), call it theirs ("your birthday dinner").
- Do not mention load percentages, batteries, dread scores or this app.`;

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

const ideasShape = z.object({
  ideas: z.array(z.object({ title: z.string().min(1), emoji: z.string().min(1), detail: z.string() })).min(1),
});
const draftShape = z.object({ message: z.string().min(1) });

/**
 * The real writer.
 *
 * Effort is `low`: these are short, latency-sensitive drafts a student is
 * waiting on with the screen open, which is the workload low effort is for.
 * Server-side fallbacks are on, so a request a classifier declines is retried
 * on Anthropic's recommended model inside the same call instead of failing.
 */
export function claudeWriter(client = new Anthropic({ timeout: 20_000, maxRetries: 1 })): Writer {
  const ask = async (prompt: string, format: typeof ideasFormat | typeof draftFormat): Promise<unknown> => {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM,
      output_config: { effort: 'low', format },
      messages: [{ role: 'user', content: prompt }],
    });
    if (response.stop_reason === 'refusal') throw new DeclinedError('declined');
    const text = response.content.find((block) => block.type === 'text');
    if (!text || text.type !== 'text') throw new DeclinedError('empty');
    return JSON.parse(text.text);
  };

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
  };
}

/** The real writer when a key is configured, nothing otherwise. */
export const defaultWriter = (): Writer | null =>
  process.env.ANTHROPIC_API_KEY?.trim() ? claudeWriter() : null;

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

export function composeRoutes(writer: Writer | null) {
  const routes = new Hono<Env>();

  routes.use('*', async (c, next) => {
    if (!writer) return c.json({ error: 'ai_not_configured' }, 503);
    if (!allow(c.get('userId'))) return c.json({ error: 'slow_down' }, 429);
    await next();
  });

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

/**
 * Every failure is one the app can recover from by writing the message itself,
 * so the answer says which kind it was and nothing more.
 */
function failure(err: unknown): { status: 422 | 502 | 503; error: string } {
  if (err instanceof DeclinedError || err instanceof z.ZodError || err instanceof SyntaxError) {
    return { status: 422, error: 'declined' };
  }
  if (err instanceof Anthropic.RateLimitError) return { status: 503, error: 'busy' };
  if (err instanceof Anthropic.APIError) {
    console.error('[compose]', err.status, err.message);
    return { status: 502, error: 'ai_unavailable' };
  }
  throw err;
}
