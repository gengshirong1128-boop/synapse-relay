import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ThemeColors } from '../../theme/colors';
import { AgentCopy, formatTokens } from './agentUtils';
import { Backend } from '../../services/websocket';
import { TransportMode } from '../../store';

type Props = {
  copy: AgentCopy;
  colors: ThemeColors;
  tokenUsage: { input: number; output: number; cost: number };
  model: string;
  backend: Backend;
  transportMode: TransportMode;
  workspacePath?: string;
  isRunning?: boolean;
  onModelPress?: () => void;
  onNewChat?: () => void;
};

export function AgentHeader({
  copy,
  colors,
  tokenUsage,
  model,
  transportMode,
  workspacePath,
  isRunning,
  onModelPress,
  onNewChat,
}: Props) {
  const shortModel = model ? model.replace('claude-', '').replace('-latest', '') : 'default';
  const workspaceName = workspacePath?.split(/[\\/]/).filter(Boolean).pop() || '未选择工作区';
  const modeLabel = transportMode === 'official-remote' ? 'Desktop' : 'CLI';

  return (
    <View style={[styles.header, { backgroundColor: colors.bg, borderBottomColor: colors.border }]}>
      <View style={styles.left}>
        <View style={styles.titleRow}>
          <Text style={[styles.name, { color: colors.text }]}>{copy.name}</Text>
          {isRunning && <View style={[styles.runningDot, { backgroundColor: colors.accent }]} />}
        </View>
        <View style={styles.metaRow}>
          <Pressable onPress={onModelPress} style={[styles.modelPill, { backgroundColor: colors.accentSoft }]}>
            <Text style={[styles.modelText, { color: colors.accent }]}>{shortModel}</Text>
          </Pressable>
          <Text style={[styles.mode, { color: colors.textTertiary }]}>{modeLabel}</Text>
          <Text style={[styles.workspace, { color: colors.textTertiary }]} numberOfLines={1}>
            {workspaceName}
          </Text>
        </View>
      </View>
      <View style={styles.right}>
        {onNewChat && (
          <Pressable onPress={onNewChat} style={[styles.newChatBtn, { borderColor: colors.border }]} hitSlop={8} accessibilityRole="button" accessibilityLabel="新建对话">
            <Text style={[styles.newChatText, { color: colors.accent }]}>＋ 新对话</Text>
          </Pressable>
        )}
        <Text style={[styles.tokens, { color: colors.textTertiary }]}>
          Token {formatTokens(tokenUsage.input)}/{formatTokens(tokenUsage.output)}
        </Text>
        <Text style={[styles.cost, { color: colors.text }]}>费用 ${tokenUsage.cost.toFixed(4)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  left: { flex: 1, minWidth: 0, gap: 5 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
  name: { fontSize: 17, fontWeight: '800' },
  runningDot: { width: 7, height: 7, borderRadius: 4 },
  modelPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  modelText: { fontSize: 12, fontWeight: '700' },
  mode: { fontSize: 12, fontWeight: '700' },
  workspace: { fontSize: 12, flex: 1 },
  right: { alignItems: 'flex-end' },
  newChatBtn: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 4 },
  newChatText: { fontSize: 12, fontWeight: '700' },
  tokens: { fontSize: 11 },
  cost: { fontSize: 13, fontWeight: '800', marginTop: 2 },
});
