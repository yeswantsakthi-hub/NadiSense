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
 * Top of the sign-in and pairing screens: brand bar, a large headline, the ring, and one line
 * naming the four things v1 measures. Plain page, no card.
 */
export function Masthead({ title, subtitle, active }: { title?: ReactNode; subtitle?: ReactNode; active?: boolean }) {
  const { t } = useI18n();
  return (
    <header>
      <BrandBar />
      <div className="mt-4">
        <h1 className="text-[30px] leading-[1.1] font-semibold tracking-[-0.02em] text-balance">{title ?? t('app.tagline')}</h1>
        {subtitle && <p className="mt-2 text-[15px] text-label">{subtitle}</p>}
        <RingArt active={active} className="mx-auto mt-3 h-36 w-full max-w-[280px]" />
        <p className="border-y border-line py-2.5 text-center text-[13px] text-label">
          {(['vital.hr', 'vital.spo2', 'vital.temp', 'vital.rhythm'] as const).map((k) => t(k)).join('  ·  ')}
        </p>
      </div>
    </header>
  );
}
