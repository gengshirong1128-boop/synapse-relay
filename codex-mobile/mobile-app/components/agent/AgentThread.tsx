import React, { useRef, useEffect } from 'react';
import { FlatList, NativeScrollEvent, NativeSyntheticEvent, StyleSheet, Text, View } from 'react-native';
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
  // Only auto-scroll to the bottom when the user is already near the bottom.
  // Otherwise scrolling up to read history during a long streaming reply would
  // keep yanking them back down on every content-size change.
  const atBottomRef = useRef(true);
  // Last content height we scrolled for. onContentSizeChange fires even when the
  // height is unchanged (e.g. as a side effect of our own scrollToEnd), which
  // created a scroll→layout→scroll feedback loop that looked like jitter at the
  // bottom. Only scroll when the content actually grew.
  const lastHeightRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
  }, []);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
    atBottomRef.current = distanceFromBottom < 80;
  };

  const onContentSizeChange = (_w: number, h: number) => {
    if (h <= lastHeightRef.current + 1) return; // not actually taller → ignore
    lastHeightRef.current = h;
    if (!atBottomRef.current) return;
    if (rafRef.current != null) return; // a scroll is already queued
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      listRef.current?.scrollToEnd({ animated: false });
    });
  };

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
      onScroll={onScroll}
      scrollEventThrottle={100}
      onContentSizeChange={onContentSizeChange}
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
