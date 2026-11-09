import { useI18n } from '../i18n';
import { RingArt } from './RingArt';

/** Brand band for the sign-in screen: wordmark, tagline, product shot on an overlapping card. */
export function Masthead(_props: { caption?: string }) {
  const { t } = useI18n();
  return (
    <header>
      <div className="-mx-4 bg-signal px-5 pt-5 pb-16 text-brand-ink">
        <p className="flex items-center gap-2 text-[17px] font-bold">
          <svg aria-hidden viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 13h4l2-6 3.5 11 2.5-8 1.5 3H22" />
          </svg>
          NadiSense
        </p>
        <h1 className="mt-5 text-[24px] leading-tight font-bold">{t('app.tagline')}</h1>
      </div>
      <div className="-mt-10 rounded-2xl border border-line bg-panel py-2 shadow-[0_4px_16px_rgba(16,24,40,0.08)]">
        <RingArt className="mx-auto h-28 w-full max-w-[240px]" />
      </div>
    </header>
  );
}
