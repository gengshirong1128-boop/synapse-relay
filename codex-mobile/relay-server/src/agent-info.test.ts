import { describe, it, expect } from 'vitest';
import { uniqueStrings, cleanModelName, isOfficialAnthropic } from './agent-info';

const ESC = '';

describe('cleanModelName', () => {
  it('strips ANSI color codes a CLI may emit', () => {
    expect(cleanModelName(`${ESC}[33msonnet${ESC}[0m`)).toBe('sonnet');
  });

  it('trims surrounding whitespace', () => {
    expect(cleanModelName('  opus  ')).toBe('opus');
  });

  it('leaves a clean name unchanged', () => {
    expect(cleanModelName('claude-opus-4-7')).toBe('claude-opus-4-7');
  });
});

describe('uniqueStrings', () => {
  it('dedupes while preserving first-seen order', () => {
    expect(uniqueStrings(['opus', 'sonnet', 'opus', 'haiku'])).toEqual(['opus', 'sonnet', 'haiku']);
  });

  it('drops empty/whitespace entries (e.g. unset config model)', () => {
    expect(uniqueStrings(['', '  ', 'sonnet'])).toEqual(['sonnet']);
  });

  it('cleans then dedupes so colored and plain forms collapse', () => {
    expect(uniqueStrings([`${ESC}[1msonnet${ESC}[0m`, 'sonnet'])).toEqual(['sonnet']);
  });

  it('merges current model with known aliases (the Claude model-list fix)', () => {
    // readClaudeConfig returns uniqueStrings([currentModel, ...KNOWN])
    expect(uniqueStrings(['claude-opus-4-7', 'sonnet', 'opus', 'haiku']))
      .toEqual(['claude-opus-4-7', 'sonnet', 'opus', 'haiku']);
  });
});

describe('isOfficialAnthropic', () => {
  it('treats an empty base url as official (default Anthropic API)', () => {
    expect(isOfficialAnthropic('')).toBe(true);
  });

  it('recognizes the official api host', () => {
    expect(isOfficialAnthropic('https://api.anthropic.com')).toBe(true);
  });

  it('flags a third-party proxy as NOT official (so aliases are dropped)', () => {
    // The real user config: claude routed through right.codes with model claude-opus-4-7[1m].
    expect(isOfficialAnthropic('https://right.codes/claude-aws')).toBe(false);
  });

  it('does not match look-alike hosts containing anthropic.com as a substring', () => {
    expect(isOfficialAnthropic('https://anthropic.com.evil.example')).toBe(false);
  });

  it('treats a malformed url as third-party (safe default: keep only real models)', () => {
    expect(isOfficialAnthropic('not a url')).toBe(false);
  });
});
