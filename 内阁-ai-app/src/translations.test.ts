import { describe, it, expect } from 'vitest';
import { translations } from './translations';

const zh = translations.zh;
const en = translations.en;

describe('translations integrity', () => {
  it('zh and en expose the exact same key set', () => {
    const zhKeys = Object.keys(zh).sort();
    const enKeys = Object.keys(en).sort();
    expect(enKeys).toEqual(zhKeys);
  });

  it('has no empty values in either language', () => {
    for (const [key, value] of Object.entries(zh)) {
      expect(value.trim(), `zh.${key} is empty`).not.toBe('');
    }
    for (const [key, value] of Object.entries(en)) {
      expect(value.trim(), `en.${key} is empty`).not.toBe('');
    }
  });

  it('english values contain no leftover CJK characters', () => {
    // switchLanguage intentionally shows the target language name ("中文") in the
    // English UI, so it is exempt from the leftover-translation check.
    const exempt = new Set(['switchLanguage']);
    const cjk = /[一-鿿]/;
    for (const [key, value] of Object.entries(en)) {
      if (exempt.has(key)) continue;
      expect(cjk.test(value), `en.${key} still contains CJK: "${value}"`).toBe(false);
    }
  });
});
