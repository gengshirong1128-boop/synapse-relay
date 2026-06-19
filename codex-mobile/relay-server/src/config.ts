import { config } from 'dotenv';
import { resolve } from 'path';
import { randomBytes } from 'crypto';
import { existsSync } from 'fs';

config({ path: resolve(__dirname, '../.env') });

export interface ApiEndpoint {
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface TlsConfig {
  enabled: boolean;
  certPath: string;
  keyPath: string;
}

export interface RelayConfig {
  port: number;
  jwtSecret: string;
  authTokenExpiry: string;
  tunnelEnabled: boolean;
  claudeCodePath: string;
  codexPath: string;
  customApiEndpoints: ApiEndpoint[];
  tls: TlsConfig;
  sessionTimeoutMs: number;
}

export function loadConfig(): RelayConfig {
  const jwtSecret = process.env.JWT_SECRET && process.env.JWT_SECRET !== 'your-secret-key-change-this'
    ? process.env.JWT_SECRET
    : randomBytes(32).toString('hex');

  const certPath = process.env.TLS_CERT || '';
  const keyPath = process.env.TLS_KEY || '';
  const tlsEnabled = !!(certPath && keyPath && existsSync(certPath) && existsSync(keyPath));

  return {
    port: parseInt(process.env.PORT || '8765', 10),
    jwtSecret,
    authTokenExpiry: process.env.AUTH_TOKEN_EXPIRY || '30d',
    tunnelEnabled: process.env.TUNNEL_ENABLED === 'true',
    claudeCodePath: process.env.CLAUDE_CODE_PATH || 'claude',
    codexPath: process.env.CODEX_PATH || 'codex',
    customApiEndpoints: [],
    tls: { enabled: tlsEnabled, certPath, keyPath },
    sessionTimeoutMs: parseInt(process.env.SESSION_TIMEOUT_MS || '3600000', 10),
  };
}
