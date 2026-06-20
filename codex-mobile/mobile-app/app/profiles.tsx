import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, FlatList, StyleSheet, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAppStore } from '../store';
import { ApiProfile, profileStorage } from '../services/profiles';
import { getTheme } from '../theme/colors';

export default function ProfilesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profiles, setProfiles, setActiveProfile, activeProfileId, activeBackend, theme } = useAppStore();
  const colors = getTheme(activeBackend === 'codex' ? 'codex' : 'claude', theme);
  const [editing, setEditing] = useState<ApiProfile | null>(null);
  const [name, setName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');

  useEffect(() => {
    profileStorage.getProfiles().then(setProfiles);
  }, []);

  const handleSave = async () => {
    if (!name.trim() || !baseUrl.trim()) return;
    const profile: ApiProfile = {
      id: editing?.id || Date.now().toString(),
      name: name.trim(),
      baseUrl: baseUrl.trim(),
      apiKey: apiKey.trim(),
      model: model.trim() || 'claude-sonnet-4-6',
      backend: 'claude-code',
    };
    if (editing) {
      await profileStorage.updateProfile(profile.id, profile);
    } else {
      await profileStorage.addProfile(profile);
    }
    const updated = await profileStorage.getProfiles();
    setProfiles(updated);
    resetForm();
  };

  const handleDelete = async (id: string) => {
    Alert.alert('确认删除', '确定要删除此配置吗？', [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: async () => {
        await profileStorage.deleteProfile(id);
        const updated = await profileStorage.getProfiles();
        setProfiles(updated);
      }},
    ]);
  };

  const resetForm = () => { setEditing(null); setName(''); setBaseUrl(''); setApiKey(''); setModel(''); };

  const startEdit = (p: ApiProfile) => {
    setEditing(p); setName(p.name); setBaseUrl(p.baseUrl); setApiKey(p.apiKey); setModel(p.model);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <Text style={[styles.title, { color: colors.text }]}>API 配置管理</Text>

      <View style={[styles.form, { backgroundColor: colors.surface }]}>
        <TextInput style={[styles.input, { backgroundColor: colors.inputBg, color: colors.inputText, borderColor: colors.inputBorder }]} value={name} onChangeText={setName} placeholder="配置名称（如：官方API）" placeholderTextColor={colors.placeholder} />
        <TextInput style={[styles.input, { backgroundColor: colors.inputBg, color: colors.inputText, borderColor: colors.inputBorder }]} value={baseUrl} onChangeText={setBaseUrl} placeholder="Base URL" placeholderTextColor={colors.placeholder} autoCapitalize="none" />
        <TextInput style={[styles.input, { backgroundColor: colors.inputBg, color: colors.inputText, borderColor: colors.inputBorder }]} value={apiKey} onChangeText={setApiKey} placeholder="API Key" placeholderTextColor={colors.placeholder} secureTextEntry />
        <TextInput style={[styles.input, { backgroundColor: colors.inputBg, color: colors.inputText, borderColor: colors.inputBorder }]} value={model} onChangeText={setModel} placeholder="模型 (默认 claude-sonnet-4-6)" placeholderTextColor={colors.placeholder} />
        <View style={styles.formActions}>
          <Pressable style={[styles.saveBtn, { backgroundColor: colors.accent }]} onPress={handleSave} accessibilityRole="button" accessibilityLabel={editing ? '更新配置' : '添加配置'}>
            <Text style={[styles.saveBtnText, { color: colors.bg }]}>{editing ? '更新' : '添加'}</Text>
          </Pressable>
          {editing && (
            <Pressable style={[styles.cancelBtn, { backgroundColor: colors.surfaceAlt }]} onPress={resetForm} accessibilityRole="button" accessibilityLabel="取消编辑">
              <Text style={[styles.cancelText, { color: colors.text }]}>取消</Text>
            </Pressable>
          )}
        </View>
      </View>

      <FlatList
        data={profiles}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: colors.surface }, item.id === activeProfileId && { borderWidth: 1, borderColor: colors.accent }]}>
            <Pressable style={styles.cardBody} onPress={() => setActiveProfile(item.id)}>
              <Text style={[styles.cardName, { color: colors.text }]}>{item.name}</Text>
              <Text style={[styles.cardUrl, { color: colors.textSecondary }]}>{item.baseUrl}</Text>
              <Text style={[styles.cardModel, { color: colors.textTertiary }]}>{item.model}</Text>
            </Pressable>
            <View style={styles.cardActions}>
              <Pressable onPress={() => startEdit(item)} accessibilityRole="button" accessibilityLabel="编辑配置"><Text style={[styles.editText, { color: colors.accent }]}>编辑</Text></Pressable>
              <Pressable onPress={() => handleDelete(item.id)} accessibilityRole="button" accessibilityLabel="删除配置"><Text style={[styles.deleteText, { color: colors.danger }]}>删除</Text></Pressable>
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={[styles.empty, { color: colors.textTertiary }]}>暂无配置，请添加</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 16 },
  form: { borderRadius: 12, padding: 16, marginBottom: 16 },
  input: { borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, marginBottom: 10 },
  formActions: { flexDirection: 'row', gap: 10 },
  saveBtn: { flex: 1, borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  saveBtnText: { fontSize: 15, fontWeight: '600' },
  cancelBtn: { flex: 1, borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  cancelText: { fontSize: 15 },
  card: { borderRadius: 12, padding: 14, marginBottom: 8 },
  cardBody: { marginBottom: 8 },
  cardName: { fontSize: 16, fontWeight: '600' },
  cardUrl: { fontSize: 13, marginTop: 4 },
  cardModel: { fontSize: 12, marginTop: 2 },
  cardActions: { flexDirection: 'row', gap: 16 },
  editText: { fontSize: 14 },
  deleteText: { fontSize: 14 },
  empty: { fontSize: 14, textAlign: 'center', marginTop: 20 },
});
