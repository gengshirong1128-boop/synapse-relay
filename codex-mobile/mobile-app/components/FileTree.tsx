import React from 'react';
import { View, Text, Pressable, StyleSheet, FlatList } from 'react-native';
import type { RefreshControlProps } from 'react-native';
import { ThemeColors } from '../theme/colors';

interface FileEntry {
  name: string;
  type: 'file' | 'dir';
  size: number;
}

interface Props {
  files: FileEntry[];
  onNavigate: (path: string) => void;
  onFilePress: (path: string) => void;
  currentPath: string;
  colors: ThemeColors;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  emptyHint?: string;
}

export function FileTree({ files, onNavigate, onFilePress, currentPath, colors, refreshControl, emptyHint }: Props) {
  const sorted = [...files].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <View style={styles.container}>
      <FlatList
        data={sorted}
        keyExtractor={(item) => item.name}
        refreshControl={refreshControl}
        ListHeaderComponent={
          <>
            <Text style={[styles.path, { color: colors.textTertiary, backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
              {currentPath}
            </Text>
            {currentPath !== '.' && (
              <Pressable onPress={() => onNavigate('..')} style={[styles.item, { borderBottomColor: colors.border }]}>
                <Text style={[styles.kind, { color: colors.textTertiary }]}>DIR</Text>
                <Text style={[styles.dirName, { color: colors.accent }]}>..</Text>
              </Pressable>
            )}
          </>
        }
        ListEmptyComponent={
          emptyHint ? <Text style={[styles.emptyHint, { color: colors.textTertiary }]}>{emptyHint}</Text> : null
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => item.type === 'dir' ? onNavigate(item.name) : onFilePress(item.name)}
            style={[styles.item, { borderBottomColor: colors.border }]}
          >
            <Text style={[styles.kind, { color: colors.textTertiary }]}>
              {item.type === 'dir' ? 'DIR' : 'FILE'}
            </Text>
            <Text style={[
              item.type === 'dir' ? styles.dirName : styles.fileName,
              { color: item.type === 'dir' ? colors.accent : colors.text },
            ]}>
              {item.name}
            </Text>
            {item.type === 'file' && (
              <Text style={[styles.size, { color: colors.textTertiary }]}>{formatSize(item.size)}</Text>
            )}
          </Pressable>
        )}
      />
    </View>
  );
}

function formatSize(bytes: number): string {
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return bytes + ' B';
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  path: { fontSize: 12, paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1 },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 16, borderBottomWidth: 1 },
  kind: { width: 38, fontSize: 10, fontWeight: '800', marginRight: 10 },
  dirName: { fontSize: 15, flex: 1, fontWeight: '600' },
  fileName: { fontSize: 15, flex: 1 },
  size: { fontSize: 12 },
  emptyHint: { textAlign: 'center', fontSize: 13, paddingVertical: 24 },
});
