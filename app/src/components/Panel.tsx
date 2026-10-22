import type { ReactNode } from 'react';

interface Props {
  label: ReactNode;
  /** Small content on the right of the label row (legend, count, tag). */
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Remove body padding, e.g. for edge-to-edge canvases. */
  flush?: boolean;
  labelClassName?: string;
  as?: 'section' | 'div';
}

/** Hairline-bordered console panel with a small uppercase label. */
export function Panel({ label, aside, children, className = '', flush, labelClassName = '', as = 'section' }: Props) {
  const Tag = as;
  return (
    <Tag className={`rounded-[3px] border border-line bg-panel ${className}`}>
      <header className="flex min-h-10 items-center justify-between gap-3 px-3 pt-2.5 pb-1.5">
        <h2 className={`label ${labelClassName}`}>{label}</h2>
        {aside && <div className="flex items-center gap-3 text-[11px] text-muted">{aside}</div>}
      </header>
      <div className={flush ? '' : 'px-3 pb-3'}>{children}</div>
    </Tag>
  );
}

/** Outlined status tag, like EMERGENCY / ADVISORY in an ops console. */
export function Tag({ children, tone = 'muted' }: { children: ReactNode; tone?: Tone }) {
  return (
    <span
      className={`shrink-0 rounded-[2px] border px-1.5 py-px text-[10px] font-semibold tracking-[0.08em] whitespace-nowrap uppercase ${TONE_TAG[tone]}`}
    >
      {/* Brand red is everywhere, so real warnings also carry a symbol, not just colour. */}
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
  signal: 'border-signal/50 text-signal bg-signal/10',
  amber: 'border-amber/50 text-amber bg-amber/10',
  alert: 'border-alert bg-alert text-black',
  muted: 'border-line-strong text-muted',
  label: 'border-label/40 text-label',
  turmeric: 'border-turmeric/50 text-turmeric bg-turmeric/10',
};
