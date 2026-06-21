import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ThemeColors } from '../../theme/colors';
import { border, fontSize, fontWeight, radius, spacing } from '../../theme/tokens';
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
  const tokenLabel = `Token ${formatTokens(tokenUsage.input)}/${formatTokens(tokenUsage.output)} · $${tokenUsage.cost.toFixed(4)}`;
  const metaLabel = `${shortModel} · ${modeLabel} · ${workspaceName} · ${tokenLabel}`;

  return (
    <View style={[styles.header, { backgroundColor: colors.bg, borderBottomColor: colors.border }]}>
      <View style={styles.topRow}>
        <View style={styles.titleGroup}>
          <Text style={[styles.name, { color: colors.text }]}>{copy.name}</Text>
          {isRunning && <View style={[styles.runningDot, { backgroundColor: colors.accent }]} />}
        </View>
        <View style={styles.actions}>
          {onNewChat && (
            <HeaderIconButton
              colors={colors}
              onPress={onNewChat}
              accessibilityLabel="新建对话"
              icon={<PlusIcon color={colors.textSecondary} />}
            />
          )}
          {onModelPress && (
            <HeaderIconButton
              colors={colors}
              onPress={onModelPress}
              accessibilityLabel="打开设置"
              icon={<SlidersIcon color={colors.textSecondary} />}
            />
          )}
        </View>
      </View>
      <Pressable
        disabled={!onModelPress}
        onPress={onModelPress}
        style={({ pressed }) => [styles.metaPressable, { opacity: pressed ? 0.6 : 1 }]}
        accessibilityRole="button"
        accessibilityLabel="查看模型和工作区设置"
      >
        <Text style={[styles.metaText, { color: colors.textTertiary }]} numberOfLines={1}>
          {metaLabel}
        </Text>
      </Pressable>
    </View>
  );
}

function HeaderIconButton({
  colors,
  onPress,
  accessibilityLabel,
  icon,
}: {
  colors: ThemeColors;
  onPress: () => void;
  accessibilityLabel: string;
  icon: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={spacing.sm}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.iconButton,
        { borderColor: colors.border, opacity: pressed ? 0.6 : 1 },
      ]}
    >
      {icon}
    </Pressable>
  );
}

function PlusIcon({ color }: { color: string }) {
  return (
    <View style={styles.plusIcon}>
      <View style={[styles.plusLineHorizontal, { backgroundColor: color }]} />
      <View style={[styles.plusLineVertical, { backgroundColor: color }]} />
    </View>
  );
}

function SlidersIcon({ color }: { color: string }) {
  return (
    <View style={styles.slidersIcon}>
      <View style={styles.sliderRow}>
        <View style={[styles.sliderLine, { backgroundColor: color }]} />
        <View style={[styles.sliderKnob, styles.sliderKnobStart, { backgroundColor: color }]} />
      </View>
      <View style={styles.sliderRow}>
        <View style={[styles.sliderLine, { backgroundColor: color }]} />
        <View style={[styles.sliderKnob, styles.sliderKnobEnd, { backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.xs,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  titleGroup: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  name: { fontSize: fontSize.title, fontWeight: fontWeight.bold },
  runningDot: { width: spacing.sm, height: spacing.sm, borderRadius: radius.sm },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconButton: {
    width: spacing.xxl + spacing.md,
    height: spacing.xxl + spacing.md,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaPressable: { minWidth: 0 },
  metaText: { fontSize: fontSize.small, lineHeight: fontSize.small + spacing.xs, fontWeight: fontWeight.medium },
  plusIcon: {
    width: spacing.lg,
    height: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusLineHorizontal: {
    position: 'absolute',
    width: spacing.lg,
    height: border.thin,
    borderRadius: radius.sm,
  },
  plusLineVertical: {
    position: 'absolute',
    width: border.thin,
    height: spacing.lg,
    borderRadius: radius.sm,
  },
  slidersIcon: {
    width: spacing.xl,
    gap: spacing.xs,
  },
  sliderRow: {
    height: spacing.xs,
    justifyContent: 'center',
  },
  sliderLine: {
    height: border.thin,
    borderRadius: radius.sm,
  },
  sliderKnob: {
    position: 'absolute',
    width: spacing.xs,
    height: spacing.xs,
    borderRadius: radius.sm,
  },
  sliderKnobStart: { left: spacing.xs },
  sliderKnobEnd: { right: spacing.xs },
});
