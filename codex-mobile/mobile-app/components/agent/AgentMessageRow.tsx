import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { Backend } from '../../services/websocket';
import { ChatMessage } from '../../store';
import { ThemeColors } from '../../theme/colors';
import { AgentCopy, getToolPreview } from './agentUtils';

type Props = {
  msg: ChatMessage;
  backend: Backend;
  colors: ThemeColors;
  copy: AgentCopy;
};

export function AgentMessageRow({ msg, backend, colors, copy }: Props) {
  if (msg.toolUse) return <ToolRow msg={msg} colors={colors} copy={copy} />;
  if (msg.isThinking) return <ThinkingRow msg={msg} colors={colors} />;
  if (msg.role === 'system') return <SystemRow msg={msg} colors={colors} />;
  if (msg.role === 'user') return <UserRow msg={msg} colors={colors} />;
  return <AgentRow msg={msg} backend={backend} colors={colors} copy={copy} />;
}

function ThinkingRow({ msg, colors }: Pick<Props, 'msg' | 'colors'>) {
  const [expanded, setExpanded] = useState(false);
  const isLong = msg.content.length > 100;
  const preview = isLong ? `${msg.content.slice(0, 100)}...` : msg.content;

  return (
    <Pressable
      onPress={() => setExpanded(!expanded)}
      style={[styles.thinkingRow, { backgroundColor: colors.thinkingBg, borderColor: colors.border }]}
    >
      <View style={styles.thinkingHeader}>
        <Text style={[styles.thinkingLabel, { color: colors.textTertiary }]}>Thinking</Text>
        {isLong && (
          <Text style={[styles.thinkingToggle, { color: colors.textTertiary }]}>
            {expanded ? '收起' : '展开'}
          </Text>
        )}
      </View>
      <Text style={[styles.thinkingContent, { color: colors.thinkingText }]}>
        {expanded ? msg.content : preview}
      </Text>
    </Pressable>
  );
}

function ToolRow({ msg, colors, copy }: Omit<Props, 'backend'>) {
  const status = msg.toolUse?.status || 'running';
  const statusColor = status === 'failed' || status === 'error'
    ? colors.danger
    : status === 'completed' || status === 'success'
      ? colors.accent
      : colors.textTertiary;
  const output = msg.toolUse?.output?.trim();
  const duration = formatDuration(msg.toolUse?.durationMs);

  return (
    <View style={[styles.toolRow, { backgroundColor: colors.toolCardBg, borderColor: colors.toolCardBorder }]}>
      <View style={styles.toolTop}>
        <Text style={[styles.toolLabel, { color: colors.textTertiary }]}>{copy.toolLabel}</Text>
        <Text style={[styles.toolStatus, { color: statusColor }]}>{statusLabel(status)}</Text>
      </View>
      <Text style={[styles.toolName, { color: colors.text }]} numberOfLines={1}>
        {msg.toolUse?.toolName}
      </Text>
      <Text style={[styles.toolPreview, { color: colors.textSecondary }]} numberOfLines={4}>
        {getToolPreview(msg.toolUse?.input || {})}
      </Text>
      {!!output && (
        <Text style={[styles.toolOutput, { backgroundColor: colors.codeBg, color: colors.codeText }]} numberOfLines={8}>
          {output}
        </Text>
      )}
      {(msg.toolUse?.exitCode != null || duration) && (
        <Text style={[styles.toolMeta, { color: colors.textTertiary }]}>
          {msg.toolUse?.exitCode != null ? `exit ${msg.toolUse.exitCode}` : ''}
          {msg.toolUse?.exitCode != null && duration ? ' · ' : ''}
          {duration}
        </Text>
      )}
    </View>
  );
}

function SystemRow({ msg, colors }: Pick<Props, 'msg' | 'colors'>) {
  return (
    <View style={styles.systemRow}>
      <Text style={[styles.systemText, { color: colors.textTertiary }]}>{msg.content}</Text>
    </View>
  );
}

function UserRow({ msg, colors }: Pick<Props, 'msg' | 'colors'>) {
  return (
    <View style={styles.userTurn}>
      <View style={[styles.userBubble, { backgroundColor: colors.userBubbleBg }]}>
        <Text style={[styles.userBubbleText, { color: colors.userBubbleText }]}>{msg.content}</Text>
      </View>
    </View>
  );
}

