import { Panel, Tag } from './Panel';

interface Props {
  title: string;
  tag: string;
  /** Features this screen will hold, each with why the v1 ring can't measure it yet. */
  items: { name: string; why: string }[];
  footnote: string;
}

/** Placeholder for Stage 2 features the v1 ring can't measure. Shows no numbers, ever. */
export function ComingSoon({ title, tag, items, footnote }: Props) {
  return (
    <div className="mx-auto max-w-3xl space-y-3 pt-2">
      <h1 className="text-xl font-semibold">{title}</h1>
      {items.map((item) => (
        <Panel key={item.name} label={item.name} aside={<Tag tone="label">{tag}</Tag>}>
          <p className="text-sm text-label">{item.why}</p>
        </Panel>
      ))}
      <p className="text-xs text-muted">{footnote}</p>
    </div>
  );
}
