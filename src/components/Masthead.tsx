import { useI18n } from '../i18n';

/** One idealised pulse beat, repeated, for the masthead trace. */
const TRACE =
  'M0 70 L40 70 C52 70 54 22 62 22 C70 22 72 54 80 56 C84 57 86 48 92 48 C100 48 104 66 120 70 ' +
  'L160 70 C172 70 174 22 182 22 C190 22 192 54 200 56 C204 57 206 48 212 48 C220 48 224 66 240 70 ' +
  'L280 70 C292 70 294 22 302 22 C310 22 312 54 320 56 C324 57 326 48 332 48 C340 48 344 66 360 70 L400 70';

/** Wordmark, tagline and a decorative pulse trace for the sign-in and connect screens. */
export function Masthead({ caption }: { caption: string }) {
  const { t } = useI18n();
  return (
    <>
      <header className="text-center">
        <h1 className="keep-tracking font-mono text-2xl font-semibold tracking-[0.42em] pl-[0.42em]">NADISENSE</h1>
        <p className="mt-2 text-sm text-label">{t('app.tagline')}</p>
      </header>

      <figure aria-hidden className="relative mt-6 overflow-hidden rounded-[3px] border border-line bg-panel">
        <svg viewBox="0 0 400 100" className="block h-24 w-full" preserveAspectRatio="none">
          <defs>
            <pattern id="grid-minor" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M20 0V20H0" fill="none" stroke="var(--grid-strong)" strokeWidth="1" />
            </pattern>
            <linearGradient id="fade" x1="0" x2="1">
              <stop offset="0" stopColor="var(--signal)" stopOpacity="0.15" />
              <stop offset="1" stopColor="var(--signal)" stopOpacity="1" />
            </linearGradient>
          </defs>
          <rect width="400" height="100" fill="url(#grid-minor)" />
          <path d={TRACE} fill="none" stroke="url(#fade)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </svg>
        <figcaption className="flex justify-between border-t border-line px-3 py-1.5 font-mono text-[10px] text-muted">
          <span>PPG · IR</span>
          <span>{caption}</span>
        </figcaption>
      </figure>
    </>
  );
}
