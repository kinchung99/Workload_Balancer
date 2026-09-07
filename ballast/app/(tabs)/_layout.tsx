import { Tabs } from 'expo-router';
import { color, target, type } from '@design/tokens';
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
        },
        tabBarLabelStyle: { fontSize: type.micro.fontSize, letterSpacing: type.micro.letterSpacing },
      }}
    >
      {TABS.map(({ name, title, icon }) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{ title, tabBarIcon: ({ focused }) => <TabIcon name={icon} active={focused} /> }}
        />
      ))}
    </Tabs>
  );
}
