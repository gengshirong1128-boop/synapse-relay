import { resolve, relative, sep } from 'path';
import { statSync, readdirSync, readFileSync } from 'fs';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const BLOCKED_PATTERNS = [/node_modules/, /\.git[\/\\]/, /\.env/];

export class FileService {
  private basePath: string;

  constructor(basePath: string) {
    this.basePath = resolve(basePath);
  }

  setBase(path: string): void {
    this.basePath = resolve(path);
  }

  private resolveSafe(requestedPath: string): string | null {
    const resolved = resolve(this.basePath, requestedPath);
    const rel = relative(this.basePath, resolved);
    if (rel.startsWith('..') || rel.startsWith(sep + sep)) return null;
    for (const pattern of BLOCKED_PATTERNS) {
      if (pattern.test(resolved)) return null;
    }
    return resolved;
  }

  listDirectory(dirPath: string): { name: string; type: 'file' | 'dir'; size: number }[] | null {
    const safe = this.resolveSafe(dirPath || '.');
    if (!safe) return null;
    try {
      const entries = readdirSync(safe);
      return entries
        .filter(name => !name.startsWith('.') || name === '.env.example')
        .map(name => {
          try {
            const stat = statSync(resolve(safe, name));
            return { name, type: (stat.isDirectory() ? 'dir' : 'file') as 'file' | 'dir', size: stat.size };
          } catch {
            return { name, type: 'file' as const, size: 0 };
          }
        });
    } catch {
      return null;
    }
  }

  readFile(filePath: string, maxLines?: number): { content: string; path: string; truncated: boolean } | null {
    const safe = this.resolveSafe(filePath);
    if (!safe) return null;
    try {
      const stat = statSync(safe);
      if (!stat.isFile()) return null;
      if (stat.size > MAX_FILE_SIZE) return null;
      let content = readFileSync(safe, 'utf-8');
      let truncated = false;
      if (maxLines && maxLines > 0) {
        const lines = content.split('\n');
        if (lines.length > maxLines) {
          content = lines.slice(0, maxLines).join('\n');
          truncated = true;
        }
      }
      return { content, path: relative(this.basePath, safe), truncated };
    } catch {
      return null;
    }
  }
}
