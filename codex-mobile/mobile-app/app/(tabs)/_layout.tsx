import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useAppStore } from '../../store';
import { getTheme } from '../../theme/colors';
import { AppTabBar } from '../../components/navigation/AppTabBar';

export default function TabLayout() {
  const { theme: mode, activeBackend } = useAppStore();
  const brand = activeBackend === 'codex' ? 'codex' : 'claude';
  const colors = getTheme(brand, mode);
  const title = activeBackend === 'codex' ? 'Codex' : 'Claude Code';

  return (
    <Tabs tabBar={(props) => <AppTabBar {...props} />} screenOptions={{
      headerStyle: { backgroundColor: colors.headerBg },
      headerTintColor: colors.headerText,
      headerShadowVisible: false,
    }}>
      <Tabs.Screen name="index" options={{
        title,
        headerTitleStyle: { fontWeight: '700', fontSize: 17 },
        tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>⌘</Text>,
        tabBarLabel: 'Chat',
      }} />
      <Tabs.Screen name="sessions" options={{
        title: 'Sessions',
        tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>☰</Text>,
      }} />
      <Tabs.Screen name="files" options={{
        title: 'Files',
        tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>⊞</Text>,
      }} />
      <Tabs.Screen name="settings" options={{
        title: 'Settings',
        tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>⚙</Text>,
      }} />
    </Tabs>
  );
}
