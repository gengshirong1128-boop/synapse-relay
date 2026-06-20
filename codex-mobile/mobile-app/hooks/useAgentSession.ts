import { useCallback, useEffect, useState } from 'react';
import { relayClient } from '../services/websocket';
import { useAppStore } from '../store';
import { getTheme } from '../theme/colors';
import { AGENT_COPY, getBackendBrand } from '../components/agent/agentUtils';

export function useAgentSession() {
  const [input, setInput] = useState('');
  const {
    sessions,
    activeSessionId,
    activeBackend,
    composingNew,
    connectionState,
    theme,
    claudeModel,
    codexModel,
    effortLevel,
    permissionMode,
    claudeTransportMode,
    codexTransportMode,
    codexResponseSpeed,
    transportMode,
    workspacePath,
    pendingApprovals,
    apiConfig,
    appendMessage,
    addSession,
    updateSessionState,
    resolveApprovalRequest,
    startNewSession,
  } = useAppStore();

  const backend = activeBackend;
  const model = backend === 'codex' ? codexModel : claudeModel;
  const selectedTransportMode = backend === 'codex' ? codexTransportMode : claudeTransportMode;
  // When composing a brand-new chat, show a blank thread: match the exact active
  // id only, and do NOT fall back to the latest session (which would re-show an
  // old conversation the moment the user taps "new chat").
  const exactSession = sessions.find(s =>
    s.id === activeSessionId
    && s.backend === activeBackend
    && (!s.transportMode || s.transportMode === selectedTransportMode)
  );
  const activeSession = exactSession
    || (composingNew ? null : sessions
      .filter(s => s.backend === activeBackend && (!s.transportMode || s.transportMode === selectedTransportMode))
      .sort((a, b) => b.lastActivity - a.lastActivity)[0])
    || null;
  const colors = getTheme(getBackendBrand(backend), theme);
  const copy = AGENT_COPY[backend];
  const messages = activeSession?.messages || [];
  const approvals = activeSession
    ? pendingApprovals.filter(item => item.sessionId === activeSession.id)
    : [];
  const tokenUsage = activeSession?.tokenUsage || { input: 0, output: 0, cost: 0 };
  const isStreaming = activeSession?.state === 'running';
  const isRunning = activeSession?.state === 'running';
  const sessionTransportMode = activeSession?.transportMode || selectedTransportMode || transportMode;
  const sendBlockedReason = backend === 'claude-code' && selectedTransportMode === 'official-remote'
    ? 'Claude Code Desktop 待接入，请切换 CLI'
    : '';

  useEffect(() => {
    if (connectionState !== 'connected' || !activeSession?.id) return;
    relayClient.send({ type: 'session_subscribe', sessionId: activeSession.id, payload: {} });
  }, [connectionState, activeSession?.id]);

  // When the user switches backend (Claude ↔ Codex), refresh the session list so
  // that backend's sessions show up promptly instead of waiting for a manual
  // pull-to-refresh on the sessions tab.
  useEffect(() => {
    if (connectionState !== 'connected') return;
    relayClient.send({ type: 'session_list', payload: {} });
  }, [connectionState, activeBackend]);

  const send = useCallback(() => {
    if (!input.trim() || connectionState !== 'connected' || sendBlockedReason) return;
    const text = input.trim();
    setInput('');

    // Remote/history sessions (claude-session:/codex-thread:) must resume in
    // their own recorded cwd. Forking them because the global workspace differs
    // would break `claude --resume` (it's cwd-scoped → "No conversation found").
    const isRemoteSession = !!activeSession?.id
      && (activeSession.id.startsWith('claude-session:') || activeSession.id.startsWith('codex-thread:'));
    const workspaceChanged = !isRemoteSession && !!workspacePath && !!activeSession?.cwd && activeSession.cwd !== workspacePath;
    const transportChanged = !!activeSession?.transportMode && activeSession.transportMode !== selectedTransportMode;
    let sessionId = workspaceChanged || transportChanged ? null : activeSession?.id || null;
    // Prefer the session's own cwd so a resumed history session runs in the
    // directory it was recorded in, not whatever workspace is globally selected.
    const commandCwd = activeSession?.cwd || workspacePath || undefined;
    if (!sessionId) {
      sessionId = `session-${Date.now()}`;
      const workspaceName = (commandCwd || workspacePath).split(/[\\/]/).filter(Boolean).pop();
      addSession({
        id: sessionId,
        name: `${backend === 'codex' ? 'Codex' : 'Claude Code'} ${selectedTransportMode === 'official-remote' ? 'Desktop' : 'CLI'}${workspaceName ? ` · ${workspaceName}` : ''}`,
        backend,
        cwd: commandCwd,
        transportMode: selectedTransportMode,
        messages: [],
        tokenUsage: { input: 0, output: 0, cost: 0 },
        state: 'running',
        lastActivity: Date.now(),
      });
    } else {
      updateSessionState(sessionId, 'running');
    }

    appendMessage(sessionId, {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    });

    relayClient.send({
      type: 'command',
      sessionId,
      payload: {
        text,
        backend,
        model,
        effortLevel,
        permissionMode,
        transportMode: selectedTransportMode,
        responseSpeed: backend === 'codex' ? codexResponseSpeed : undefined,
        cwd: commandCwd,
        apiConfig: apiConfig.baseUrl ? apiConfig : undefined,
      },
    });
  }, [input, connectionState, sendBlockedReason, activeSession, backend, model, effortLevel, permissionMode, selectedTransportMode, codexResponseSpeed, workspacePath, apiConfig, addSession, appendMessage, updateSessionState]);

  const stop = useCallback(() => {
    const sid = activeSession?.id;
    if (!sid) return;
    updateSessionState(sid, 'idle');
    relayClient.send({ type: 'session_kill', sessionId: sid, payload: {} });
  }, [activeSession, updateSessionState]);

  const respondToApproval = useCallback((
    approvalId: string,
    decision: 'approve_once' | 'approve_session' | 'deny' | 'cancel',
  ) => {
    const sid = activeSession?.id;
    if (!sid) return;
    resolveApprovalRequest(approvalId);
    relayClient.send({
      type: 'approval_response',
      sessionId: sid,
      payload: { approvalId, decision },
    });
  }, [activeSession?.id, resolveApprovalRequest]);

  return {
    input,
    setInput,
    send,
    stop,
    copy,
    colors,
    backend,
    model,
    messages,
    approvals,
    tokenUsage,
    isStreaming,
    isRunning,
    transportMode: sessionTransportMode,
    workspacePath,
    permissionMode,
    connectionState,
    sendBlockedReason,
    respondToApproval,
    startNewSession,
  };
}
