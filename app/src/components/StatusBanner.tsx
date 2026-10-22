import type { ReactNode } from 'react';
import { useI18n } from '../i18n';
import { TONE_TEXT, type Tone } from './Panel';

interface Props {
  /** The big status word, e.g. LIVE or MOVEMENT. */
  status: string;
  tone: Tone;
  title: string;
  subtitle: string;
  lead: string;
  points: string[];
  kpis: { label: string; value: ReactNode; tone?: Tone }[];
}

/**
 * Top-of-console status: one big word, what it means, what to do, and key figures.
 * On phones it collapses to a compact strip so the live waveform stays above the fold.
 */
export function StatusBanner({ status, tone, title, subtitle, lead, points, kpis }: Props) {
  const { t } = useI18n();
  const figures = (className: string) => (
    <dl className={className}>
      {kpis.map((k) => (
        <div key={k.label}>
          <dt className="label">{k.label}</dt>
          <dd className={`mt-0.5 font-mono text-base font-semibold tabular-nums sm:mt-1 sm:text-xl ${TONE_TEXT[k.tone ?? 'signal']}`}>
            {k.value}
          </dd>
        </div>
      ))}
    </dl>
  );

  return (
    <section
      aria-label={t('status.aria')}
      aria-live="polite"
      className="grid gap-x-8 gap-y-3 rounded-[3px] border border-line bg-panel p-3 sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-y-4 sm:p-4 lg:grid-cols-[minmax(170px,auto)_minmax(0,1fr)_auto] lg:items-center lg:px-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className={`flex items-center gap-2.5 text-2xl font-semibold tracking-tight sm:text-3xl lg:text-4xl ${TONE_TEXT[tone]}`}>
          <span aria-hidden className="live-dot size-2.5 shrink-0 rounded-full bg-current" />
          {status}
        </p>
        {figures('flex gap-5 text-right sm:hidden')}
      </div>

      <div className="min-w-0">
        <h2 className="text-sm font-semibold sm:text-base">{title}</h2>
        <p className="mt-0.5 text-xs text-label">{subtitle}</p>
        <p className="mt-2 text-sm font-semibold sm:mt-3">{lead}</p>
        <ul className="mt-1.5 hidden space-y-1 text-[13px] text-muted sm:block">
          {points.map((p) => (
            <li key={p} className="flex gap-2">
              <span aria-hidden className={`mt-[7px] size-1 shrink-0 rounded-full bg-current ${TONE_TEXT[tone]}`} />
              {p}
            </li>
          ))}
        </ul>
      </div>

      {figures('hidden gap-8 border-t border-line pt-3 sm:col-span-2 sm:flex lg:col-span-1 lg:border-0 lg:pt-0')}
    </section>
  );
}
