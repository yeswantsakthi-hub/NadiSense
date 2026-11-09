import { useI18n } from '../i18n';
import { RingArt } from './RingArt';

/** Wordmark, ring artwork and tagline for the sign-in screen. */
export function Masthead(_props: { caption?: string }) {
  const { t } = useI18n();
  return (
    <header className="text-center">
      <p className="text-[15px] font-semibold tracking-tight">
        <span aria-hidden className="mr-2 inline-block size-2.5 rounded-full bg-signal shadow-[0_0_12px_var(--signal)]" />
        NadiSense
      </p>
      <RingArt className="mx-auto mt-3 h-36 w-full max-w-xs" />
      <h1 className="mt-1 text-[26px] leading-tight font-semibold tracking-tight">{t('app.tagline')}</h1>
    </header>
  );
}
