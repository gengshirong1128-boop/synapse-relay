import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAppStore } from '../store';
import { getTheme } from '../theme/colors';

interface Props {
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
}

export function TokenCounter({ inputTokens, outputTokens, estimatedCost }: Props) {
  const { activeBackend, theme } = useAppStore();
  const colors = getTheme(activeBackend === 'codex' ? 'codex' : 'claude', theme);

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.item}>
        <Text style={[styles.label, { color: colors.textTertiary }]}>输入</Text>
        <Text style={[styles.value, { color: colors.text }]}>{formatTokens(inputTokens)}</Text>
      </View>
      <View style={[styles.divider, { backgroundColor: colors.border }]} />
      <View style={styles.item}>
        <Text style={[styles.label, { color: colors.textTertiary }]}>输出</Text>
        <Text style={[styles.value, { color: colors.text }]}>{formatTokens(outputTokens)}</Text>
      </View>
      <View style={[styles.divider, { backgroundColor: colors.border }]} />
      <View style={styles.item}>
        <Text style={[styles.label, { color: colors.textTertiary }]}>费用</Text>
        <Text style={[styles.cost, { color: colors.accent }]}>${estimatedCost.toFixed(4)}</Text>
      </View>
    </View>
  );
}

function formatTokens(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, paddingVertical: 7, paddingHorizontal: 10, marginHorizontal: 14, marginTop: 10, borderWidth: 1 },
  item: { alignItems: 'center', flex: 1 },
  label: { fontSize: 10 },
  value: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  cost: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  divider: { width: 1, height: 24 },
});
