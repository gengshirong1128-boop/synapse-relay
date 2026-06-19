import { describe, it, expect } from 'vitest';
import { computeProgress, currentWaveIndex, launchableWaveTasks, pickDefaultAgentId, agentForIndex, mapAgentTestResult } from './planLogic';

const t = (task_id: string, status: string) => ({ task_id, status });

describe('computeProgress', () => {
  it('returns 0 for no tasks', () => {
    expect(computeProgress([])).toBe(0);
  });

  it('rounds the completed percentage', () => {
    expect(computeProgress([t('a', 'completed'), t('b', 'pending'), t('c', 'pending')])).toBe(33);
    expect(computeProgress([t('a', 'completed'), t('b', 'completed')])).toBe(100);
  });
});

describe('currentWaveIndex', () => {
  const waves = [['a', 'b'], ['c']];

  it('returns the first wave with an unfinished task', () => {
    const tasks = [t('a', 'completed'), t('b', 'running'), t('c', 'pending')];
    expect(currentWaveIndex(waves, tasks)).toBe(0);
  });

  it('advances once an earlier wave is fully completed', () => {
    const tasks = [t('a', 'completed'), t('b', 'completed'), t('c', 'pending')];
    expect(currentWaveIndex(waves, tasks)).toBe(1);
  });

  it('returns -1 when every wave is complete', () => {
    const tasks = [t('a', 'completed'), t('b', 'completed'), t('c', 'completed')];
    expect(currentWaveIndex(waves, tasks)).toBe(-1);
  });
});

describe('launchableWaveTasks', () => {
  const waves = [['a', 'b'], ['c']];

  it('returns pending and failed tasks in the wave', () => {
    const tasks = [t('a', 'pending'), t('b', 'failed'), t('c', 'pending')];
    expect(launchableWaveTasks(waves, tasks, 0).map((task) => task.task_id)).toEqual(['a', 'b']);
  });

  it('excludes running and completed tasks', () => {
    const tasks = [t('a', 'running'), t('b', 'completed'), t('c', 'pending')];
    expect(launchableWaveTasks(waves, tasks, 0)).toEqual([]);
  });

  it('returns [] for an out-of-range or negative wave index', () => {
    const tasks = [t('a', 'pending')];
    expect(launchableWaveTasks(waves, tasks, -1)).toEqual([]);
    expect(launchableWaveTasks(waves, tasks, 9)).toEqual([]);
  });
});

describe('pickDefaultAgentId', () => {
  it('prefers the preferred id when callable', () => {
    expect(pickDefaultAgentId([{ id: 'cli.gemini' }, { id: 'cli.codex' }])).toBe('cli.codex');
  });

  it('falls back to the first callable when the preferred is absent', () => {
    expect(pickDefaultAgentId([{ id: 'cli.gemini' }, { id: 'cli.claude_code' }])).toBe('cli.gemini');
  });

  it('returns an empty string when nothing is callable', () => {
    expect(pickDefaultAgentId([])).toBe('');
  });

  it('honours a custom preferred id', () => {
    expect(pickDefaultAgentId([{ id: 'a' }, { id: 'b' }], 'b')).toBe('b');
  });
});

describe('agentForIndex', () => {
  const callable = [{ id: 'a' }, { id: 'b' }];

  it('assigns round-robin by position', () => {
    expect(agentForIndex(callable, 0, 'fb')).toBe('a');
    expect(agentForIndex(callable, 1, 'fb')).toBe('b');
    expect(agentForIndex(callable, 2, 'fb')).toBe('a');
  });

  it('uses the fallback when no agents are callable (no divide-by-zero)', () => {
    expect(agentForIndex([], 0, 'fb')).toBe('fb');
    expect(agentForIndex([], 3, 'fb')).toBe('fb');
  });
});

describe('mapAgentTestResult', () => {
  it('maps a successful probe to ok with truncated output', () => {
    expect(mapAgentTestResult({ success: true, output: 'codex-cli 0.141.0' })).toEqual({
      state: 'ok',
      detail: 'codex-cli 0.141.0',
    });
  });

  it('truncates long output to 120 chars', () => {
    const long = 'x'.repeat(200);
    const mapped = mapAgentTestResult({ success: true, output: long });
    expect(mapped.state).toBe('ok');
    expect(mapped.detail?.length).toBe(120);
  });

  it('maps a failure to fail with the error message', () => {
    expect(mapAgentTestResult({ success: false, error: 'timeout' })).toEqual({
      state: 'fail',
      detail: 'timeout',
    });
  });

  it('falls back to status when no error is present', () => {
    expect(mapAgentTestResult({ success: false, status: 'not_installed' })).toEqual({
      state: 'fail',
      detail: 'not_installed',
    });
  });
});
