import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, sep, parse } from 'path';
import { FileService } from './file-service';

// A workspace sandbox with one nested file, plus a sibling file OUTSIDE it that
// must never be reachable. These tests lock the path-traversal fix: absolute
// paths, other drives, and ../ escapes must all be rejected.
let workspace: string;
let outsideFile: string;

beforeAll(() => {
  const root = mkdtempSync(join(tmpdir(), 'fs-test-'));
  workspace = join(root, 'workspace');
  mkdirSync(join(workspace, 'sub'), { recursive: true });
  writeFileSync(join(workspace, 'inside.txt'), 'inside-ok');
  writeFileSync(join(workspace, 'sub', 'nested.txt'), 'nested-ok');
  // Secret sibling outside the workspace (e.g. ../secret.txt).
  outsideFile = join(root, 'secret.txt');
  writeFileSync(outsideFile, 'TOP SECRET');
});

afterAll(() => {
  try { rmSync(workspace, { recursive: true, force: true }); } catch { /* noop */ }
});

describe('FileService path containment', () => {
  it('reads a normal file inside the workspace', () => {
    const svc = new FileService(workspace);
    const r = svc.readFile('inside.txt');
    expect(r?.content).toBe('inside-ok');
  });

  it('reads a nested file inside the workspace', () => {
    const svc = new FileService(workspace);
    expect(svc.readFile(join('sub', 'nested.txt'))?.content).toBe('nested-ok');
  });

  it('rejects an absolute path (the core traversal fix)', () => {
    const svc = new FileService(workspace);
    expect(svc.readFile(outsideFile)).toBeNull();
  });

  it('rejects a ../ escape out of the workspace', () => {
    const svc = new FileService(workspace);
    expect(svc.readFile(join('..', 'secret.txt'))).toBeNull();
  });

  it('rejects a deep ../../ escape', () => {
    const svc = new FileService(workspace);
    expect(svc.readFile(join('..', '..', '..', '..', 'Windows', 'win.ini'))).toBeNull();
  });

  it('rejects another Windows drive root when workspace is not on it', () => {
    const svc = new FileService(workspace);
    const base = parse(workspace).root; // e.g. "C:\"
    const otherDrive = base.toUpperCase().startsWith('C') ? 'D:\\Users\\x.txt' : 'C:\\Users\\x.txt';
    // Only meaningful on Windows-style roots; on POSIX this is just an abs path (also rejected).
    expect(svc.readFile(otherDrive)).toBeNull();
  });

  it('listDirectory rejects an absolute path', () => {
    const svc = new FileService(workspace);
    expect(svc.listDirectory(parse(workspace).root)).toBeNull();
  });

  it('listDirectory allows the workspace root itself', () => {
    const svc = new FileService(workspace);
    const entries = svc.listDirectory('.');
    expect(entries?.some(e => e.name === 'inside.txt')).toBe(true);
  });
});
