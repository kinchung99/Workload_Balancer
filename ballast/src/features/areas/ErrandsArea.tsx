import { Pressable, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Card, Checkbox, Chip, Divider, Stack, Text } from '@/components';
import { color } from '@design/tokens';
import type { ErrandCategory } from '@/lib/types';
import { useStore } from '@/state/store';

const ORDER: ErrandCategory[] = ['Groceries', 'Admin', 'Academic', 'Home'];

/** Errands — said in one breath, sorted into batches you can do in one trip. */
export function ErrandsArea() {
  const { errands, toggleErrand } = useStore();
  const grouped = ORDER.map((category) => ({
    category,
    items: errands.filter((errand) => errand.category === category),
  })).filter((group) => group.items.length > 0);

  return (
    <Stack gap={6}>
      <Card gap={4} align="center">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tap and say what you need to do"
          className="h-16 w-16 items-center justify-center rounded-pill bg-inverse active:opacity-80"
        >
          <Svg width={22} height={22} viewBox="0 0 22 22">
            <Path
              d="M11 3a2.5 2.5 0 0 1 2.5 2.5v5a2.5 2.5 0 0 1-5 0v-5A2.5 2.5 0 0 1 11 3zM5.5 10a5.5 5.5 0 0 0 11 0M11 15.5V19"
              stroke={color.ink.inverse} strokeWidth={1.8} fill="none" strokeLinecap="round"
            />
          </Svg>
        </Pressable>
        <Text variant="footnote" tone="subtle">Tap and say what you need to do</Text>
      </Card>

      {grouped.map((group) => {
        const left = group.items.filter((item) => !item.done).length;
        return (
          <Stack key={group.category} gap={3}>
            <Stack direction="row" justify="between" align="center">
              <Text variant="micro" tone="subtle">{group.category.toUpperCase()}</Text>
              <Chip label={String(left)} readOnly />
            </Stack>
            <Card pad={0} gap={0} className="px-5">
              {group.items.map((errand, index) => (
                <Stack key={errand.id}>
                  {index > 0 ? <Divider /> : null}
                  <View className="py-3">
                    <Checkbox label={errand.title} checked={errand.done} onPress={() => toggleErrand(errand.id)} />
                  </View>
                </Stack>
              ))}
            </Card>
          </Stack>
        );
      })}

      <Card tone="steady" gap={2}>
        <Text variant="callout" weight="semibold" tone="steady">Batched by where they are.</Text>
        <Text variant="footnote" tone="muted">Same trip, four things — the one saving that costs you nothing.</Text>
      </Card>
    </Stack>
  );
}
