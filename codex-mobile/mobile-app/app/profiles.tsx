import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, FlatList, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '../store';
import { ApiProfile, profileStorage } from '../services/profiles';

export default function ProfilesScreen() {
  const router = useRouter();
  const { profiles, setProfiles, setActiveProfile, activeProfileId } = useAppStore();
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
    <View style={styles.container}>
      <Text style={styles.title}>API 配置管理</Text>

      <View style={styles.form}>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="配置名称（如：官方API）" placeholderTextColor="#636366" />
        <TextInput style={styles.input} value={baseUrl} onChangeText={setBaseUrl} placeholder="Base URL" placeholderTextColor="#636366" autoCapitalize="none" />
        <TextInput style={styles.input} value={apiKey} onChangeText={setApiKey} placeholder="API Key" placeholderTextColor="#636366" secureTextEntry />
        <TextInput style={styles.input} value={model} onChangeText={setModel} placeholder="模型 (默认 claude-sonnet-4-6)" placeholderTextColor="#636366" />
        <View style={styles.formActions}>
          <Pressable style={styles.saveBtn} onPress={handleSave}>
            <Text style={styles.saveBtnText}>{editing ? '更新' : '添加'}</Text>
          </Pressable>
          {editing && (
            <Pressable style={styles.cancelBtn} onPress={resetForm}>
              <Text style={styles.cancelText}>取消</Text>
            </Pressable>
          )}
        </View>
      </View>

      <FlatList
        data={profiles}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={[styles.card, item.id === activeProfileId && styles.activeCard]}>
            <Pressable style={styles.cardBody} onPress={() => setActiveProfile(item.id)}>
              <Text style={styles.cardName}>{item.name}</Text>
              <Text style={styles.cardUrl}>{item.baseUrl}</Text>
              <Text style={styles.cardModel}>{item.model}</Text>
            </Pressable>
            <View style={styles.cardActions}>
              <Pressable onPress={() => startEdit(item)}><Text style={styles.editText}>编辑</Text></Pressable>
              <Pressable onPress={() => handleDelete(item.id)}><Text style={styles.deleteText}>删除</Text></Pressable>
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>暂无配置，请添加</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', padding: 16 },
  title: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 16 },
  form: { backgroundColor: '#1c1c1e', borderRadius: 12, padding: 16, marginBottom: 16 },
  input: { backgroundColor: '#2c2c2e', color: '#fff', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, marginBottom: 10 },
  formActions: { flexDirection: 'row', gap: 10 },
  saveBtn: { flex: 1, backgroundColor: '#0a84ff', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  cancelBtn: { flex: 1, backgroundColor: '#3a3a3c', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  cancelText: { color: '#e5e5e7', fontSize: 15 },
  card: { backgroundColor: '#1c1c1e', borderRadius: 12, padding: 14, marginBottom: 8 },
  activeCard: { borderWidth: 1, borderColor: '#0a84ff' },
  cardBody: { marginBottom: 8 },
  cardName: { color: '#fff', fontSize: 16, fontWeight: '600' },
  cardUrl: { color: '#8e8e93', fontSize: 13, marginTop: 4 },
  cardModel: { color: '#636366', fontSize: 12, marginTop: 2 },
  cardActions: { flexDirection: 'row', gap: 16 },
  editText: { color: '#0a84ff', fontSize: 14 },
  deleteText: { color: '#ff453a', fontSize: 14 },
  empty: { color: '#636366', fontSize: 14, textAlign: 'center', marginTop: 20 },
});
