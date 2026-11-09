import type { ReactNode } from 'react';

interface Props {
  label: ReactNode;
  /** Small content on the right of the label row (count, tag). */
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Remove body padding, e.g. for edge-to-edge canvases. */
  flush?: boolean;
  labelClassName?: string;
  as?: 'section' | 'div';
}

/** Soft raised card with a quiet label. */
export function Panel({ label, aside, children, className = '', flush, labelClassName = '', as = 'section' }: Props) {
  const Tag = as;
  return (
    <Tag className={`rounded-3xl border border-line bg-panel ${className}`}>
      <header className="flex min-h-11 items-center justify-between gap-3 px-5 pt-4 pb-2">
        <h2 className={`label ${labelClassName}`}>{label}</h2>
        {aside && <div className="flex items-center gap-3 text-xs text-muted">{aside}</div>}
      </header>
      <div className={flush ? '' : 'px-5 pb-5'}>{children}</div>
    </Tag>
  );
}

/** Small pill; tone "alert" is a filled badge with ⚠ for screening flags. */
export function Tag({ children, tone = 'muted' }: { children: ReactNode; tone?: Tone }) {
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap ${TONE_TAG[tone]}`}>
      {/* Flags share colours with the metrics, so they also carry a symbol, not just colour. */}
      {tone === 'alert' && <span aria-hidden>⚠ </span>}
      {children}
    </span>
  );
}

export type Tone = 'signal' | 'amber' | 'alert' | 'muted' | 'label' | 'turmeric';

export const TONE_TEXT: Record<Tone, string> = {
  signal: 'text-signal',
  amber: 'text-amber',
  alert: 'text-alert',
  muted: 'text-muted',
  label: 'text-label',
  turmeric: 'text-turmeric',
};

const TONE_TAG: Record<Tone, string> = {
  signal: 'bg-signal/15 text-signal',
  amber: 'bg-amber/15 text-amber',
  alert: 'bg-alert text-bg font-semibold',
  muted: 'bg-panel-2 text-muted',
  label: 'bg-panel-2 text-label',
  turmeric: 'bg-turmeric/15 text-turmeric',
};
