/**
 * Picking people from a circle of eighty - on a page of its own.
 *
 * Faces in a grid were fine for four friends and impossible for eighty, so
 * anywhere people are chosen shows only the few you talk to most, plus a way
 * into this: a full page that slides up with a search, your frequent people on
 * top and everyone else A to Z, each a tick away. Nothing changes until Done.
 */
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Stack, Text } from '@/components';
import { space } from '@design/tokens';
import { tapFeedback } from '@/lib/haptics';
import type { CircleMember } from '@/lib/types';
import { PeopleList } from './PeopleList';

export function FriendPicker({
  visible, title, people, frequent, selected, onDone, onClose,
}: {
  visible: boolean;
  title: string;
  people: CircleMember[];
  frequent: CircleMember[];
  selected: string[];
  onDone: (picked: string[]) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [picked, setPicked] = useState(selected);
  // Start from what was picked each time it opens.
  useEffect(() => { if (visible) setPicked(selected); }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 items-center bg-page">
        <View className="w-full max-w-frame flex-1" style={{ paddingTop: insets.top || space[5] }}>
          <Stack direction="row" align="center" gap={3} className="px-5 pb-3 pt-2">
            <Pressable accessibilityRole="button" accessibilityLabel="Cancel" onPress={onClose} className="min-h-min justify-center pr-2 active:opacity-60">
              <Text variant="callout" tone="muted">Cancel</Text>
            </Pressable>
            <Text variant="heading" className="flex-1 text-center" accessibilityRole="header">{title}</Text>
            <Text variant="micro" tone="subtle">{picked.length} picked</Text>
          </Stack>
          <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: space[5], paddingBottom: space[6] }}>
            <PeopleList
              people={people}
              frequent={frequent}
              selected={picked}
              onToggle={(id) => setPicked(picked.includes(id) ? picked.filter((p) => p !== id) : [...picked, id])}
            />
          </ScrollView>
          <View className="w-full border-t border-line-hairline px-5 py-4">
            <Button
              label={picked.length ? `Done · ${picked.length} picked` : 'Done'}
              onPress={() => { tapFeedback(); onDone(picked); }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}
