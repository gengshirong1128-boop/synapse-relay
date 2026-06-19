import React from 'react';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppStore } from '../../store';
import { getTheme } from '../../theme/colors';

const TABS = [
  { name: 'index', label: 'Chat', icon: '⌘' },
  { name: 'sessions', label: 'Sessions', icon: '☰' },
  { name: 'files', label: 'Files', icon: '⊞' },
  { name: 'settings', label: 'Settings', icon: '⚙' },
] as const;

export function AppTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { theme, activeBackend } = useAppStore();
  const colors = getTheme(activeBackend === 'codex' ? 'codex' : 'claude', theme);
  const activeName = state.routes[state.index]?.name;

  return (
    <View style={[styles.bar, { backgroundColor: colors.tabBar, borderTopColor: colors.tabBarBorder }]}>
      {TABS.map((tab) => {
        const route = state.routes.find(r => r.name === tab.name);
        const focused = activeName === tab.name;
        const options = route ? descriptors[route.key]?.options : undefined;
        const color = focused ? colors.tabActive : colors.tabInactive;

        return (
          <Pressable
            key={tab.name}
            onPress={() => openTab(tab.name, route?.key, focused, navigation)}
            style={styles.item}
          >
            {options?.tabBarIcon
              ? options.tabBarIcon({ focused, color, size: 20 })
              : <Text style={[styles.icon, { color }]}>{tab.icon}</Text>}
            <Text style={[styles.label, { color }]} numberOfLines={1}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function openTab(name: string, key: string | undefined, focused: boolean, navigation: BottomTabBarProps['navigation']) {
  const event = navigation.emit({
    type: 'tabPress',
    target: key,
    canPreventDefault: true,
  });

  if (!focused && !event.defaultPrevented) {
    navigation.navigate(name);
  }
}

const styles = StyleSheet.create({
  bar: { width: '100%', alignSelf: 'stretch', overflow: 'hidden', height: 64, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', paddingBottom: 4 },
  item: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', gap: 3 },
  icon: { fontSize: 22 },
  label: { fontSize: 12, fontWeight: '500' },
});
