import React, { useRef } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Backend } from '../../services/websocket';
import { ChatMessage } from '../../store';
import { ThemeColors } from '../../theme/colors';
import { AgentCopy } from './agentUtils';
import { AgentMessageRow } from './AgentMessageRow';

type Props = {
  backend: Backend;
  colors: ThemeColors;
  copy: AgentCopy;
  messages: ChatMessage[];
};

export function AgentThread({ backend, colors, copy, messages }: Props) {
  const listRef = useRef<FlatList>(null);

  return (
    <FlatList
      ref={listRef}
      data={messages}
      keyExtractor={(item) => item.id}
      ListEmptyComponent={<EmptyThread copy={copy} colors={colors} />}
      renderItem={({ item }) => (
        <AgentMessageRow msg={item} backend={backend} colors={colors} copy={copy} />
      )}
      contentContainerStyle={messages.length ? styles.threadList : styles.emptyList}
      onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
      windowSize={10}
      maxToRenderPerBatch={8}
      removeClippedSubviews
    />
  );
}

function EmptyThread({ copy, colors }: { copy: AgentCopy; colors: ThemeColors }) {
  return (
    <View style={styles.emptyThread}>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>{copy.emptyTitle}</Text>
      <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>{copy.emptyBody}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  threadList: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16 },
  emptyList: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 28 },
  emptyThread: { alignItems: 'center' },
  emptyTitle: { fontSize: 17, fontWeight: '800', textAlign: 'center' },
  emptyBody: { fontSize: 14, lineHeight: 20, marginTop: 8, textAlign: 'center' },
});
