import https from 'https';

interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export class PushService {
  private pushTokens = new Map<string, string>();

  registerToken(clientId: string, token: string): void {
    this.pushTokens.set(clientId, token);
  }

  removeToken(clientId: string): void {
    this.pushTokens.delete(clientId);
  }

  async notify(clientId: string, title: string, body: string, data?: Record<string, unknown>): Promise<void> {
    const token = this.pushTokens.get(clientId);
    if (!token) return;

    const message: PushMessage = { to: token, title, body, data };
    await this.sendExpoPush([message]);
  }

  async notifyAll(title: string, body: string, data?: Record<string, unknown>): Promise<void> {
    const messages: PushMessage[] = [];
    for (const token of this.pushTokens.values()) {
      messages.push({ to: token, title, body, data });
    }
    if (messages.length > 0) {
      await this.sendExpoPush(messages);
    }
  }

  private sendExpoPush(messages: PushMessage[]): Promise<void> {
    return new Promise((resolve) => {
      const payload = JSON.stringify(messages);
      const req = https.request({
        hostname: 'exp.host',
        path: '/--/api/v2/push/send',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
      }, () => resolve());
      req.on('error', () => resolve());
      req.write(payload);
      req.end();
    });
  }
}
