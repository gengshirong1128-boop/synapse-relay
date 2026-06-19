import React from 'react';
import { ChatMessage, useAppStore } from '../store';
import { Backend } from '../services/websocket';
import { getTheme } from '../theme/colors';
import { AGENT_COPY, getBackendBrand } from './agent/agentUtils';
import { AgentMessageRow } from './agent/AgentMessageRow';

type Props = {
  message: ChatMessage;
  backend?: Backend;
};

export function ChatBubble({ message, backend }: Props) {
  const { activeBackend, theme } = useAppStore();
  const resolvedBackend = backend || activeBackend;
  const colors = getTheme(getBackendBrand(resolvedBackend), theme);

  return (
    <AgentMessageRow
      msg={message}
      backend={resolvedBackend}
      colors={colors}
      copy={AGENT_COPY[resolvedBackend]}
    />
  );
}