function AgentRow({ msg, backend, colors, copy }: Props) {
  // react-native-markdown-display colors text BLACK by default for any element
  // we don't override — invisible on dark themes. So every text-bearing element
  // must get an explicit color from the theme.
  const mdStyles = {
    body: { color: colors.assistantText, fontSize: 15, lineHeight: 23 },
    paragraph: { color: colors.assistantText, marginTop: 0, marginBottom: 10 },
    text: { color: colors.assistantText },
    strong: { color: colors.assistantText, fontWeight: '700' as const },
    em: { color: colors.assistantText, fontStyle: 'italic' as const },
    s: { color: colors.assistantText },
    link: { color: colors.accent, textDecorationLine: 'underline' as const },
    blockquote: {
      backgroundColor: colors.thinkingBg,
      borderColor: colors.accent,
      borderLeftWidth: 3,
      paddingHorizontal: 10,
      paddingVertical: 4,
      marginVertical: 4,
    },
    bullet_list: { marginVertical: 4 },
    ordered_list: { marginVertical: 4 },
    list_item: { color: colors.assistantText, marginVertical: 2 },
    bullet_list_icon: { color: colors.accent },
    ordered_list_icon: { color: colors.accent },
    code_inline: {
      backgroundColor: colors.codeBg,
      color: colors.codeText,
      paddingHorizontal: 4,
      borderRadius: 3,
      fontSize: 13,
    },
    fence: {
      backgroundColor: colors.codeBg,
      color: colors.codeText,
      borderColor: colors.border,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: 6,
      padding: 10,
    },
    code_block: {
      backgroundColor: colors.codeBg,
      color: colors.codeText,
      fontSize: 12,
      fontFamily: 'monospace',
    },
    hr: { backgroundColor: colors.border, height: StyleSheet.hairlineWidth, marginVertical: 10 },
    table: { borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: 4, marginVertical: 6 },
    thead: { backgroundColor: colors.thinkingBg },
    th: { color: colors.assistantText, padding: 6, fontWeight: '700' as const },
    tr: { borderColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
    td: { color: colors.assistantText, padding: 6 },
    heading1: { color: colors.text, fontSize: 18, fontWeight: '700' as const, marginTop: 6, marginBottom: 4 },
    heading2: { color: colors.text, fontSize: 16, fontWeight: '700' as const, marginTop: 6, marginBottom: 4 },
    heading3: { color: colors.text, fontSize: 15, fontWeight: '700' as const, marginTop: 4, marginBottom: 2 },
    heading4: { color: colors.text, fontSize: 15, fontWeight: '700' as const },
    heading5: { color: colors.text, fontSize: 14, fontWeight: '700' as const },
    heading6: { color: colors.text, fontSize: 14, fontWeight: '700' as const },
  };

  return (
    <View style={styles.agentTurn}>
      <Text style={[styles.turnLabel, styles.agentLabel, { color: colors.textTertiary }]}>
        {backend === 'codex' ? copy.assistantLabel : 'Claude Code'}
      </Text>
      <View style={[styles.agentBubble, { backgroundColor: colors.assistantBubbleBg, borderColor: colors.border }]}>
        {msg.isStreaming ? (
          <Text style={[styles.agentText, { color: colors.assistantText }]}>{msg.content}|</Text>
        ) : (
          <Markdown style={mdStyles}>{msg.content}</Markdown>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  userTurn: { alignItems: 'flex-end', marginVertical: 6 },
  userBubble: {
    maxWidth: '82%',
    borderRadius: 18,
    borderBottomRightRadius: 5,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  userBubbleText: { fontSize: 15, lineHeight: 21 },
  turnLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 5,
  },
  agentTurn: { alignItems: 'flex-start', marginVertical: 6 },
  agentLabel: { marginLeft: 4, marginBottom: 4 },
  agentBubble: {
    maxWidth: '90%',
    borderRadius: 18,
    borderBottomLeftRadius: 5,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  agentText: { fontSize: 15, lineHeight: 23 },
  toolRow: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
  },
  toolTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  toolLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  toolStatus: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  toolName: { fontSize: 14, fontWeight: '700', marginTop: 4 },
  toolPreview: { fontSize: 12, lineHeight: 18, fontFamily: 'monospace', marginTop: 8 },
  toolOutput: { fontSize: 12, lineHeight: 17, fontFamily: 'monospace', marginTop: 8, borderRadius: 6, padding: 9 },
  toolMeta: { fontSize: 11, fontWeight: '700', marginTop: 7 },
  systemRow: { alignItems: 'center', paddingVertical: 8 },
  systemText: { fontSize: 12 },
  thinkingRow: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: 10,
    marginVertical: 6,
  },
  thinkingHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  thinkingLabel: { fontSize: 12, fontWeight: '700', flex: 1 },
  thinkingToggle: { fontSize: 12, fontWeight: '600' },
  thinkingContent: { fontSize: 12, lineHeight: 17, marginTop: 6 },
});

function statusLabel(status: string) {
  if (status === 'completed' || status === 'success') return 'done';
  if (status === 'failed' || status === 'error') return 'failed';
  if (status === 'pending') return 'pending';
  return 'running';
}

function formatDuration(durationMs?: number | null) {
  if (durationMs == null) return '';
  if (durationMs < 1000) return `${durationMs}ms`;
  return `${(durationMs / 1000).toFixed(1)}s`;
}
