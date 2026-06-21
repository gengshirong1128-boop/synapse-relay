import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import Markdown from 'react-native-markdown-display';
import type { RenderRules } from 'react-native-markdown-display';
import { Backend } from '../../services/websocket';
import { ChatMessage } from '../../store';
import { ThemeColors } from '../../theme/colors';
import { fontSize, fontWeight, radius, spacing } from '../../theme/tokens';
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
      style={({ pressed }) => [
        styles.thinkingRow,
        { backgroundColor: colors.thinkingBg, borderColor: colors.border, opacity: pressed ? 0.72 : 1 },
      ]}
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
    body: { color: colors.assistantText, fontSize: fontSize.bodyLg, lineHeight: fontSize.bodyLg + spacing.sm },
    paragraph: { color: colors.assistantText, marginTop: 0, marginBottom: spacing.md },
    text: { color: colors.assistantText },
    strong: { color: colors.assistantText, fontWeight: fontWeight.bold },
    em: { color: colors.assistantText, fontStyle: 'italic' as const },
    s: { color: colors.assistantText },
    link: { color: colors.accent, textDecorationLine: 'underline' as const },
    blockquote: {
      backgroundColor: colors.thinkingBg,
      borderColor: colors.accent,
      borderLeftWidth: StyleSheet.hairlineWidth,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      marginVertical: spacing.xs,
    },
    bullet_list: { marginVertical: spacing.xs },
    ordered_list: { marginVertical: spacing.xs },
    list_item: { color: colors.assistantText, marginVertical: spacing.xs },
    bullet_list_icon: { color: colors.accent },
    ordered_list_icon: { color: colors.accent },
    code_inline: {
      backgroundColor: colors.codeBg,
      color: colors.codeText,
      paddingHorizontal: spacing.xs,
      borderRadius: radius.sm,
      fontSize: fontSize.small,
    },
    fence: { marginVertical: spacing.sm },
    code_block: {
      backgroundColor: colors.codeBg,
      color: colors.codeText,
      fontSize: fontSize.small,
      fontFamily: 'monospace',
    },
    hr: { backgroundColor: colors.border, height: StyleSheet.hairlineWidth, marginVertical: spacing.md },
    table: { borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.sm, marginVertical: spacing.sm },
    thead: { backgroundColor: colors.thinkingBg },
    th: { color: colors.assistantText, padding: spacing.sm, fontWeight: fontWeight.bold },
    tr: { borderColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
    td: { color: colors.assistantText, padding: spacing.sm },
    heading1: { color: colors.text, fontSize: fontSize.title, fontWeight: fontWeight.bold, marginTop: spacing.sm, marginBottom: spacing.xs },
    heading2: { color: colors.text, fontSize: fontSize.bodyLg, fontWeight: fontWeight.bold, marginTop: spacing.sm, marginBottom: spacing.xs },
    heading3: { color: colors.text, fontSize: fontSize.bodyLg, fontWeight: fontWeight.bold, marginTop: spacing.xs, marginBottom: 0 },
    heading4: { color: colors.text, fontSize: fontSize.bodyLg, fontWeight: fontWeight.bold },
    heading5: { color: colors.text, fontSize: fontSize.body, fontWeight: fontWeight.bold },
    heading6: { color: colors.text, fontSize: fontSize.body, fontWeight: fontWeight.bold },
  };
  const mdRules: RenderRules = {
    fence: (node) => (
      <CodeBlock
        key={node.key}
        code={trimCode(node.content)}
        language={codeLanguage(node)}
        colors={colors}
      />
    ),
    code_block: (node) => (
      <CodeBlock
        key={node.key}
        code={trimCode(node.content)}
        language="code"
        colors={colors}
      />
    ),
  };

  return (
    <View style={styles.agentTurn}>
      <Text style={[styles.turnLabel, styles.agentLabel, { color: colors.textTertiary }]}>
        {backend === 'codex' ? copy.assistantLabel : 'Claude Code'}
      </Text>
      <View style={styles.agentContent}>
        {msg.isStreaming ? (
          <Text style={[styles.agentText, { color: colors.assistantText }]}>{msg.content}|</Text>
        ) : (
          <Markdown style={mdStyles} rules={mdRules}>{msg.content}</Markdown>
        )}
      </View>
    </View>
  );
}

