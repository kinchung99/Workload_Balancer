import { Tabs } from 'expo-router';
import { color, frame, target } from '@design/tokens';
import { Text } from '@/components';
import { TabIcon, type TabName } from '@/components/layout/TabIcon';

/**
 * Four tabs: how you are, what is coming, who else is out there, and everything
 * about you.
 *
 * Friends is a tab because it is the one part of this app that is between
 * people, and the only reason to open it on a week that is going fine. Areas and
 * Tonight moved under You - they were tabs because they were built early, not
 * because they earn a quarter of the bar.
 */
const TABS: Array<{ name: string; title: string; icon: TabName }> = [
  { name: 'index',   title: 'Home',    icon: 'home' },
  { name: 'plan',    title: 'Plan',    icon: 'plan' },
  { name: 'friends', title: 'Friends', icon: 'areas' },
  { name: 'you',     title: 'You',     icon: 'actions' },
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
