// Pure scheduling derivations extracted from App.tsx so they can be unit-tested
// without mounting the component. Parameters use minimal structural types.

export type TaskLike = { task_id: string; status: string };
export type AgentLike = { id: string };

/** Default agent: the preferred id if callable, else the first callable, else ''. */
export function pickDefaultAgentId(callable: AgentLike[], preferredId = 'cli.codex'): string {
  return callable.find((agent) => agent.id === preferredId)?.id || callable[0]?.id || '';
}

/** Round-robin agent id for a task position, with a safe fallback when none are callable. */
export function agentForIndex(callable: AgentLike[], index: number, fallbackId: string): string {
  return callable[index % Math.max(callable.length, 1)]?.id || fallbackId;
}

export type AgentTestResult = { success?: boolean; status?: string; error?: string; output?: string };
export type AgentTestState = { state: 'ok' | 'fail'; detail?: string };

/** Map a backend connection-test response to the UI state shown on the agent card. */
export function mapAgentTestResult(result: AgentTestResult): AgentTestState {
  if (result.success) {
    return { state: 'ok', detail: result.output?.slice(0, 120) };
  }
  return { state: 'fail', detail: result.error || result.status };
}

export function computeProgress(tasks: { status: string }[]): number {
  if (!tasks.length) return 0;
  const completed = tasks.filter((task) => task.status === 'completed').length;
  return Math.round((completed / tasks.length) * 100);
}

/** Index of the first wave that still has an unfinished task, or -1 when all done. */
export function currentWaveIndex(waves: string[][], tasks: TaskLike[]): number {
  return waves.findIndex((wave) =>
    wave.some((taskId) => tasks.find((task) => task.task_id === taskId)?.status !== 'completed'),
  );
}

/** Tasks in the current wave that can be launched now (pending or previously failed). */
export function launchableWaveTasks<T extends TaskLike>(
  waves: string[][],
  tasks: T[],
  waveIndex: number,
): T[] {
  if (waveIndex < 0 || !waves[waveIndex]) return [];
  return waves[waveIndex]
    .map((taskId) => tasks.find((task) => task.task_id === taskId))
    .filter((task): task is T => Boolean(task && ['pending', 'failed'].includes(task.status)));
}
