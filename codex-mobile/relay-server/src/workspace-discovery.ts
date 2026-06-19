import { readdir, readFile, stat } from 'fs/promises';
import { homedir } from 'os';
import { basename, join, resolve } from 'path';

export interface WorkspaceInfo {
  id: string;
  name: string;
  path: string;
  lastUsed: number;
}

export async function discoverWorkspaces(defaultRoot: string, extraPaths: string[] = []): Promise<WorkspaceInfo[]> {
  const candidates = new Map<string, WorkspaceInfo>();

  const addWorkspace = async (rawPath: string) => {
    if (!rawPath) return;
    const path = resolve(rawPath);
    try {
      const info = await stat(path);
      if (!info.isDirectory()) return;
      const key = path.toLowerCase();
      if (candidates.has(key)) return;
      candidates.set(key, {
        id: key,
        name: basename(path) || path,
        path,
        lastUsed: info.mtimeMs,
      });
    } catch {
      // Ignore stale paths from local agent config.
    }
  };

  await addWorkspace(defaultRoot);
  for (const path of extraPaths) {
    await addWorkspace(path);
  }

  try {
    const entries = await readdir(defaultRoot, { withFileTypes: true });
    for (const entry of entries.filter(e => e.isDirectory() && !e.name.startsWith('.')).slice(0, 20)) {
      await addWorkspace(resolve(defaultRoot, entry.name));
    }
  } catch {
    // Root may be unavailable when relay is packaged elsewhere.
  }

  try {
    const codexConfig = await readFile(join(homedir(), '.codex', 'config.toml'), 'utf-8');
    const projectMatches = codexConfig.matchAll(/\[projects\.(?:'([^']+)'|"([^"]+)")\]/g);
    for (const match of projectMatches) {
      await addWorkspace(match[1] || match[2] || '');
    }
  } catch {
    // Codex may not be installed/configured.
  }

  return Array.from(candidates.values())
    .sort((a, b) => b.lastUsed - a.lastUsed)
    .slice(0, 30);
}
