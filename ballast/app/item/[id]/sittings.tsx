import { View } from 'react-native';
import { useLocalSearchParams, type Href } from 'expo-router';
import { PageHeader, Screen, Stack, Text } from '@/components';
import { FAMILY } from '@design/families';
import { formatShort } from '@/lib/dates';
import { useItemsWithLogs } from '@/state/selectors';
import { Sittings } from '@/features/item/Sittings';

/** The seeded piece of owing work, so `/item/.../sittings` renders in the static export. */
export async function generateStaticParams() {
  return [{ id: 'algo-set' }];
}

/**
 * `/item/<id>/sittings` — planning the sittings, on a page of its own.
 *
 * Suggesting, adjusting, adding and moving sittings is the biggest thing you
 * can do to a piece of work, and it used to sit in the middle of the task page
 * with everything else. Here it has the room it needs: the booked ones, the
 * suggestion with its reasons, and the editor for each.
 */
export default function ItemSittings() {
  const { id, suggest } = useLocalSearchParams<{ id: string; suggest?: string }>();
  const items = useItemsWithLogs();
  const item = items.find((candidate) => candidate.id === id);

  return (
    <Screen back={`/item/${id}` as Href} backLabel="Task">
      <Stack gap={5} className="pt-2">
        {item ? (
          <>
            <PageHeader
              sticker="clock"
              wash={FAMILY.week.wash}
              eyebrow={`Due ${formatShort(item.deadline ?? item.date)}`}
              title="Sittings"
              sub={item.title}
            />
            <Sittings item={item} items={items} autoSuggest={suggest === '1'} />
          </>
        ) : (
          <Text variant="heading" className="pt-6">That work is no longer in your week.</Text>
        )}
        <View className="h-2" />
      </Stack>
    </Screen>
  );
}
