/**
 * Cancelling something, with one "are you sure" in between.
 *
 * Done is not the only way a task ends. Plans fall through and work gets
 * dropped, and the week should say so rather than carry a ghost. A plan with
 * friends is answered rather than deleted - "can't go" for one you were asked
 * to, called off for everyone when it is yours - so nobody is left waiting.
 */
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Button, Stack, Text } from '@/components';
import { color, radius } from '@design/tokens';
import { answerPlan, cancelPlan } from '@/lib/social';
import { successFeedback, tapFeedback } from '@/lib/haptics';
import { useStore } from '@/state/store';
import type { Item } from '@/lib/types';

/** What cancelling does to this one, in a line. */
function consequence(item: Item, sittings: number): { title: string; body: string; yes: string } {
  if (item.id.startsWith('going-inv-')) {
    return { title: `Can’t go to ${item.title}?`, body: 'The host and everyone else see you’re out.', yes: 'Yes, I can’t go' };
  }
  if (item.id.startsWith('inv-')) {
    return { title: `Call off ${item.title}?`, body: 'It comes off everyone’s week, and they’re told.', yes: 'Yes, call it off' };
  }
  return {
    title: `Cancel ${item.title}?`,
    body: sittings
      ? `It and its ${sittings} booked sitting${sittings === 1 ? '' : 's'} come off your week. This can’t be undone.`
      : 'It comes off your week. This can’t be undone.',
    yes: 'Yes, cancel it',
  };
}

export function CancelTask({
  item, onCancelled, label = '🗑 Cancel', kind = 'secondary',
}: { item: Item; onCancelled?: () => void; label?: string; kind?: 'secondary' | 'quiet' }) {
  const [asking, setAsking] = useState(false);
  const cancelItem = useStore((state) => state.cancelItem);
  const sittings = useStore((state) => state.items.filter((other) => other.parentId === item.id && !other.sessionDone).length);
  const words = consequence(item, sittings);

  const confirm = async () => {
    setAsking(false);
    if (item.id.startsWith('going-inv-')) await answerPlan(item.id.slice('going-'.length), false);
    else if (item.id.startsWith('inv-')) await cancelPlan(item.id);
    else cancelItem(item.id);
    successFeedback();
    onCancelled?.();
  };

  return (
    <>
      <Button label={label} kind={kind} onPress={() => { tapFeedback(); setAsking(true); }} />
      <Modal visible={asking} transparent animationType="fade" onRequestClose={() => setAsking(false)}>
        <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Keep it"
            onPress={() => setAsking(false)}
            style={[StyleSheet.absoluteFill, { backgroundColor: color.ink.default, opacity: 0.4 }]}
          />
          <View className="w-full max-w-frame bg-page p-6" style={{ borderRadius: radius.xl }}>
            <Stack gap={4} align="center">
              <View className="items-center justify-center rounded-pill" style={{ width: 64, height: 64, backgroundColor: color.band.heavy.wash }}>
                <Text variant="title">🗑</Text>
              </View>
              <Stack gap={2} align="center">
                <Text variant="heading" className="text-center">{words.title}</Text>
                <Text variant="footnote" tone="muted" className="text-center">{words.body}</Text>
              </Stack>
              <Stack direction="row" gap={3} className="w-full">
                <Button label="Keep it" kind="secondary" className="flex-1" onPress={() => { tapFeedback(); setAsking(false); }} />
                <Button label={words.yes} kind="danger" className="flex-1" onPress={() => void confirm()} />
              </Stack>
            </Stack>
          </View>
        </View>
      </Modal>
    </>
  );
}
