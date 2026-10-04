import { useEffect } from 'react';
import { create } from 'zustand';
import { bn } from './bn';
import { en, type MessageKey, type Messages } from './en';
import { hi } from './hi';
import { kn } from './kn';
import { ml } from './ml';
import { mr } from './mr';
import { ta } from './ta';
import { te } from './te';

export type { MessageKey } from './en';
export type Lang = 'en' | 'hi' | 'ta' | 'te' | 'kn' | 'ml' | 'bn' | 'mr';
export type Vars = Record<string, string | number>;
export type Translate = (key: MessageKey, vars?: Vars) => string;

/** Language names are shown in their own script so people can find theirs. */
export const LANGUAGES: { code: Lang; name: string; english: string }[] = [
  { code: 'en', name: 'English', english: 'English' },
  { code: 'hi', name: 'हिन्दी', english: 'Hindi' },
  { code: 'ta', name: 'தமிழ்', english: 'Tamil' },
  { code: 'te', name: 'తెలుగు', english: 'Telugu' },
  { code: 'kn', name: 'ಕನ್ನಡ', english: 'Kannada' },
  { code: 'ml', name: 'മലയാളം', english: 'Malayalam' },
  { code: 'bn', name: 'বাংলা', english: 'Bengali' },
  { code: 'mr', name: 'मराठी', english: 'Marathi' },
];

export const DICTIONARIES: Record<Lang, Messages> = { en, hi, ta, te, kn, ml, bn, mr };

const STORAGE_KEY = 'nadisense.lang';

function isLang(value: unknown): value is Lang {
  return typeof value === 'string' && value in DICTIONARIES;
}

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isLang(saved)) return saved;
  } catch {
    // storage blocked
  }
  const browser = typeof navigator !== 'undefined' ? navigator.language.slice(0, 2) : 'en';
  return isLang(browser) ? browser : 'en';
}

export function translate(lang: Lang, key: MessageKey, vars?: Vars): string {
  const template = DICTIONARIES[lang][key] ?? en[key];
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}

/** "12 sec. ago", "4 min. ago" in the chosen language. */
export function relativeAgo(lang: Lang, thenMs: number, nowMs = Date.now()): string {
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto', style: 'short' });
  const s = Math.round((thenMs - nowMs) / 1000);
  if (Math.abs(s) < 60) return rtf.format(s, 'second');
  const m = Math.round(s / 60);
  if (Math.abs(m) < 60) return rtf.format(m, 'minute');
  return rtf.format(Math.round(m / 60), 'hour');
}

interface I18nState {
  lang: Lang;
  setLang(lang: Lang): void;
}

export const useI18nStore = create<I18nState>((set) => ({
  lang: initialLang(),
  setLang(lang) {
    set({ lang });
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // storage blocked: choice lasts for this visit
    }
  },
}));

export function useI18n(): { lang: Lang; t: Translate; ago: (thenMs: number, nowMs?: number) => string } {
  const lang = useI18nStore((s) => s.lang);
  return {
    lang,
    t: (key, vars) => translate(lang, key, vars),
    ago: (thenMs, nowMs) => relativeAgo(lang, thenMs, nowMs),
  };
}

/** Keeps <html lang> in step so screen readers and fonts pick the right language. */
export function useDocumentLang(): void {
  const lang = useI18nStore((s) => s.lang);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
}

export function isMessageKey(value: string): value is MessageKey {
  return value in en;
}
