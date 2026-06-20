import React, { useCallback } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { AgentComposer } from '../../components/agent/AgentComposer';
import { AgentDisconnected } from '../../components/agent/AgentDisconnected';
import { AgentHeader } from '../../components/agent/AgentHeader';
import { AgentRunStatus } from '../../components/agent/AgentRunStatus';
import { AgentThread } from '../../components/agent/AgentThread';
import { ApprovalBanner } from '../../components/agent/ApprovalBanner';
import { useAgentSession } from '../../hooks/useAgentSession';
import { useAppStore } from '../../store';

export default function ChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { connectionState } = useAppStore();
  const agent = useAgentSession();

  const handleAttach = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      base64: true,
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]?.base64) {
      const name = result.assets[0].fileName || 'photo';
      agent.setInput(agent.input + `\n[image: ${name}]`);
    }
  }, [agent]);

  if (connectionState !== 'connected') {
    return (
      <AgentDisconnected
        backend={agent.backend}
        colors={agent.colors}
        connectionState={connectionState}
        onConnect={() => router.push('/connect')}
      />
    );
  }

  const lastUserIndex = agent.messages.map(m => m.role).lastIndexOf('user');
  const currentRunMessages = lastUserIndex >= 0 ? agent.messages.slice(lastUserIndex + 1) : agent.messages;
  const hasToolUse = currentRunMessages.some(m =>
    m.toolUse && !['completed', 'success', 'failed', 'error'].includes(m.toolUse.status || 'running')
  );
  const hasThinking = currentRunMessages.some(m => m.isThinking);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: agent.colors.bg, paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <AgentHeader
        copy={agent.copy}
        colors={agent.colors}
        tokenUsage={agent.tokenUsage}
        model={agent.model}
        backend={agent.backend}
        transportMode={agent.transportMode}
        workspacePath={agent.workspacePath}
        isRunning={agent.isRunning}
        onModelPress={() => router.push('/settings')}
        onNewChat={agent.startNewSession}
      />
      <AgentThread
        backend={agent.backend}
        colors={agent.colors}
        copy={agent.copy}
        messages={agent.messages}
      />
      <ApprovalBanner
        colors={agent.colors}
        approvals={agent.approvals}
        onRespond={agent.respondToApproval}
      />
      {agent.isRunning && (
        <AgentRunStatus
          colors={agent.colors}
          hasToolUse={hasToolUse}
          hasThinking={hasThinking}
          onStop={agent.stop}
        />
      )}
      <AgentComposer
        value={agent.input}
        placeholder={agent.copy.inputPlaceholder}
        colors={agent.colors}
        isStreaming={agent.isRunning}
        disabledReason={agent.sendBlockedReason}
        onChange={agent.setInput}
        onSend={agent.send}
        onStop={agent.stop}
        onAttach={handleAttach}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
