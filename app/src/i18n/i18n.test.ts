import { describe, expect, it } from 'vitest';
import { en, type MessageKey } from './en';
import { DICTIONARIES, LANGUAGES, relativeAgo, translate, type Lang } from './index';

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const keys = Object.keys(en) as MessageKey[];

describe('dictionaries', () => {
  it('offers the eight languages', () => {
    expect(LANGUAGES.map((l) => l.code).sort()).toEqual(['bn', 'en', 'hi', 'kn', 'ml', 'mr', 'ta', 'te']);
  });

  for (const lang of Object.keys(DICTIONARIES) as Lang[]) {
    it(`${lang}: every string is filled in and keeps the English placeholders`, () => {
      const dict = DICTIONARIES[lang];
      expect(Object.keys(dict).sort()).toEqual([...keys].sort());
      for (const key of keys) {
        expect(dict[key].trim(), key).not.toBe('');
        expect(placeholders(dict[key]), key).toEqual(placeholders(en[key]));
      }
    });
  }
});

describe('translate', () => {
  it('fills placeholders', () => {
    expect(translate('en', 'ev.still', { secs: 3 })).toBe('Hand still again · 3 s of signal flagged');
    expect(translate('ta', 'auth.welcome', { name: 'Meena' })).toBe('வணக்கம், Meena');
  });

  it('leaves unknown placeholders visible rather than dropping them', () => {
    expect(translate('en', 'auth.welcome')).toBe('Welcome, {name}');
  });
});

describe('relativeAgo', () => {
  it('formats seconds, minutes and hours', () => {
    expect(relativeAgo('en', 0, 12_000)).toBe('12 sec. ago');
    expect(relativeAgo('en', 0, 4 * 60_000)).toBe('4 min. ago');
    expect(relativeAgo('en', 0, 2 * 3_600_000)).toBe('2 hr. ago');
    expect(relativeAgo('en', 5_000, 5_000)).toBe('now');
  });

  it('works for every language', () => {
    for (const { code } of LANGUAGES) expect(relativeAgo(code, 0, 90_000)).not.toBe('');
  });
});
