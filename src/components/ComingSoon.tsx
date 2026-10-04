import { Panel } from './Panel';

interface Props {
  title: string;
  /** Console-style empty state, e.g. "no session registered". */
  empty: string;
  children: string;
  accent?: 'signal' | 'turmeric';
}

/** Holding panel for screens that land in later build phases. */
export function ComingSoon({ title, empty, children, accent = 'signal' }: Props) {
  return (
    <div className="mx-auto max-w-3xl pt-2">
      <Panel
        label={title}
        labelClassName={accent === 'turmeric' ? '!text-turmeric' : ''}
        className={accent === 'turmeric' ? 'border-turmeric/25' : ''}
      >
        <p className="font-mono text-sm text-muted">{empty}</p>
        <p className="mt-2 max-w-prose text-sm text-label">{children}</p>
      </Panel>
    </div>
  );
}
