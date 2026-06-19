import React, { useState, useRef } from 'react';
import { View, TextInput, FlatList, Pressable, Text, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useAppStore } from '../../store';
import { relayClient } from '../../services/websocket';
import { ChatBubble } from '../../components/ChatBubble';
import { TokenCounter } from '../../components/TokenCounter';
import { getTheme } from '../../theme/colors';

export default function ChatDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [input, setInput] = useState('');
  const flatListRef = useRef<FlatList>(null);
  const { sessions, appendMessage, theme } = useAppStore();

  const session = sessions.find(s => s.id === id);
  const colors = getTheme(session?.backend === 'codex' ? 'codex' : 'claude', theme);

  if (!session) {
    return (
      <View style={[styles.empty, { backgroundColor: colors.bg }]}>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>会话不存在</Text>
      </View>
    );
  }

  const handleSend = () => {
    if (!input.trim()) return;
    const text = input.trim();
    setInput('');
    appendMessage(id!, { id: Date.now().toString(), role: 'user', content: text, timestamp: Date.now() });
    relayClient.send({ type: 'command', sessionId: id, payload: { text, backend: session.backend } });
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <TokenCounter
        inputTokens={session.tokenUsage.input}
        outputTokens={session.tokenUsage.output}
        estimatedCost={session.tokenUsage.cost}
      />
      <FlatList
        ref={flatListRef}
        data={session.messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ChatBubble message={item} backend={session.backend} />}
        contentContainerStyle={styles.messages}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
      />
      <View style={[styles.inputBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <TextInput
          style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.inputText }]}
          value={input}
          onChangeText={setInput}
          placeholder="输入指令..."
          placeholderTextColor={colors.placeholder}
          multiline
          onSubmitEditing={handleSend}
        />
        <Pressable style={[styles.sendBtn, { backgroundColor: colors.accent }]} onPress={handleSend}>
          <Text style={[styles.sendText, { color: colors.bg }]}>发送</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 16 },
  messages: { paddingVertical: 8 },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', padding: 8, borderTopWidth: 0.5 },
  input: { flex: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, maxHeight: 100, borderWidth: 1 },
  sendBtn: { marginLeft: 8, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10 },
  sendText: { fontWeight: '600' },
});