function CodeBlock({ code, language, colors }: { code: string; language: string; colors: ThemeColors }) {
  const [copied, setCopied] = useState(false);

  const onCopy = () => {
    void Clipboard.setStringAsync(code)
      .then(() => setCopied(true))
      .catch(() => setCopied(false));
  };

  // Reset the "已复制" label back to "复制" so a later glance doesn't look like
  // a fresh copy just happened.
  React.useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  return (
    <View style={[styles.codeBlock, { backgroundColor: colors.codeBg, borderColor: colors.border }]}>
      <View style={[styles.codeBlockHeader, { borderBottomColor: colors.border }]}>
        <Text style={[styles.codeLanguage, { color: colors.textTertiary }]} numberOfLines={1}>
          {language}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={onCopy}
          style={({ pressed }) => [styles.copyButton, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Text style={[styles.copyButtonText, { color: colors.textSecondary }]}>
            {copied ? '已复制' : '复制'}
          </Text>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Text style={[styles.codeText, { color: colors.codeText }]}>{code}</Text>
      </ScrollView>
    </View>
  );
}

type CodeNode = {
  content: string;
  sourceInfo?: string;
};

function trimCode(code: string) {
  return code.endsWith('\n') ? code.slice(0, -1) : code;
}

function codeLanguage(node: CodeNode) {
  const info = node.sourceInfo?.trim();
  if (!info) return 'code';
  return info.split(/\s+/)[0] || 'code';
}

const styles = StyleSheet.create({
  userTurn: { alignItems: 'flex-end' },
  userBubble: {
    maxWidth: '82%',
    borderRadius: radius.bubble,
    borderBottomRightRadius: radius.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  userBubbleText: { fontSize: fontSize.bodyLg, lineHeight: fontSize.bodyLg + spacing.sm },
  turnLabel: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.bold,
    letterSpacing: 0,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  agentTurn: { alignItems: 'stretch' },
  agentLabel: { marginLeft: spacing.xs },
  agentContent: { alignSelf: 'stretch' },
  agentText: { fontSize: fontSize.bodyLg, lineHeight: fontSize.bodyLg + spacing.sm },
  toolRow: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  toolTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  toolLabel: { fontSize: fontSize.caption, fontWeight: fontWeight.bold, textTransform: 'uppercase' },
  toolStatus: { fontSize: fontSize.caption, fontWeight: fontWeight.heavy, textTransform: 'uppercase' },
  toolName: { fontSize: fontSize.body, fontWeight: fontWeight.bold, marginTop: spacing.xs },
  toolPreview: { fontSize: fontSize.small, lineHeight: fontSize.small + spacing.sm, fontFamily: 'monospace', marginTop: spacing.sm },
  toolOutput: {
    fontSize: fontSize.small,
    lineHeight: fontSize.small + spacing.xs,
    fontFamily: 'monospace',
    marginTop: spacing.sm,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  toolMeta: { fontSize: fontSize.caption, fontWeight: fontWeight.bold, marginTop: spacing.sm },
  systemRow: { alignItems: 'center', paddingVertical: spacing.sm },
  systemText: { fontSize: fontSize.small },
  thinkingRow: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  thinkingHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  thinkingLabel: { fontSize: fontSize.small, fontWeight: fontWeight.bold, flex: 1 },
  thinkingToggle: { fontSize: fontSize.small, fontWeight: fontWeight.medium },
  thinkingContent: { fontSize: fontSize.small, lineHeight: fontSize.small + spacing.xs, marginTop: spacing.sm },
  codeBlock: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    marginVertical: spacing.sm,
    overflow: 'hidden',
  },
  codeBlockHeader: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  codeLanguage: {
    flex: 1,
    fontSize: fontSize.caption,
    fontWeight: fontWeight.bold,
    textTransform: 'uppercase',
  },
  copyButton: { paddingHorizontal: spacing.xs, paddingVertical: spacing.xs },
  copyButtonText: { fontSize: fontSize.caption, fontWeight: fontWeight.medium },
  codeText: {
    fontFamily: 'monospace',
    fontSize: fontSize.small,
    lineHeight: fontSize.small + spacing.sm,
    padding: spacing.md,
  },
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
