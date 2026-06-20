import React, { useEffect, useState } from 'react';
import { View, Text, SectionList, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Backend, relayClient } from '../../services/websocket';
import { Session, useAppStore } from '../../store';
import { getTheme } from '../../theme/colors';

type SessionSection = {
  title: string;
  data: Session[];
};

export default function SessionsScreen() {
  const { sessions, activeSessionId, activeBackend, theme, setActiveSession, updateSessionState, startNewSession } = useAppStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const colors = getTheme(activeBackend === 'codex' ? 'codex' : 'claude', theme);

  const refreshSessions = () => {
    setRefreshing(true);
    relayClient.send({ type: 'session_list', payload: {} });
    setTimeout(() => setRefreshing(false), 800);
  };

  const newChat = () => {
    startNewSession();
    router.push('/');
  };

  useEffect(() => {
    refreshSessions();
  }, []);

  const sections: SessionSection[] = [
    {
      title: 'Claude Code Desktop',
      data: sessions.filter(s => s.backend === 'claude-code' && s.transportMode === 'official-remote'),
    },
    {
      title: 'Claude Code CLI',
      data: sessions.filter(s => s.backend === 'claude-code' && (!s.transportMode || s.transportMode === 'bridge')),
    },
    {
      title: 'Codex Desktop',
      data: sessions.filter(s => s.backend === 'codex' && s.transportMode === 'official-remote'),
    },
    {
      title: 'Codex CLI',
      data: sessions.filter(s => s.backend === 'codex' && (!s.transportMode || s.transportMode === 'bridge')),
    },
  ].filter(section => section.data.length > 0);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <Pressable onPress={newChat} style={[styles.newChatBar, { backgroundColor: colors.accent }]}>
        <Text style={[styles.newChatText, { color: colors.bg }]}>＋ 新建对话</Text>
      </Pressable>
      {sessions.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>暂无会话</Text>
          <Text style={[styles.emptyHint, { color: colors.textTertiary }]}>发送第一条消息后会自动创建会话</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshing={refreshing}
          onRefresh={refreshSessions}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>{section.title}</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <Pressable
              style={[
                styles.card,
                { backgroundColor: colors.surface, borderColor: colors.border },
                item.id === activeSessionId && { borderColor: colors.accent },
              ]}
              onPress={() => { setActiveSession(item.id); router.push('/'); }}
            >
              <View style={styles.cardHeader}>
                <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                  {item.name || backendLabel(item.backend)}
                </Text>
                <View style={[styles.badge, { backgroundColor: item.backend === 'codex' ? colors.text : colors.accent }]}>
                  <Text style={[styles.badgeText, { color: colors.bg }]}>{transportLabel(item.transportMode)}</Text>
                </View>
              </View>
              {!!item.cwd && (
                <Text style={[styles.cwd, { color: colors.textTertiary }]} numberOfLines={1}>
                  {item.cwd}
                </Text>
              )}
              <Text style={[styles.preview, { color: colors.textSecondary }]} numberOfLines={1}>
                {item.lastMessagePreview || item.messages[item.messages.length - 1]?.content || '无消息'}
              </Text>
              <View style={styles.footer}>
                <Text style={[styles.meta, { color: colors.textTertiary }]}>
                  {stateLabel(item.state)} · {transportLabel(item.transportMode)} · {item.messageCount ?? item.messages.length} 条 · {formatRelativeTime(item.lastMessageAt || item.lastActivity)}
                </Text>
                <Text style={[styles.tokenMeta, { color: colors.textTertiary }]}>
                  Token {item.tokenUsage.input + item.tokenUsage.output}
                </Text>
                {item.state === 'running' && (
                  <Pressable
                    style={[styles.stopButton, { borderColor: colors.border }]}
                    onPress={() => {
                      updateSessionState(item.id, 'idle');
                      relayClient.send({ type: 'session_kill', sessionId: item.id, payload: {} });
                    }}
                  >
                    <Text style={[styles.stopText, { color: colors.text }]}>停止</Text>
                  </Pressable>
                )}
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

function backendLabel(backend: Backend): string {
  return backend === 'codex' ? 'Codex' : 'Claude Code';
}

function stateLabel(state: Session['state']): string {
  if (state === 'running') return '运行中';
  if (state === 'crashed') return '异常';
  return '空闲';
}

function transportLabel(mode?: Session['transportMode']): string {
  return mode === 'official-remote' ? 'Desktop' : 'CLI';
}

function formatRelativeTime(value?: number | null): string {
  if (!value) return '刚刚';
  const diff = Date.now() - value;
  if (diff < 60_000) return '刚刚';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  return `${Math.floor(diff / 86_400_000)} 天前`;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  newChatBar: { marginHorizontal: 12, marginTop: 12, marginBottom: 4, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  newChatText: { fontSize: 15, fontWeight: '700' },
  list: { paddingBottom: 16 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 16 },
  emptyHint: { fontSize: 13, marginTop: 8 },
  sectionHeader: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 6 },
  sectionTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  card: { marginHorizontal: 12, marginVertical: 6, padding: 14, borderRadius: 8, borderWidth: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  name: { fontSize: 16, fontWeight: '700', flex: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  preview: { fontSize: 14, marginTop: 8 },
  cwd: { fontSize: 11, marginTop: 6 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  meta: { fontSize: 12, flex: 1 },
  tokenMeta: { fontSize: 11, fontWeight: '700' },
  stopButton: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 6, paddingHorizontal: 9, paddingVertical: 4 },
  stopText: { fontSize: 12, fontWeight: '700' },
});
