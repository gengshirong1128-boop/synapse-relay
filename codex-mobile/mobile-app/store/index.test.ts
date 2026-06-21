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

describe('mergeRemoteSessions', () => {
  beforeEach(() => {
    useAppStore.setState({
      sessions: [],
      activeSessionId: null,
      activeBackend: 'codex',
      codexTransportMode: 'bridge',
      claudeTransportMode: 'bridge',
    });
  });

  it('keeps the user-selected backend even when newest session is the other backend', () => {
    // User picked Codex. A refresh brings in a newer Claude history session.
    // Regression: this used to flip activeBackend to claude-code (bug: phone
    // showed "Claude Code" while the user was on Codex).
    useAppStore.getState().mergeRemoteSessions([
      { id: 'claude-session:aaa', backend: 'claude-code', transportMode: 'bridge', lastActivity: 2000 },
      { id: 'codex-thread:bbb', backend: 'codex', transportMode: 'bridge', lastActivity: 1000 },
    ]);
    expect(useAppStore.getState().activeBackend).toBe('codex');
  });

  it('defaults active session within the selected backend, not the global newest', () => {
    useAppStore.getState().mergeRemoteSessions([
      { id: 'claude-session:aaa', backend: 'claude-code', transportMode: 'bridge', lastActivity: 2000 },
      { id: 'codex-thread:bbb', backend: 'codex', transportMode: 'bridge', lastActivity: 1000 },
    ]);
    // newest overall is the Claude one, but active must be the in-scope Codex session
    expect(useAppStore.getState().activeSessionId).toBe('codex-thread:bbb');
  });

  it('preserves an already-active session across a refresh', () => {
    useAppStore.setState({ activeSessionId: 'codex-thread:bbb', activeBackend: 'codex' });
    useAppStore.getState().mergeRemoteSessions([
      { id: 'codex-thread:bbb', backend: 'codex', transportMode: 'bridge', lastActivity: 1000 },
      { id: 'codex-thread:ccc', backend: 'codex', transportMode: 'bridge', lastActivity: 5000 },
    ]);
    expect(useAppStore.getState().activeSessionId).toBe('codex-thread:bbb');
  });

  it('resets active session when it belongs to another backend', () => {
    useAppStore.setState({
      sessions: [
        makeSession({ id: 'claude-session:aaa', backend: 'claude-code', transportMode: 'bridge', lastActivity: 5000 }),
        makeSession({ id: 'codex-thread:bbb', backend: 'codex', transportMode: 'bridge', lastActivity: 1000 }),
      ],
      activeSessionId: 'claude-session:aaa',
      activeBackend: 'codex',
      codexTransportMode: 'bridge',
      claudeTransportMode: 'bridge',
    });

    useAppStore.getState().mergeRemoteSessions([
      { id: 'claude-session:aaa', backend: 'claude-code', transportMode: 'bridge', lastActivity: 5000 },
      { id: 'codex-thread:bbb', backend: 'codex', transportMode: 'bridge', lastActivity: 1000 },
    ]);

    expect(useAppStore.getState().activeBackend).toBe('codex');
    expect(useAppStore.getState().activeSessionId).toBe('codex-thread:bbb');
  });
});

describe('startNewSession', () => {
  it('clears the active session and flags composingNew (blank thread)', () => {
    useAppStore.setState({ activeSessionId: 'codex-thread:bbb', composingNew: false });
    useAppStore.getState().startNewSession();
    const s = useAppStore.getState();
    expect(s.activeSessionId).toBeNull();
    expect(s.composingNew).toBe(true);
  });

  it('a session_list refresh must NOT pull a composing-new chat back to an old session', () => {
    // Regression: tapping "new chat" then a relay session_list push re-selected
    // the latest old session, so the blank thread vanished.
    useAppStore.setState({
      sessions: [],
      activeSessionId: null,
      composingNew: true,
      activeBackend: 'codex',
      codexTransportMode: 'bridge',
    });
    useAppStore.getState().mergeRemoteSessions([
      { id: 'codex-thread:old', backend: 'codex', transportMode: 'bridge', lastActivity: 9999 },
    ]);
    const s = useAppStore.getState();
    expect(s.activeSessionId).toBeNull();   // stayed on the blank new chat
    expect(s.composingNew).toBe(true);
  });
});
