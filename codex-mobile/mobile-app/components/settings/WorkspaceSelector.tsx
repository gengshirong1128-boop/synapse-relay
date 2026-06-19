import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { WorkspaceInfo } from '../../store';
import { ThemeColors } from '../../theme/colors';

type Props = {
  colors: ThemeColors;
  value: string;
  workspaces: WorkspaceInfo[];
  onChange: (path: string) => void;
  onRefresh: () => void;
};

export function WorkspaceSelector({ colors, value, workspaces, onChange, onRefresh }: Props) {
  return (
    <View>
      <View style={styles.topRow}>
        <Text style={[styles.label, { color: colors.text }]}>电脑工作区</Text>
        <Pressable onPress={onRefresh} style={[styles.refreshButton, { borderColor: colors.border }]}>
          <Text style={[styles.refreshText, { color: colors.text }]}>刷新</Text>
        </Pressable>
      </View>
      <TextInput
        style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.inputText }]}
        value={value}
        onChangeText={onChange}
        placeholder="D:\\path\\to\\workspace"
        placeholderTextColor={colors.placeholder}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <View style={styles.list}>
        {workspaces.map(workspace => {
          const active = workspace.path.toLowerCase() === value.toLowerCase();
          return (
            <Pressable
              key={`${workspace.id}-${workspace.path}`}
              style={[
                styles.item,
                { borderColor: colors.border },
                active && { borderColor: colors.accent, backgroundColor: colors.accentSoft },
              ]}
              onPress={() => onChange(workspace.path)}
            >
              <Text style={[styles.name, { color: active ? colors.accent : colors.text }]} numberOfLines={1}>
                {workspace.name}
              </Text>
              <Text style={[styles.path, { color: colors.textTertiary }]} numberOfLines={1}>
                {workspace.path}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  label: { fontSize: 14, fontWeight: '700' },
  refreshButton: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },
  refreshText: { fontSize: 12, fontWeight: '700' },
  input: {
    alignSelf: 'stretch',
    minWidth: 0,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginTop: 10,
    borderWidth: 1,
  },
  list: { gap: 8, marginTop: 10 },
  item: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  name: { fontSize: 13, fontWeight: '700' },
  path: { fontSize: 11, marginTop: 2 },
});
