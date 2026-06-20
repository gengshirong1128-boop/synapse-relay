import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Backend, ConnectionState } from '../../services/websocket';
import { ThemeColors } from '../../theme/colors';
import { t } from '../../i18n';

type Props = {
  backend: Backend;
  colors: ThemeColors;
  connectionState: ConnectionState;
  onConnect: () => void;
};

export function AgentDisconnected({ backend, colors, connectionState, onConnect }: Props) {
  const connecting = connectionState === 'connecting';

  return (
    <View style={[styles.center, { backgroundColor: colors.bg }]}>
      {connecting ? (
        <ActivityIndicator size="large" color={colors.accent} style={styles.spinner} />
      ) : (
        <Text style={[styles.mark, { color: colors.accent }]}>{backend === 'codex' ? '◎' : '⌘'}</Text>
      )}
      <Text style={[styles.title, { color: colors.text }]}>
        {connecting ? '正在连接电脑…' : '与电脑的连接已断开'}
      </Text>
      <Text style={[styles.body, { color: colors.textSecondary }]}>
        {connecting
          ? '正在自动重连，请稍候。若长时间无响应，请确认电脑上的中继服务仍在运行。'
          : '电脑可能已休眠或关机，或中继服务已停止。请唤醒电脑并确认服务在运行，然后重新连接。'}
      </Text>
      {!connecting && (
        <Pressable style={[styles.button, { backgroundColor: colors.accent }]} onPress={onConnect}>
          <Text style={[styles.buttonText, { color: colors.bg }]}>{t('connect')}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 36 },
  mark: { fontSize: 40, marginBottom: 18 },
  spinner: { marginBottom: 18 },
  title: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  body: { width: '100%', maxWidth: 300, fontSize: 14, lineHeight: 21, marginTop: 10, marginBottom: 22, textAlign: 'center' },
  button: { paddingHorizontal: 28, paddingVertical: 12, borderRadius: 22 },
  buttonText: { fontSize: 15, fontWeight: '700' },
});
