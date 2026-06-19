import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ApprovalDecision, ApprovalRequest } from '../../store';
import { ThemeColors } from '../../theme/colors';

type Props = {
  colors: ThemeColors;
  approvals: ApprovalRequest[];
  onRespond: (approvalId: string, decision: ApprovalDecision) => void;
};

export function ApprovalBanner({ colors, approvals, onRespond }: Props) {
  const approval = approvals[0];
  if (!approval) return null;

  return (
    <View style={[styles.wrap, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>{approval.title}</Text>
        <Text style={[styles.kind, { color: colors.textTertiary }]}>{kindLabel(approval.kind)}</Text>
      </View>

      {!!approval.reason && (
        <Text style={[styles.reason, { color: colors.textSecondary }]} numberOfLines={2}>
          {approval.reason}
        </Text>
      )}

      <Text style={[styles.preview, { backgroundColor: colors.codeBg, color: colors.codeText }]} numberOfLines={4}>
        {approval.preview || approval.command || formatPermissions(approval.permissions) || '等待确认'}
      </Text>

      {!!approval.cwd && (
        <Text style={[styles.cwd, { color: colors.textTertiary }]} numberOfLines={1}>
          {approval.cwd}
        </Text>
      )}

      <View style={styles.actions}>
        <Pressable
          style={[styles.primary, { backgroundColor: colors.accent }]}
          onPress={() => onRespond(approval.id, 'approve_once')}
        >
          <Text style={[styles.primaryText, { color: colors.bg }]}>允许一次</Text>
        </Pressable>
        <Pressable
          style={[styles.secondary, { borderColor: colors.border }]}
          onPress={() => onRespond(approval.id, 'approve_session')}
        >
          <Text style={[styles.secondaryText, { color: colors.text }]}>本会话允许</Text>
        </Pressable>
        <Pressable
          style={[styles.secondary, { borderColor: colors.border }]}
          onPress={() => onRespond(approval.id, 'deny')}
        >
          <Text style={[styles.secondaryText, { color: colors.textSecondary }]}>拒绝</Text>
        </Pressable>
      </View>
    </View>
  );
}

function kindLabel(kind: ApprovalRequest['kind']) {
  if (kind === 'command') return 'Command';
  if (kind === 'file_change') return 'File change';
  if (kind === 'permissions') return 'Permissions';
  return 'Approval';
}

function formatPermissions(permissions?: Record<string, unknown>) {
  if (!permissions) return '';
  return JSON.stringify(permissions);
}

const styles = StyleSheet.create({
  wrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { fontSize: 15, fontWeight: '800', flex: 1 },
  kind: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  reason: { fontSize: 13, lineHeight: 18 },
  preview: {
    width: '100%',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: 'monospace',
  },
  cwd: { fontSize: 11 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  primary: { borderRadius: 7, paddingHorizontal: 12, paddingVertical: 8 },
  primaryText: { fontSize: 13, fontWeight: '800' },
  secondary: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 7,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  secondaryText: { fontSize: 13, fontWeight: '700' },
});
