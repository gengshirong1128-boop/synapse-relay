import jwt from 'jsonwebtoken';
import { randomInt } from 'crypto';
import { RelayConfig } from './config';

export class AuthManager {
  private pairingCode: string | null = null;
  private config: RelayConfig;

  constructor(config: RelayConfig) {
    this.config = config;
  }

  generatePairingCode(): string {
    this.pairingCode = String(randomInt(100000, 999999));
    return this.pairingCode;
  }

  verifyPairingCode(code: string): boolean {
    if (!this.pairingCode) return false;
    const valid = code === this.pairingCode;
    if (valid) this.pairingCode = null;
    return valid;
  }

  generateToken(clientId: string): string {
    return jwt.sign(
      { clientId, iat: Math.floor(Date.now() / 1000) },
      this.config.jwtSecret,
      { expiresIn: this.config.authTokenExpiry } as jwt.SignOptions
    );
  }

  verifyToken(token: string): { clientId: string } | null {
    try {
      const decoded = jwt.verify(token, this.config.jwtSecret);
      return decoded as { clientId: string };
    } catch {
      return null;
    }
  }
}
