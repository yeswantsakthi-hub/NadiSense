import type { ReactNode } from 'react';
import { useI18n } from '../i18n';
import { RingArt } from './RingArt';

/** Console-style wordmark bar used before the main app (sign-in, pairing). */
export function Wordmark() {
  return (
    <p className="keep-tracking border-b border-line py-3 text-center text-[13px] font-medium tracking-[0.32em]">NADISENSE</p>
  );
}

/** Top of the sign-in and pairing screens: wordmark, title block, product shot in a panel. */
export function Masthead({ title, subtitle, active }: { title?: ReactNode; subtitle?: ReactNode; active?: boolean }) {
  const { t } = useI18n();
  return (
    <header>
      <div className="-mx-4">
        <Wordmark />
      </div>
      <div className="mt-5 rounded-[3px] border border-line bg-panel">
        <div className="px-3.5 pt-3.5">
          <h1 className="text-[22px] leading-tight font-medium">{title ?? t('app.tagline')}</h1>
          {subtitle && <p className="mt-1 text-[12px] text-label">{subtitle}</p>}
        </div>
        <div className="mx-3.5 mt-3 mb-3.5 rounded-[2px] bg-panel-2 py-2">
          <RingArt active={active} className="mx-auto h-28 w-full max-w-[240px]" />
        </div>
      </div>
    </header>
  );
}
