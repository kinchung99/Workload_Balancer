import { Tabs } from 'expo-router';
import { color, frame, target } from '@design/tokens';
import { Text } from '@/components';
import { TabIcon, type TabName } from '@/components/layout/TabIcon';

/**
 * Four tabs: where you are, which part of you is empty, what is coming, and
 * what you can do about it. Rebalance and the drafter are not tabs - they are
 * reached from the thing that flagged them.
 */
const TABS: Array<{ name: string; title: string; icon: TabName }> = [
  { name: 'index',   title: 'Home',    icon: 'home' },
  { name: 'areas',   title: 'Areas',   icon: 'areas' },
  { name: 'plan',    title: 'Plan',    icon: 'plan' },
  { name: 'actions', title: 'Tonight', icon: 'actions' },
];

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color.ink.default,
        tabBarInactiveTintColor: color.ink.subtle,
        tabBarStyle: {
          backgroundColor: color.surface.page,
          borderTopColor: color.line.hairline,
          height: target.tabBar + 24,
          paddingTop: 6,
          // Held to the artboard and centred, like every screen above it. On a
          // desktop browser the bar used to run the full width of the window
          // while the content sat in a 390pt column, which read as broken.
          alignSelf: 'center',
          width: '100%',
          maxWidth: frame.width,
        },
        tabBarItemStyle: { paddingHorizontal: 0 },
      }}
    >
      {TABS.map(({ name, title, icon }) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title,
            tabBarIcon: ({ focused }) => <TabIcon name={icon} active={focused} />,
            // Our own Text rather than the navigator's, which clips to one line
            // inside its own padding - "Tonight" was arriving as "Toni...". Only
            // visible once the bar was held to 390pt; full width had hidden it.
            tabBarLabel: ({ focused }) => (
              <Text variant="micro" tone={focused ? 'default' : 'subtle'}>{title}</Text>
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
