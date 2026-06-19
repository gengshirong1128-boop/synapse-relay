import { useEffect } from 'react';
import { relayClient, ServerMessage } from '../services/websocket';
import { useAppStore } from '../store';

export function useRelayMessages() {
  const {
    appendMessage,
    updateStreamingMessage,
    updateToolMessage,
    completeStreaming,
    updateTokenUsage,
    updateSessionState,
    updateSessionTransportMode,
    mergeRemoteSessions,
    setSessionMessages,
    setConnectionState,
    setClaudeModel,
    setCodexModel,
    setClaudeModels,
    setCodexModels,
    setWorkspacePath,
    setAvailableWorkspaces,
    setAvailableTools,
    setEffortLevel,
    setCodexResponseSpeed,
    setTransportMode,
    setAgentCapabilities,
    addApprovalRequest,
    resolveApprovalRequest,
    clearSessionApprovals,
  } = useAppStore();

  useEffect(() => {
    relayClient.setStateListener((state) => {
      setConnectionState(state);
      if (state === 'connected') {
        const backend = useAppStore.getState().activeBackend;
        relayClient.send({ type: 'agent_info', payload: { backend } });
        relayClient.send({ type: 'list_workspaces', payload: {} });
        relayClient.send({ type: 'session_list', payload: {} });
      }
    });

    const unsub = relayClient.onMessage((msg: ServerMessage) => {
      if (msg.type === 'workspaces_result') {
        setAvailableWorkspaces((msg.payload.workspaces as any[]) || []);
        return;
      }

      if (msg.type === 'agent_info_result') {
        if (typeof msg.payload.claudeModel === 'string') setClaudeModel(msg.payload.claudeModel);
        if (typeof msg.payload.codexModel === 'string') setCodexModel(msg.payload.codexModel);
        if (Array.isArray(msg.payload.claudeModels)) setClaudeModels(msg.payload.claudeModels as string[]);
        if (Array.isArray(msg.payload.codexModels)) setCodexModels(msg.payload.codexModels as string[]);
        if (msg.payload.workspacePath) setWorkspacePath(msg.payload.workspacePath as string);
        if (Array.isArray(msg.payload.tools)) setAvailableTools(msg.payload.tools as string[]);
        if (msg.payload.effortLevel === 'low' || msg.payload.effortLevel === 'medium' || msg.payload.effortLevel === 'high') {
          setEffortLevel(msg.payload.effortLevel);
        }
        if (msg.payload.responseSpeed === 'standard' || msg.payload.responseSpeed === 'priority') {
          setCodexResponseSpeed(msg.payload.responseSpeed);
        }
        if (msg.payload.transportMode === 'bridge' || msg.payload.transportMode === 'official-remote') {
          setTransportMode(msg.payload.transportMode);
        }
        if (msg.payload.capabilities && typeof msg.payload.capabilities === 'object') {
          setAgentCapabilities(msg.payload.capabilities as any);
        }
        return;
      }

      if (msg.type === 'session_list_result') {
        mergeRemoteSessions((msg.payload.sessions as any[]) || []);
        return;
      }

      const sessionId = msg.sessionId;
      if (!sessionId) return;

      switch (msg.type) {
        case 'session_transcript':
          if (Array.isArray(msg.payload.messages)) {
            setSessionMessages(sessionId, msg.payload.messages as any[]);
          }
          break;
        case 'approval_request':
          addApprovalRequest({
            id: String(msg.payload.approvalId),
            sessionId,
            backend: msg.payload.backend === 'claude-code' ? 'claude-code' : 'codex',
            kind: normalizeApprovalKind(msg.payload.kind),
            title: String(msg.payload.title || '需要审批'),
            preview: String(msg.payload.preview || ''),
            method: typeof msg.payload.method === 'string' ? msg.payload.method : undefined,
            command: typeof msg.payload.command === 'string' ? msg.payload.command : undefined,
            cwd: typeof msg.payload.cwd === 'string' ? msg.payload.cwd : undefined,
            reason: typeof msg.payload.reason === 'string' ? msg.payload.reason : undefined,
            grantRoot: typeof msg.payload.grantRoot === 'string' ? msg.payload.grantRoot : undefined,
            permissions: typeof msg.payload.permissions === 'object' && msg.payload.permissions
              ? msg.payload.permissions as Record<string, unknown>
              : undefined,
            createdAt: typeof msg.payload.createdAt === 'number' ? msg.payload.createdAt : Date.now(),
          });
          break;
        case 'approval_resolved':
          if (msg.payload.approvalId) resolveApprovalRequest(String(msg.payload.approvalId));
          break;
        case 'output':
          if (msg.payload.isComplete) {
            completeStreaming(sessionId);
            clearSessionApprovals(sessionId);
          } else if (msg.payload.thinking) {
            appendMessage(sessionId, {
              id: `think-${Date.now()}`,
              role: 'system',
              content: msg.payload.thinking as string,
              timestamp: Date.now(),
              isThinking: true,
            });
          } else if (msg.payload.toolUse) {
            const tool = msg.payload.toolUse as {
              toolName: string;
              toolId: string;
              input: Record<string, unknown>;
              status?: string;
            };
            appendMessage(sessionId, {
              id: `tool-${Date.now()}`,
              role: 'system',
              content: '',
              timestamp: Date.now(),
              toolUse: tool,
            });
          } else if (msg.payload.toolUpdate) {
            const update = msg.payload.toolUpdate as Record<string, unknown>;
            if (update.toolId) updateToolMessage(sessionId, String(update.toolId), update);
          } else {
            updateStreamingMessage(sessionId, msg.payload.text as string || '');
          }
          break;
        case 'token_usage':
          updateTokenUsage(
            sessionId,
            msg.payload.inputTokens as number || 0,
            msg.payload.outputTokens as number || 0,
            (msg.payload.costUsd as number) || (msg.payload.estimatedCost as number) || 0,
          );
          break;
        case 'status': {
          const state = msg.payload.processState;
          if (state === 'running' || state === 'idle' || state === 'crashed') {
            updateSessionState(sessionId, state);
            if (state !== 'running') clearSessionApprovals(sessionId);
          }
          if (msg.payload.model) {
            if (msg.payload.backend === 'codex') {
              setCodexModel(msg.payload.model as string);
            } else {
              setClaudeModel(msg.payload.model as string);
            }
          }
          if (msg.payload.transportMode === 'bridge' || msg.payload.transportMode === 'official-remote') {
            setTransportMode(msg.payload.transportMode);
            updateSessionTransportMode(sessionId, msg.payload.transportMode);
          }
          if (msg.payload.cwd) {
            setWorkspacePath(msg.payload.cwd as string);
          }
          if (Array.isArray(msg.payload.tools)) {
            setAvailableTools(msg.payload.tools as string[]);
          }
          break;
        }
        case 'error':
          appendMessage(sessionId, {
            id: `error-${Date.now()}`,
            role: 'system',
            content: `错误：${msg.payload.message || 'Agent 运行失败'}`,
            timestamp: Date.now(),
          });
          updateSessionState(sessionId, 'crashed');
          completeStreaming(sessionId);
          clearSessionApprovals(sessionId);
          break;
      }
    });

    return unsub;
  }, []);
}

function normalizeApprovalKind(kind: unknown) {
  if (kind === 'command' || kind === 'file_change' || kind === 'permissions') return kind;
  return 'unknown';
}
