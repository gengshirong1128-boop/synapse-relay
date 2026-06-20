import React, { useState } from 'react';
import { View, Text, ScrollView, RefreshControl, Pressable, TextInput, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAppStore } from '../../store';
import { relayClient } from '../../services/websocket';
import { FileTree } from '../../components/FileTree';
import { getTheme } from '../../theme/colors';

export default function FilesScreen() {
  const { connectionState, activeBackend, theme, workspacePath } = useAppStore();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colors = getTheme(activeBackend === 'codex' ? 'codex' : 'claude', theme);
  const [files, setFiles] = useState<{ name: string; type: 'file' | 'dir'; size: number }[]>([]);
  const [currentPath, setCurrentPath] = useState('.');
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const [query, setQuery] = useState('');

  React.useEffect(() => {
    if (connectionState !== 'connected') return;
    requestFileList(currentPath);

    const unsub = relayClient.onMessage((msg) => {
      if (msg.type === 'file_list_result') {
        setFiles(msg.payload.files as any || []);
        setRefreshing(false);
      }
      if (msg.type === 'file_content_result') {
        setFileContent(msg.payload.content as string);
        setTruncated(!!(msg.payload.truncated));
      }
    });
    return unsub;
  }, [connectionState, currentPath, workspacePath]);

  const requestFileList = (path: string) => {
    relayClient.send({ type: 'file_list', payload: { path, cwd: workspacePath || undefined } });
  };

  const onRefresh = () => {
    setRefreshing(true);
    requestFileList(currentPath);
  };

  const handleNavigate = (dir: string) => {
    if (dir === '..') {
      const parts = currentPath.split('/');
      parts.pop();
      setCurrentPath(parts.join('/') || '.');
    } else {
      setCurrentPath(currentPath === '.' ? dir : `${currentPath}/${dir}`);
    }
    setFileContent(null);
    setQuery('');
  };

  const handleFilePress = (name: string) => {
    const path = currentPath === '.' ? name : `${currentPath}/${name}`;
    relayClient.send({ type: 'file_content', payload: { path, cwd: workspacePath || undefined } });
  };

  const breadcrumbs = currentPath === '.' ? ['root'] : ['root', ...currentPath.split('/')];
  const q = query.trim().toLowerCase();
  const visibleFiles = q ? files.filter(f => f.name.toLowerCase().includes(q)) : files;

  if (connectionState !== 'connected') {
    return (
      <View style={[styles.empty, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>请先连接电脑上的中继服务</Text>
        <Pressable style={[styles.connectBtn, { backgroundColor: colors.accent }]} onPress={() => router.push('/connect')} accessibilityRole="button" accessibilityLabel="去连接">
          <Text style={[styles.connectBtnText, { color: colors.bg }]}>去连接</Text>
        </Pressable>
      </View>
    );
  }

  if (fileContent !== null) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
        <View style={[styles.fileHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <Pressable onPress={() => setFileContent(null)}>
            <Text style={[styles.backBtn, { color: colors.accent }]}>← 返回</Text>
          </Pressable>
          {truncated && <Text style={[styles.truncTag, { color: colors.textTertiary }]}>已截断 (500行)</Text>}
        </View>
        <ScrollView style={[styles.codeContainer, { backgroundColor: colors.codeBg }]}>
          <Text style={[styles.codeText, { color: colors.codeText }]}>{fileContent}</Text>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <View style={[styles.breadcrumb, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        {breadcrumbs.map((seg, i) => (
          <React.Fragment key={i}>
            {i > 0 && <Text style={[styles.breadSep, { color: colors.textTertiary }]}>/</Text>}
            <Pressable onPress={() => {
              if (i === 0) { setCurrentPath('.'); }
              else { setCurrentPath(breadcrumbs.slice(1, i + 1).join('/')); }
            }}>
              <Text style={[styles.breadSeg, { color: i === breadcrumbs.length - 1 ? colors.text : colors.accent }]}>{seg}</Text>
            </Pressable>
          </React.Fragment>
        ))}
      </View>
      <View style={[styles.searchBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TextInput
          style={[styles.searchInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.inputText }]}
          value={query}
          onChangeText={setQuery}
          placeholder="搜索当前文件夹…"
          placeholderTextColor={colors.placeholder}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {!!query && (
          <Pressable onPress={() => setQuery('')} style={styles.clearBtn}>
            <Text style={[styles.clearText, { color: colors.textTertiary }]}>✕</Text>
          </Pressable>
        )}
      </View>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        <FileTree
          files={visibleFiles}
          currentPath={currentPath}
          colors={colors}
          onNavigate={handleNavigate}
          onFilePress={handleFilePress}
        />
        {q && visibleFiles.length === 0 && (
          <Text style={[styles.noResult, { color: colors.textTertiary }]}>没有匹配「{query}」的文件</Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 16 },
  connectBtn: { marginTop: 16, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12 },
  connectBtnText: { fontSize: 15, fontWeight: '700' },
  breadcrumb: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, flexWrap: 'wrap' },
  breadSep: { fontSize: 13, marginHorizontal: 4 },
  breadSeg: { fontSize: 13, fontWeight: '500' },
  searchBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, gap: 8 },
  searchInput: { flex: 1, borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14 },
  clearBtn: { paddingHorizontal: 6, paddingVertical: 4 },
  clearText: { fontSize: 14, fontWeight: '700' },
  noResult: { textAlign: 'center', fontSize: 13, paddingVertical: 24 },
  fileHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderBottomWidth: 1 },
  backBtn: { fontSize: 15, fontWeight: '500' },
  truncTag: { fontSize: 12 },
  codeContainer: { flex: 1, padding: 12 },
  codeText: { fontFamily: 'monospace', fontSize: 13, lineHeight: 20 },
});
