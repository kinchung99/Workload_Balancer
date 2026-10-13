import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, TextInput, View } from 'react-native';
import { Button, Chip, Reveal, Section, Stack, Text } from '@/components';
import { color, radius } from '@design/tokens';
import { api } from '@/lib/api';
import { ensureAi, useAiOpen } from '@/lib/ai';
import { LENGTHS, TONES, TWEAKS, offlineDraft, offlineIdeas, offlineTweak, whatIsSent } from '@/lib/compose';
import { successFeedback, tapFeedback } from '@/lib/haptics';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { ComposeContext, ComposeIdea, MessageLength, ToneId } from '@shared/contract';
import { NATIVE_DRIVER } from '@/lib/nativeDriver';

type Source = 'claude' | 'phone';

const OWN = '__own__';

/**
 * Write a message in three taps: what it is for, how it should sound, write.
 *
 * Claude reads the moment and offers what the message could be for - "Ask for
 * an extension", "Say no, honestly" - because the hardest part of saying no is
 * deciding what kind of no it is. Then the student picks a tone and a length,
 * and the words arrive in a chat bubble they can edit, shorten or redo.
 *
 * Without an account or a connection, the same flow runs on the phone from
 * hand-written parts, and says so. Either way the app never sends anything.
 */
export function Composer({ context: initial, onChange }: { context: ComposeContext; onChange: (text: string | null) => void }) {
  const online = useAiOpen();
  const reduceMotion = useReducedMotion();

  const [to, setTo] = useState(initial.to);
  const context = useMemo(() => ({ ...initial, to: to.trim() || initial.to }), [initial, to]);

  const [ideas, setIdeas] = useState<ComposeIdea[]>(() => offlineIdeas(initial));
  const [ideaSource, setIdeaSource] = useState<Source>('phone');
  const [loadingIdeas, setLoadingIdeas] = useState(online);
  const [picked, setPicked] = useState<string | null>(null);
  const [own, setOwn] = useState('');
  const [tone, setTone] = useState<ToneId>('warm');
  const [length, setLength] = useState<MessageLength>('medium');

  const [draft, setDraft] = useState<string | null>(null);
  const [draftSource, setDraftSource] = useState<Source>('phone');
  const [writing, setWriting] = useState(false);
  const [variant, setVariant] = useState(0);
  const [editing, setEditing] = useState(false);
  /** What the last draft was written for, so a change of tone reads as "rewrite". */
  const [wrote, setWrote] = useState<string | null>(null);

  const fetchIdeas = async () => {
    if (!online) return;
    setLoadingIdeas(true);
    if (!(await ensureAi())) { setLoadingIdeas(false); return; }
    const result = await api.composeIdeas(context);
    if (result.ok && result.data.ideas.length) {
      setIdeas(result.data.ideas);
      setIdeaSource('claude');
    } else {
      setIdeas(offlineIdeas(context));
      setIdeaSource('phone');
    }
    setLoadingIdeas(false);
  };

  useEffect(() => {
    void fetchIdeas();
    // Once, on arrival. "New ideas" asks again on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const idea = ideas.find((candidate) => candidate.id === picked);
  const intent = picked === OWN
    ? (own.trim() ? { title: own.trim() } : null)
    : idea ? { id: idea.id, title: idea.title, detail: idea.detail } : null;
  const signature = `${intent?.title}|${tone}|${length}|${context.to}`;

  const write = async (tweak?: (typeof TWEAKS)[number]) => {
    if (!intent) return;
    tapFeedback();
    setWriting(true);
    setEditing(false);
    let text: string | null = null;
    let source: Source = 'phone';

    if (online && (await ensureAi())) {
      const result = await api.composeDraft({
        context,
        intent: { title: intent.title, detail: 'detail' in intent ? intent.detail : undefined },
        tone,
        length,
        previous: tweak && draft ? draft : undefined,
        adjust: tweak?.instruction,
      });
      if (result.ok) {
        text = result.data.message;
        source = 'claude';
      }
    }
    if (!text) {
      text = tweak && draft
        ? offlineTweak(draft, tweak.id, context, intent, tone, length, variant)
        : offlineDraft(context, intent, tone, length, variant);
      if (tweak?.id === 'again') setVariant((v) => v + 1);
      // Long enough for the typing bubble to register as the thing happening.
      await new Promise((resolve) => setTimeout(resolve, reduceMotion ? 0 : 500));
    }

    setDraft(text);
    setDraftSource(source);
    setWrote(signature);
    setWriting(false);
    onChange(text);
    successFeedback();
  };

  const toneNote = TONES.find((option) => option.id === tone)!.note;

  return (
    <Stack gap={5}>
      {/* Who it is going to. Editable, because the app can only guess. */}
      <Stack direction="row" gap={3} align="center" className="rounded-pill border border-line-hairline bg-sunken py-2 pl-2 pr-4">
        <View className="items-center justify-center rounded-pill" style={{ width: 36, height: 36, backgroundColor: color.decor.candy }}>
          <Text variant="caption" weight="bold">{(context.to[0] ?? '?').toUpperCase()}</Text>
        </View>
        <Text variant="footnote" tone="subtle">To</Text>
        <TextInput
          value={to}
          onChangeText={setTo}
          accessibilityLabel="Who it is going to"
          placeholder="them"
          placeholderTextColor={color.ink.subtle}
          className="min-h-min flex-1 text-body text-ink-default"
        />
        <Text variant="caption" tone="subtle">✎</Text>
      </Stack>

      {/* 1 · What it is for */}
      <Section
        family="people"
        title="What do you want to say?"
        sticker="chat"
        action={online ? { label: '↻ New ideas', onPress: () => void fetchIdeas() } : undefined}
      >
        <SourcePill source={ideaSource} loading={loadingIdeas} what="ideas" />

        {loadingIdeas ? (
          <Stack gap={3}>
            <Stack direction="row" gap={3} wrap>
              {[0, 1, 2, 3].map((i) => <IdeaSkeleton key={i} delay={i * 120} />)}
            </Stack>
            <Text variant="footnote" tone="muted" accessibilityLiveRegion="polite">Reading the situation…</Text>
          </Stack>
        ) : (
          <Stack direction="row" gap={3} wrap>
            {ideas.map((option) => (
              <IdeaCard
                key={option.id}
                emoji={option.emoji}
                title={option.title}
                detail={option.detail}
                selected={picked === option.id}
                onPress={() => { tapFeedback(); setPicked(option.id); }}
              />
            ))}
            <IdeaCard
              emoji="✏️"
              title="Something else"
              detail="Say it in your own words"
              selected={picked === OWN}
              onPress={() => { tapFeedback(); setPicked(OWN); }}
            />
          </Stack>
        )}

        {picked === OWN ? (
          <TextInput
            value={own}
            onChangeText={setOwn}
            autoFocus
            accessibilityLabel="What do you want the message to say"
            placeholder="e.g. Ask to join on a video call instead"
            placeholderTextColor={color.ink.subtle}
            className="min-h-row rounded-md border-2 border-inverse bg-page px-4 py-3 text-body text-ink-default"
          />
        ) : null}
      </Section>

      {/* 2 · How it sounds */}
      <Section family="people" title="Pick a tone" sticker="sparkle">
        <Stack direction="row" justify="between">
          {TONES.map((option) => (
            <ToneBubble
              key={option.id}
              emoji={option.emoji}
              label={option.label}
              note={option.note}
              selected={tone === option.id}
              onPress={() => { tapFeedback(); setTone(option.id); }}
            />
          ))}
        </Stack>
        <Text variant="footnote" tone="muted" className="text-center">{toneNote}</Text>
        <Segmented
          options={LENGTHS}
          value={length}
          onChange={(next) => { tapFeedback(); setLength(next); }}
        />
      </Section>

      <Button
        label={
          !intent ? 'Pick what to say first'
            : draft && wrote !== signature ? '✨ Rewrite it'
            : draft ? '✨ Write it again'
            : online ? '✨ Write it with AI' : '✨ Write it'
        }
        kind={intent ? 'primary' : 'secondary'}
        disabled={!intent || writing}
        onPress={() => void write()}
      />

      {/* 3 · The words, as the other person will see them */}
      {writing || draft ? (
        <Stack gap={3}>
          <Stack direction="row" align="center" justify="between">
            <Text variant="micro" tone="subtle">TO {context.to.toUpperCase()} · WHATSAPP</Text>
            {draft && !writing ? <SourcePill source={draftSource} what="draft" /> : null}
          </Stack>
          <Bubble
            writing={writing}
            text={draft ?? ''}
            editing={editing}
            reduceMotion={reduceMotion}
            onEdit={(next) => { setDraft(next); onChange(next); }}
          />
          {draft && !writing ? (
            <Stack direction="row" gap={2} wrap>
              {TWEAKS.map((tweak) => (
                <Chip key={tweak.id} label={tweak.label} onPress={() => void write(tweak)} />
              ))}
              <Chip
                label={editing ? 'Done editing' : '✏️ Edit'}
                tone={editing ? 'selected' : 'plain'}
                onPress={() => { tapFeedback(); setEditing(!editing); }}
              />
            </Stack>
          ) : null}
        </Stack>
      ) : null}

      {online ? (
        <Reveal label="What the AI sees">
          {whatIsSent(context).map(([label, value]) => (
            <Stack key={label} direction="row" gap={3}>
              <Text variant="micro" tone="subtle" style={{ width: 92 }}>{label.toUpperCase()}</Text>
              <Text variant="footnote" tone="muted" className="flex-1">{value}</Text>
            </Stack>
          ))}
          <Text variant="footnote" tone="subtle">That is all. It is used to write this message and not stored.</Text>
        </Reveal>
      ) : (
        <Text variant="footnote" tone="subtle">
          Written on your phone. Sign in for AI ideas and drafts.
        </Text>
      )}
    </Stack>
  );
}

function SourcePill({ source, loading, what }: { source: Source; loading?: boolean; what: 'ideas' | 'draft' }) {
  const claude = source === 'claude' || loading;
  // Only the AI is worth naming; the phone's own wording needs no label.
  if (!claude) return null;
  return (
    <View
      className="self-start rounded-pill px-3 py-1"
      style={{ backgroundColor: claude ? color.area.mental.wash : color.surface.sunken }}
    >
      <Text variant="micro" tone={claude ? 'default' : 'subtle'}>
        {loading ? '✨ ASKING AI…' : claude
          ? (what === 'ideas' ? '✨ IDEAS FROM AI' : '✨ WRITTEN BY AI')
          : (what === 'ideas' ? '📱 IDEAS ON YOUR PHONE' : '📱 WRITTEN ON YOUR PHONE')}
      </Text>
    </View>
  );
}

function IdeaCard({
  emoji, title, detail, selected, onPress,
}: { emoji: string; title: string; detail: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${title}. ${detail}`}
      onPress={onPress}
      className={`min-h-row gap-2 rounded-lg border-2 p-4 active:opacity-70 ${selected ? 'border-inverse' : 'border-line-hairline bg-raised'}`}
      style={{ width: '48%', backgroundColor: selected ? color.area.mental.wash : undefined }}
    >
      <Stack direction="row" justify="between" align="start">
        <Text variant="title">{emoji}</Text>
        {selected ? (
          <View className="items-center justify-center rounded-pill bg-inverse" style={{ width: 22, height: 22 }}>
            <Text variant="micro" tone="inverse">✓</Text>
          </View>
        ) : null}
      </Stack>
      <Text variant="callout" weight="semibold">{title}</Text>
      <Text variant="micro" tone="muted">{detail}</Text>
    </Pressable>
  );
}

function IdeaSkeleton({ delay }: { delay: number }) {
  const pulse = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: NATIVE_DRIVER }),
        Animated.timing(pulse, { toValue: 0.45, duration: 600, useNativeDriver: NATIVE_DRIVER }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, delay]);
  return (
    <Animated.View
      className="gap-2 rounded-lg p-4"
      style={{ width: '48%', minHeight: 116, opacity: pulse, backgroundColor: color.area.mental.wash }}
    >
      <View className="rounded-pill" style={{ width: 30, height: 30, backgroundColor: color.surface.page }} />
      <View className="rounded-pill" style={{ width: '80%', height: 12, backgroundColor: color.surface.page }} />
      <View className="rounded-pill" style={{ width: '55%', height: 10, backgroundColor: color.surface.page }} />
    </Animated.View>
  );
}

function ToneBubble({
  emoji, label, note, selected, onPress,
}: { emoji: string; label: string; note: string; selected: boolean; onPress: () => void }) {
  const scale = useRef(new Animated.Value(selected ? 1.12 : 1)).current;
  useEffect(() => {
    Animated.spring(scale, { toValue: selected ? 1.12 : 1, friction: 5, tension: 180, useNativeDriver: NATIVE_DRIVER }).start();
  }, [selected, scale]);
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${label}. ${note}`}
      onPress={onPress}
      className="min-h-min items-center gap-2 active:opacity-70"
      style={{ width: 62 }}
    >
      <Animated.View
        style={{
          width: 52, height: 52, borderRadius: radius.pill,
          alignItems: 'center', justifyContent: 'center',
          backgroundColor: selected ? color.decor.lemon : color.surface.sunken,
          borderWidth: 2, borderColor: selected ? color.ink.default : 'transparent',
          transform: [{ scale }],
        }}
      >
        <Text variant="heading">{emoji}</Text>
      </Animated.View>
      <Text variant="micro" weight={selected ? 'bold' : 'semibold'} tone={selected ? 'default' : 'subtle'} className="text-center">
        {label}
      </Text>
    </Pressable>
  );
}

/** A three-way switch with a thumb that slides, for the message length. */
function Segmented<T extends string>({
  options, value, onChange,
}: { options: Array<{ id: T; label: string }>; value: T; onChange: (next: T) => void }) {
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((option) => option.id === value));
  const slide = useRef(new Animated.Value(index)).current;
  useEffect(() => {
    Animated.spring(slide, { toValue: index, friction: 7, tension: 140, useNativeDriver: NATIVE_DRIVER }).start();
  }, [index, slide]);
  const cell = width / options.length;

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel="Message length"
      onLayout={(event) => setWidth(event.nativeEvent.layout.width - 8)}
      className="flex-row rounded-pill bg-sunken p-1"
    >
      {width ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute', top: 4, bottom: 4, left: 4, width: cell,
            borderRadius: radius.pill, backgroundColor: color.surface.inverse,
            transform: [{ translateX: Animated.multiply(slide, cell) }],
          }}
        />
      ) : null}
      {options.map((option) => (
        <Pressable
          key={option.id}
          accessibilityRole="radio"
          accessibilityState={{ selected: option.id === value }}
          onPress={() => onChange(option.id)}
          className="min-h-min flex-1 items-center justify-center"
        >
          <Text variant="caption" weight="semibold" tone={option.id === value ? 'inverse' : 'muted'}>{option.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/**
 * The draft, as the other person will see it: a chat bubble.
 *
 * It types itself out the first time, which is the moment a student reads it as
 * a message rather than as a form field - and stops dead under Reduce Motion.
 */
function Bubble({
  writing, text, editing, reduceMotion, onEdit,
}: { writing: boolean; text: string; editing: boolean; reduceMotion: boolean; onEdit: (next: string) => void }) {
  const [shown, setShown] = useState(text.length);
  const last = useRef(text);

  useEffect(() => {
    // Only a new draft types itself out; edits show as you make them.
    if (editing || writing || text === last.current) return;
    last.current = text;
    if (reduceMotion) { setShown(text.length); return; }
    setShown(0);
    const step = Math.max(2, Math.ceil(text.length / 50));
    let at = 0;
    const timer = setInterval(() => {
      at += step;
      setShown(at);
      if (at >= text.length) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [text, editing, writing, reduceMotion]);

  return (
    <View
      className="self-end rounded-xl px-4 py-3"
      style={{
        maxWidth: '92%', minWidth: 96,
        backgroundColor: color.decor.cream,
        borderWidth: 1.5, borderColor: color.decor.mint,
        borderBottomRightRadius: 4,
      }}
    >
      {writing ? (
        <TypingDots />
      ) : editing ? (
        <TextInput
          value={text}
          onChangeText={onEdit}
          multiline
          autoFocus
          accessibilityLabel="Edit the message"
          className="text-body text-ink-default"
          style={{ minHeight: 80 }}
        />
      ) : (
        <Text variant="body" accessibilityLabel={`Draft message. ${text}`}>{text.slice(0, shown)}</Text>
      )}
      {!writing ? (
        <Text variant="micro" tone="subtle" className="pt-1 text-right">now ✓✓</Text>
      ) : null}
    </View>
  );
}

function TypingDots() {
  const dots = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  useEffect(() => {
    const loops = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 140),
          Animated.timing(dot, { toValue: 1, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE_DRIVER }),
          Animated.timing(dot, { toValue: 0, duration: 260, easing: Easing.in(Easing.quad), useNativeDriver: NATIVE_DRIVER }),
          Animated.delay((2 - i) * 140),
        ]),
      ),
    );
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [dots]);
  return (
    <View accessibilityLabel="Writing" accessibilityLiveRegion="polite" className="flex-row gap-2 py-2">
      {dots.map((dot, i) => (
        <Animated.View
          key={i}
          style={{
            width: 9, height: 9, borderRadius: radius.pill, backgroundColor: color.ink.subtle,
            transform: [{ translateY: dot.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }],
          }}
        />
      ))}
    </View>
  );
}
