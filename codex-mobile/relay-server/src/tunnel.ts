import { ChildProcess, spawn, execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { RelayConfig } from './config';

export class TunnelManager {
  private process: ChildProcess | null = null;
  private tunnelUrl: string | null = null;

  constructor(private config: RelayConfig) {}

  async start(): Promise<string | null> {
    if (!this.config.tunnelEnabled) return null;

    const cloudflaredPath = this.findCloudflared();
    if (!cloudflaredPath) {
      console.error('[tunnel] cloudflared not found. Install it or disable tunnel.');
      return null;
    }

    return new Promise((resolve) => {
      this.process = spawn(cloudflaredPath, [
        'tunnel', '--url', `http://localhost:${this.config.port}`,
        '--no-autoupdate',
      ]);

      this.process.stderr?.on('data', (data: Buffer) => {
        const line = data.toString();
        const match = line.match(/https:\/\/[^\s]+\.trycloudflare\.com/);
        if (match && !this.tunnelUrl) {
          this.tunnelUrl = match[0];
          resolve(this.tunnelUrl);
        }
      });

      this.process.on('error', () => {
        resolve(null);
      });

      setTimeout(() => {
        if (!this.tunnelUrl) resolve(null);
      }, 15000);
    });
  }

  private findCloudflared(): string | null {
    try {
      execSync('cloudflared --version', { stdio: 'ignore' });
      return 'cloudflared';
    } catch {
      const localPath = join(process.cwd(), 'cloudflared.exe');
      return existsSync(localPath) ? localPath : null;
    }
  }

  getUrl(): string | null {
    return this.tunnelUrl;
  }

  stop(): void {
    this.process?.kill();
    this.process = null;
    this.tunnelUrl = null;
  }
}
