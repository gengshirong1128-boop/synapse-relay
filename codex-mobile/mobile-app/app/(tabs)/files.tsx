import React, { useState } from 'react';
import { View, Text, ScrollView, RefreshControl, Pressable, StyleSheet } from 'react-native';
import { useAppStore } from '../../store';
import { relayClient } from '../../services/websocket';
import { FileTree } from '../../components/FileTree';
import { getTheme } from '../../theme/colors';

export default function FilesScreen() {
  const { connectionState, activeBackend, theme, workspacePath } = useAppStore();
  const colors = getTheme(activeBackend === 'codex' ? 'codex' : 'claude', theme);
  const [files, setFiles] = useState<{ name: string; type: 'file' | 'dir'; size: number }[]>([]);
  const [currentPath, setCurrentPath] = useState('.');
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [truncated, setTruncated] = useState(false);

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
  };

  const handleFilePress = (name: string) => {
    const path = currentPath === '.' ? name : `${currentPath}/${name}`;
    relayClient.send({ type: 'file_content', payload: { path, cwd: workspacePath || undefined } });
  };

  const breadcrumbs = currentPath === '.' ? ['root'] : ['root', ...currentPath.split('/')];

  if (connectionState !== 'connected') {
    return (
      <View style={[styles.empty, { backgroundColor: colors.bg }]}>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>请先连接服务器</Text>
      </View>
    );
  }

  if (fileContent !== null) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
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
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
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
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        <FileTree
          files={files}
          currentPath={currentPath}
          colors={colors}
          onNavigate={handleNavigate}
          onFilePress={handleFilePress}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 16 },
  breadcrumb: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, flexWrap: 'wrap' },
  breadSep: { fontSize: 13, marginHorizontal: 4 },
  breadSeg: { fontSize: 13, fontWeight: '500' },
  fileHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderBottomWidth: 1 },
  backBtn: { fontSize: 15, fontWeight: '500' },
  truncTag: { fontSize: 12 },
  codeContainer: { flex: 1, padding: 12 },
  codeText: { fontFamily: 'monospace', fontSize: 13, lineHeight: 20 },
});
