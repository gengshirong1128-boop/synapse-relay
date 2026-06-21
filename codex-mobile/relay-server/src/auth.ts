import jwt from 'jsonwebtoken';
import { randomInt } from 'crypto';
import { RelayConfig } from './config';

export type PairingVerificationResult = 'valid' | 'invalid' | 'expired' | 'locked';

// Pairing code lifetime. Needs to be long enough for the real flow: user reads
// the code off the terminal, loads the app, types the address + code. 3 min was
// too short (users hit "expired" mid-setup). 15 min balances usability vs. the
// brute-force window (further bounded by MAX_PAIRING_ATTEMPTS lockout).
const PAIRING_CODE_TTL_MS = 15 * 60 * 1000;
const MAX_PAIRING_ATTEMPTS = 5;

export class AuthManager {
  private pairingCode: string | null = null;
  private pairingCodeExpiresAt = 0;
  private pairingAttempts = 0;
  private config: RelayConfig;

  constructor(config: RelayConfig) {
    this.config = config;
  }

  generatePairingCode(): string {
    this.pairingCode = String(randomInt(100000, 999999));
    this.pairingCodeExpiresAt = Date.now() + PAIRING_CODE_TTL_MS;
    this.pairingAttempts = 0;
    return this.pairingCode;
  }

  verifyPairingCode(code: string): boolean {
    return this.verifyPairingCodeDetailed(code) === 'valid';
  }

  verifyPairingCodeDetailed(code: string): PairingVerificationResult {
    if (!this.pairingCode) return 'invalid';
    if (Date.now() > this.pairingCodeExpiresAt) {
      this.clearPairingCode();
      return 'expired';
    }

    if (code === this.pairingCode) {
      this.clearPairingCode();
      return 'valid';
    }

    this.pairingAttempts += 1;
    if (this.pairingAttempts >= MAX_PAIRING_ATTEMPTS) {
      this.clearPairingCode();
      return 'locked';
    }

    return 'invalid';
  }

  private clearPairingCode(): void {
    this.pairingCode = null;
    this.pairingCodeExpiresAt = 0;
    this.pairingAttempts = 0;
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
