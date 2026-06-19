import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Backend } from '../../services/websocket';
import { ThemeColors } from '../../theme/colors';
import { t } from '../../i18n';

type Props = {
  backend: Backend;
  colors: ThemeColors;
  onConnect: () => void;
};

export function AgentDisconnected({ backend, colors, onConnect }: Props) {
  return (
    <View style={[styles.center, { backgroundColor: colors.bg }]}>
      <Text style={[styles.mark, { color: colors.accent }]}>{backend === 'codex' ? '◎' : '⌘'}</Text>
      <Text style={[styles.title, { color: colors.text }]}>Connect desktop host</Text>
      <Text style={[styles.body, { color: colors.textSecondary }]}>
        CodexMobile controls tools running on your computer.
      </Text>
      <Pressable style={[styles.button, { backgroundColor: colors.accent }]} onPress={onConnect}>
        <Text style={[styles.buttonText, { color: colors.bg }]}>{t('connect')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 36 },
  mark: { fontSize: 40, marginBottom: 18 },
  title: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  body: { width: '100%', maxWidth: 280, fontSize: 14, lineHeight: 20, marginTop: 8, marginBottom: 22, textAlign: 'center' },
  button: { paddingHorizontal: 28, paddingVertical: 12, borderRadius: 22 },
  buttonText: { fontSize: 15, fontWeight: '700' },
});
