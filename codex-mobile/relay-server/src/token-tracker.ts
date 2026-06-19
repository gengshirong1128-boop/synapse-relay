export interface TokenUsage {
  sessionId: string;
  inputTokens: number;
  outputTokens: number;
  cacheTokens: number;
  estimatedCost: number;
}

const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-opus-4-7': { input: 15, output: 75 },
  'claude-haiku-4-5': { input: 0.8, output: 4 },
  'gpt-4o': { input: 2.5, output: 10 },
  'codex-mini': { input: 1.5, output: 6 },
};

export class TokenTracker {
  private usage = new Map<string, TokenUsage>();
  private model = 'claude-sonnet-4-6';

  setModel(model: string): void {
    this.model = model;
  }

  track(sessionId: string, output: string): void {
    const current = this.usage.get(sessionId) || {
      sessionId, inputTokens: 0, outputTokens: 0, cacheTokens: 0, estimatedCost: 0,
    };
    const tokens = Math.ceil(output.length / 4);
    current.outputTokens += tokens;
    current.estimatedCost = this.calculateCost(current);
    this.usage.set(sessionId, current);
  }

  trackInput(sessionId: string, input: string): void {
    const current = this.usage.get(sessionId) || {
      sessionId, inputTokens: 0, outputTokens: 0, cacheTokens: 0, estimatedCost: 0,
    };
    const tokens = Math.ceil(input.length / 4);
    current.inputTokens += tokens;
    current.estimatedCost = this.calculateCost(current);
    this.usage.set(sessionId, current);
  }

  getUsage(sessionId: string): TokenUsage | null {
    return this.usage.get(sessionId) || null;
  }

  private calculateCost(usage: TokenUsage): number {
    const pricing = MODEL_PRICING[this.model] || MODEL_PRICING['claude-sonnet-4-6'];
    const inputCost = (usage.inputTokens / 1_000_000) * pricing.input;
    const outputCost = (usage.outputTokens / 1_000_000) * pricing.output;
    return inputCost + outputCost;
  }
}
