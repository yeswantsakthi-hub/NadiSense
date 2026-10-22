import type { ReactNode } from 'react';
import { Tag, type Tone } from './Panel';

interface Props {
  label: string;
  value?: string;
  unit: string;
  tag: { text: string; tone: Tone };
  detail: ReactNode;
  footer: string;
  footerAside?: string;
  /** Border tone; only use 'alert' for elevated risk. */
  tone?: 'default' | 'signal' | 'alert';
}

const BORDER = {
  default: 'border-line',
  signal: 'border-signal/45',
  alert: 'border-alert/70',
};

/** One vital in the console grid: value, comparison line, and a status footer. */
export function VitalCard({ label, value, unit, tag, detail, footer, footerAside, tone = 'default' }: Props) {
  return (
    <article className={`flex min-w-0 flex-col rounded-[3px] border bg-panel p-3 [overflow-wrap:anywhere] ${BORDER[tone]}`}>
      <header className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
        <h3 className="text-[13px] font-semibold">{label}</h3>
        <Tag tone={tag.tone}>{tag.text}</Tag>
      </header>
      <p className="mt-3 flex items-baseline gap-1.5">
        <span className={`font-mono text-3xl font-semibold tabular-nums ${value ? '' : 'text-muted/60'}`}>
          {value ?? '––'}
        </span>
        <span className="text-xs text-muted">{unit}</span>
      </p>
      <p className="mt-1 text-xs text-label">{detail}</p>
      <div aria-hidden className="min-h-3 flex-1" />
      <footer className="flex items-center justify-between gap-2 border-t border-line pt-2 text-[11px] text-label">
        <span>{footer}</span>
        {footerAside && <span className="hidden font-mono tabular-nums text-muted sm:inline">{footerAside}</span>}
      </footer>
    </article>
  );
}
