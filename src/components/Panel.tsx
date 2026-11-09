import type { ReactNode } from 'react';

interface Props {
  label: ReactNode;
  /** Small content on the right of the label row (count, tag, legend). */
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Remove body padding, e.g. for edge-to-edge charts. */
  flush?: boolean;
  labelClassName?: string;
  as?: 'section' | 'div';
}

/** Charcoal console panel with a small uppercase olive label. */
export function Panel({ label, aside, children, className = '', flush, labelClassName = '', as = 'section' }: Props) {
  const Tag = as;
  return (
    <Tag className={`rounded-[3px] border border-line bg-panel ${className}`}>
      <header className="flex min-h-9 items-center justify-between gap-3 px-3.5 pt-2.5 pb-1.5">
        <h2 className={`label ${labelClassName}`}>{label}</h2>
        {aside && <div className="flex items-center gap-3 text-[11px] text-muted">{aside}</div>}
      </header>
      <div className={flush ? '' : 'px-3.5 pb-3.5'}>{children}</div>
    </Tag>
  );
}

/** Outlined uppercase status tag, like EMERGENCY / ADVISORY. Alarms also carry ⚠. */
export function Tag({ children, tone = 'muted' }: { children: ReactNode; tone?: Tone }) {
  return (
    <span
      className={`shrink-0 rounded-[2px] border px-1.5 py-px text-[10px] font-medium tracking-[0.06em] whitespace-nowrap uppercase ${TONE_TAG[tone]}`}
    >
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
  signal: 'border-signal/60 text-signal',
  amber: 'border-amber/60 text-amber',
  alert: 'border-alert bg-alert/15 text-alert',
  muted: 'border-line-strong text-muted',
  label: 'border-label/50 text-label',
  turmeric: 'border-turmeric/60 text-turmeric',
};
