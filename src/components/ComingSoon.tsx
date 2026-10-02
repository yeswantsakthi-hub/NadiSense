interface Props {
  title: string;
  children: string;
  accent?: 'signal' | 'turmeric';
}

/** Holding page for screens that land in later build phases. */
export function ComingSoon({ title, children, accent = 'signal' }: Props) {
  return (
    <div className="px-4 pt-5">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <div className={`mt-6 border-l-2 pl-4 ${accent === 'turmeric' ? 'border-turmeric' : 'border-signal'}`}>
        <p className="text-muted">{children}</p>
      </div>
    </div>
  );
}
