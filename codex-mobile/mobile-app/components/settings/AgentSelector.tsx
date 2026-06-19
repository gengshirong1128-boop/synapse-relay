import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Backend } from '../../services/websocket';
import { ThemeColors } from '../../theme/colors';

type Props = {
  activeBackend: Backend;
  colors: ThemeColors;
  onChange: (backend: Backend) => void;
};

export function AgentSelector({ activeBackend, colors, onChange }: Props) {
  return (
    <View style={[styles.segment, { borderColor: colors.border }]}>
      <AgentButton
        label="Claude Code"
        active={activeBackend === 'claude-code'}
        colors={colors}
        onPress={() => onChange('claude-code')}
      />
      <AgentButton
        label="Codex"
        active={activeBackend === 'codex'}
        colors={colors}
        onPress={() => onChange('codex')}
      />
    </View>
  );
}

function AgentButton({
  label,
  active,
  colors,
  onPress,
}: {
  label: string;
  active: boolean;
  colors: ThemeColors;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.button, active && { backgroundColor: colors.accent }]}
    >
      <Text style={[styles.text, { color: active ? colors.bg : colors.textSecondary }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  segment: { alignSelf: 'stretch', minWidth: 0, flexDirection: 'row', borderWidth: 1, borderRadius: 8, overflow: 'hidden' },
  button: { flex: 1, minWidth: 0, alignItems: 'center', paddingVertical: 10 },
  text: { fontSize: 14, fontWeight: '700' },
});
