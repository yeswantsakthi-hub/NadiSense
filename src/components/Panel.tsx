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

/** Raised graphite card with a small monospaced label. */
export function Panel({ label, aside, children, className = '', flush, labelClassName = '', as = 'section' }: Props) {
  const Tag = as;
  return (
    <Tag className={`surface rounded-2xl ${className}`}>
      <header className="flex min-h-11 items-center justify-between gap-3 px-4 pt-3.5 pb-2">
        <h2 className={`label ${labelClassName}`}>{label}</h2>
        {aside && <div className="flex items-center gap-3 text-[11px] text-muted">{aside}</div>}
      </header>
      <div className={flush ? '' : 'px-4 pb-4'}>{children}</div>
    </Tag>
  );
}

/** Small status pill. Alarms are filled and carry ⚠. */
export function Tag({ children, tone = 'muted' }: { children: ReactNode; tone?: Tone }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] font-medium tracking-[0.06em] whitespace-nowrap uppercase ${TONE_TAG[tone]}`}
    >
      {tone === 'alert' ? <span aria-hidden>⚠</span> : <span aria-hidden className="size-1.5 rounded-full bg-current" />}
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
  signal: 'bg-signal/12 text-signal ring-1 ring-signal/25',
  amber: 'bg-amber/12 text-amber ring-1 ring-amber/25',
  alert: 'bg-alert text-white',
  muted: 'bg-white/5 text-muted ring-1 ring-line-strong',
  label: 'bg-white/5 text-label ring-1 ring-line-strong',
  turmeric: 'bg-turmeric/12 text-turmeric ring-1 ring-turmeric/25',
};
