import { spawn } from 'child_process';
import { readFile } from 'fs/promises';
import { homedir } from 'os';
import { join } from 'path';
import { Backend } from './process-manager';

export type TransportMode = 'bridge' | 'official-remote';

export interface AgentCapabilities {
  claudeRemoteControlAvailable: boolean;
  codexAppServerAvailable: boolean;
  persistentSessions: boolean;
  liveApprovals: boolean;
  canStop: boolean;
}

export interface AgentInfoPayload {
  claudeModel: string;
  claudeModels: string[];
  codexModel: string;
  codexModels: string[];
  currentModel: string;
  effortLevel: string;
  responseSpeed: string;
  workspacePath: string;
  transportMode: TransportMode;
  capabilities: AgentCapabilities;
}

type ReadAgentInfoOptions = {
  backend: Backend;
  claudeCodePath: string;
  codexPath: string;
  workspacePath: string;
};

export async function readAgentInfo(options: ReadAgentInfoOptions): Promise<AgentInfoPayload> {
  const [claudeConfig, codexConfig, capabilities] = await Promise.all([
    readClaudeConfig(),
    readCodexConfig(),
    detectCapabilities(options.claudeCodePath, options.codexPath),
  ]);

  const transportMode = options.backend === 'codex' && capabilities.codexAppServerAvailable
    ? 'official-remote'
    : 'bridge';

  return {
    claudeModel: claudeConfig.model,
    claudeModels: claudeConfig.models,
    codexModel: codexConfig.model,
    codexModels: codexConfig.models,
    currentModel: options.backend === 'codex' ? codexConfig.model : claudeConfig.model,
    effortLevel: codexConfig.effortLevel,
    responseSpeed: codexConfig.responseSpeed,
    workspacePath: options.workspacePath,
    transportMode,
    capabilities: {
      ...capabilities,
      persistentSessions: transportMode === 'official-remote',
      liveApprovals: options.backend === 'codex' && capabilities.codexAppServerAvailable,
    },
  };
}

// Claude Code CLI accepts model aliases (not just full names) via --model.
// There is no non-interactive command to enumerate models (/model is a TUI
// command), so we offer the well-known aliases plus whatever the user has
// configured. This makes the phone show real, selectable options instead of a
// single config value.
const KNOWN_CLAUDE_MODELS = ['sonnet', 'opus', 'haiku'];

async function readClaudeConfig(): Promise<{ model: string; models: string[] }> {
  try {
    const settings = JSON.parse(await readFile(join(homedir(), '.claude', 'settings.json'), 'utf-8')) as {
      model?: string;
      env?: { ANTHROPIC_MODEL?: string };
    };
    const model = cleanModelName(settings.model || settings.env?.ANTHROPIC_MODEL || '');
    return { model, models: uniqueStrings([model, ...KNOWN_CLAUDE_MODELS]) };
  } catch {
    return { model: '', models: uniqueStrings(KNOWN_CLAUDE_MODELS) };
  }
}

async function readCodexConfig(): Promise<{
  model: string;
  models: string[];
  effortLevel: string;
  responseSpeed: string;
}> {
  let model = '';
  let effortLevel = '';
  let responseSpeed = 'standard';

  try {
    const config = await readFile(join(homedir(), '.codex', 'config.toml'), 'utf-8');
    model = cleanModelName(config.match(/^model\s*=\s*"([^"]+)"/m)?.[1] || '');

    const rawEffort = config.match(/^model_reasoning_effort\s*=\s*"([^"]+)"/m)?.[1] || '';
    effortLevel = rawEffort === 'low' || rawEffort === 'medium' || rawEffort === 'high'
      ? rawEffort
      : rawEffort ? 'high' : '';

    const serviceTier = config.match(/^service_tier\s*=\s*"([^"]+)"/m)?.[1] || '';
    responseSpeed = serviceTier === 'priority' ? 'priority' : 'standard';
  } catch {
    // Keep CLI defaults when Codex config is absent.
  }

  const cachedModels = await readCodexModelCache();
  return {
    model,
    models: uniqueStrings([model, ...cachedModels]),
    effortLevel,
    responseSpeed,
  };
}

async function readCodexModelCache(): Promise<string[]> {
  try {
    const cache = JSON.parse(await readFile(join(homedir(), '.codex', 'models_cache.json'), 'utf-8')) as {
      models?: { slug?: string; visibility?: string }[];
    };
    return (cache.models || [])
      .filter(model => model.slug && model.visibility !== 'hidden')
      .map(model => model.slug as string);
  } catch {
    return [];
  }
}

async function detectCapabilities(claudeCodePath: string, codexPath: string): Promise<AgentCapabilities> {
  const [claudeRemoteControlAvailable, codexAppServerAvailable] = await Promise.all([
    helpIncludes(claudeCodePath, ['--help'], '--remote-control'),
    helpIncludes(codexPath, ['app-server', '--help'], 'app-server'),
  ]);

  return {
    claudeRemoteControlAvailable,
    codexAppServerAvailable,
    persistentSessions: false,
    liveApprovals: false,
    canStop: true,
  };
}

function helpIncludes(command: string, args: string[], needle: string): Promise<boolean> {
  return new Promise(resolve => {
    let output = '';
    let finished = false;
    const proc = spawn([command, ...args].map(quoteShellArg).join(' '), {
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolve(output.includes(needle));
    };

    const timer = setTimeout(() => {
      try { proc.kill('SIGTERM'); } catch {}
      finish();
    }, 2500);

    proc.stdout?.on('data', data => {
      output += data.toString();
      if (output.length > 30000) output = output.slice(-30000);
    });
    proc.stderr?.on('data', data => {
      output += data.toString();
      if (output.length > 30000) output = output.slice(-30000);
    });
    proc.on('exit', finish);
    proc.on('error', finish);
  });
}

function quoteShellArg(value: string): string {
  if (/^[A-Za-z0-9_./:=@+-]+$/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

export function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map(cleanModelName).filter(Boolean)));
}

export function cleanModelName(value: string): string {
  return value.replace(/\u001b\[[0-9;]*m/g, '').replace(/\[[0-9;]*m\]/g, '').trim();
}
