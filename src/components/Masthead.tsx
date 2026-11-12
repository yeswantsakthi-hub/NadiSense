import type { ReactNode } from 'react';
import { useI18n } from '../i18n';
import { Wordmark } from './Logo';
import { RingArt } from './RingArt';

/** Kept for screens that only need the brand bar. */
export function BrandBar() {
  return (
    <div className="flex h-16 items-center">
      <Wordmark />
    </div>
  );
}

/**
 * Top of the sign-in and pairing screens: brand bar, a large headline, and the ring on a lit
 * stage with the four things v1 measures.
 */
export function Masthead({ title, subtitle, active }: { title?: ReactNode; subtitle?: ReactNode; active?: boolean }) {
  const { t } = useI18n();
  return (
    <header>
      <BrandBar />
      <div className="surface relative mt-2 overflow-hidden rounded-3xl">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(420px_220px_at_50%_78%,rgba(242,58,69,0.20),transparent_70%)]" />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand/50 to-transparent" />
        <div className="relative px-6 pt-6">
          <h1 className="text-[26px] leading-[1.15] font-semibold tracking-[-0.02em] text-balance">{title ?? t('app.tagline')}</h1>
          {subtitle && <p className="mt-2 text-[14px] text-label">{subtitle}</p>}
        </div>
        <RingArt active={active} className="relative mx-auto mt-2 h-36 w-full max-w-[280px]" />
        <ul className="relative flex flex-wrap justify-center gap-1.5 px-4 pb-5">
          {(['vital.hr', 'vital.spo2', 'vital.temp', 'vital.rhythm'] as const).map((k) => (
            <li key={k} className="rounded-full bg-white/[0.05] px-2.5 py-1 text-[11.5px] text-label ring-1 ring-line-strong">
              {t(k)}
            </li>
          ))}
        </ul>
      </div>
    </header>
  );
}
