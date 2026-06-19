import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, useColorScheme } from 'react-native';
import { useEffect } from 'react';
import { attemptAutoConnect } from '../services/auth';
import { useRelayMessages } from '../hooks/useRelayMessages';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { useAppStore } from '../store';
import { getTheme } from '../theme/colors';

export default function RootLayout() {
  useRelayMessages();
  usePushNotifications();

  const systemScheme = useColorScheme();
  const { theme, setTheme, activeBackend } = useAppStore();
  const colors = getTheme(activeBackend === 'codex' ? 'codex' : 'claude', theme);

  useEffect(() => {
    if (systemScheme) setTheme(systemScheme);
  }, [systemScheme]);

  useEffect(() => {
    attemptAutoConnect();
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{
        headerStyle: { backgroundColor: colors.headerBg },
        headerTintColor: colors.headerText,
        contentStyle: { backgroundColor: colors.bg },
      }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="connect" options={{ title: '连接服务器', presentation: 'modal' }} />
        <Stack.Screen name="profiles" options={{ title: 'API 配置管理', presentation: 'modal' }} />
        <Stack.Screen name="chat/[id]" options={{ title: '对话' }} />
      </Stack>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
