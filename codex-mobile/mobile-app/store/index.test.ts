import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from './index';
import type { Session } from './index';

function makeSession(over: Partial<Session> & Pick<Session, 'id' | 'backend'>): Session {
  return {
    name: over.id,
    cwd: undefined,
    messages: [],
    tokenUsage: { input: 0, output: 0, cost: 0 },
    state: 'idle',
    lastActivity: Date.now(),
    ...over,
  } as Session;
}

describe('setActiveSession', () => {
  beforeEach(() => {
    useAppStore.setState({
      sessions: [
        makeSession({ id: 'codex-cli', backend: 'codex', transportMode: 'bridge' }),
        makeSession({ id: 'claude-cli', backend: 'claude-code', transportMode: 'bridge' }),
        makeSession({ id: 'codex-desktop', backend: 'codex', transportMode: 'official-remote' }),
      ],
      activeSessionId: 'claude-cli',
      activeBackend: 'claude-code',
      codexTransportMode: 'official-remote',
      claudeTransportMode: 'bridge',
    });
  });

  it('aligns backend AND transportMode to the opened session', () => {
    // Opening a Codex CLI session while codexTransportMode is official-remote
    // must flip both backend and transportMode, so the chat view matches it.
    useAppStore.getState().setActiveSession('codex-cli');
    const s = useAppStore.getState();
    expect(s.activeSessionId).toBe('codex-cli');
    expect(s.activeBackend).toBe('codex');
    expect(s.codexTransportMode).toBe('bridge'); // aligned, was official-remote
  });

  it('opening a Desktop session sets official-remote', () => {
    useAppStore.getState().setActiveSession('codex-desktop');
    const s = useAppStore.getState();
    expect(s.activeBackend).toBe('codex');
    expect(s.codexTransportMode).toBe('official-remote');
  });

  it('does not touch the other backend transportMode', () => {
    useAppStore.getState().setActiveSession('codex-cli');
    // claude mode stays as it was
    expect(useAppStore.getState().claudeTransportMode).toBe('bridge');
  });
});
