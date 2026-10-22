import { useId } from 'react';
import { LANGUAGES, useI18n, useI18nStore } from '../i18n';

/** Grid of the eight languages, each written in its own script. Real radios, so arrow keys work. */
export function LanguagePicker({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();
  const lang = useI18nStore((s) => s.lang);
  const setLang = useI18nStore((s) => s.setLang);
  const name = useId();

  return (
    <fieldset>
      <legend className="label mb-2">{t('lang.label')}</legend>
      <div className={`grid gap-1.5 ${compact ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-4'}`}>
        {LANGUAGES.map((l) => {
          const selected = l.code === lang;
          return (
            <label
              key={l.code}
              lang={l.code}
              title={l.english}
              className={`flex min-h-10 cursor-pointer items-center justify-center rounded-[3px] border px-1 text-center text-[13px] font-medium transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-1 has-[:focus-visible]:outline-select ${
                selected ? 'border-signal bg-signal/15 text-fg' : 'border-line text-muted hover:border-line-strong hover:text-fg'
              }`}
            >
              <input
                type="radio"
                name={name}
                value={l.code}
                checked={selected}
                onChange={() => setLang(l.code)}
                aria-label={`${l.name} (${l.english})`}
                className="sr-only"
              />
              {l.name}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
