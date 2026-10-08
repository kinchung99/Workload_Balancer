/**
 * Your note - an emoji and a line for your circle, the way Instagram does notes.
 *
 * The bubble sits over your own picture and you type straight into it, so what
 * you are writing is already shown the way friends will see it. The emoji goes
 * on the corner of the picture. Nothing leaves until Share.
 */
import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { Avatar, Button, Section, Stack, Text } from '@/components';
import { color, radius } from '@design/tokens';
import { NOTE_MAX, shownMood } from '@/lib/checkin';
import { bandFor } from '@/lib/load';
import { successFeedback, tapFeedback } from '@/lib/haptics';
import { useStore } from '@/state/store';
import { useReading } from '@/state/selectors';

const VIBES = ['😄', '😌', '🥳', '😴', '🤯', '😤', '🫠', '🥲', '🔥', '📚', '☕', '💪', '🎧', '🌧️'];
const QUICK = ['Deep in revision', 'Free tonight', 'Need a coffee', 'Gym later', 'Survived the week', 'Send snacks'];

export function NoteCard() {
  const { status, setStatus, vibe, setVibe, pic, moods, account, circle } = useStore();
  const reading = useReading();
  const [line, setLine] = useState(status ?? '');
  const [emoji, setEmoji] = useState<string | null>(vibe);
  const [shared, setShared] = useState(false);
  // The saved note lands a beat after the first paint; follow it until edited.
  useEffect(() => { setLine(status ?? ''); setEmoji(vibe); }, [status, vibe]);

  const friends = circle.filter((person) => !person.isYou).length;
  const changed = line.trim() !== (status ?? '') || emoji !== vibe;
  const hasNote = !!(status || vibe);

  const share = () => {
    if (!changed) return;
    setStatus(line);
    setVibe(emoji);
    setShared(true);
    successFeedback();
  };

  return (
    <Section family="people" title="Your note" sticker="chat" meta={friends ? `👀 ${friends} friends` : undefined}>
      <View className="items-center pt-1">
        {/* The bubble: typed into, exactly where it will be read. */}
        <View className="items-center" style={{ maxWidth: 290, minWidth: 190 }}>
          <View
            className="w-full rounded-xl px-4 py-3"
            style={{ backgroundColor: color.surface.raised, borderWidth: 2, borderColor: color.line.hairline }}
          >
            <TextInput
              value={line}
              onChangeText={(text) => { setLine(text.slice(0, NOTE_MAX)); setShared(false); }}
              placeholder="Share a note…"
              placeholderTextColor={color.ink.subtle}
              accessibilityLabel="Your note"
              maxLength={NOTE_MAX}
              multiline
              className="text-center text-callout font-semibold text-ink-default"
              style={Platform.OS === 'web' ? ({ outlineStyle: 'none', minHeight: 24 } as object) : { minHeight: 24 }}
            />
          </View>
          <View
            style={{
              width: 14, height: 14, marginTop: -8, transform: [{ rotate: '45deg' }],
              backgroundColor: color.surface.raised, borderRightWidth: 2, borderBottomWidth: 2, borderColor: color.line.hairline,
            }}
          />
        </View>
        <View className="pt-1">
          <Avatar
            initials={account?.initials ?? 'Y'}
            band={bandFor(reading.overall)}
            size={92}
            pic={pic}
            mood={emoji ?? shownMood(null, moods)}
          />
        </View>
      </View>

      {/* The emoji for the corner of your picture. Tap again to take it off. */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
        {VIBES.map((option) => {
          const on = option === emoji;
          return (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`Feeling ${option}`}
              onPress={() => { tapFeedback(); setEmoji(on ? null : option); setShared(false); }}
              className="items-center justify-center active:opacity-60"
              style={{
                width: 48, height: 48, borderRadius: radius.pill,
                backgroundColor: on ? color.decor.lemon : color.surface.raised,
                borderWidth: 2, borderColor: on ? color.ink.default : color.line.hairline,
                transform: [{ scale: on ? 1.08 : 1 }],
              }}
            >
              <Text variant="title">{option}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* One tap for the usual ones. */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {QUICK.map((text) => (
          <Pressable
            key={text}
            accessibilityRole="button"
            accessibilityLabel={text}
            onPress={() => { tapFeedback(); setLine(text); setShared(false); }}
            className="min-h-min justify-center rounded-pill border border-line-hairline bg-raised px-4 py-2 active:opacity-60"
          >
            <Text variant="caption" weight="semibold">{text}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <Button
        label={changed ? 'Share with friends' : shared || hasNote ? '✓ Shared' : 'Share with friends'}
        kind={changed ? 'primary' : 'secondary'}
        accessibilityState={{ disabled: !changed }}
        onPress={share}
      />
    </Section>
  );
}
