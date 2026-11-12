import { useId } from 'react';

interface Props<T extends string> {
  legend: string;
  /** Keep the legend for screen readers only (when a panel label already says it). */
  hideLegend?: boolean;
  value: T;
  options: { value: T; label: string }[];
  onChange(value: T): void;
}

/** Radio group styled as a segmented control; arrow keys work because these are real radios. */
export function Segmented<T extends string>({ legend, hideLegend, value, options, onChange }: Props<T>) {
  const name = useId();
  return (
    <fieldset className="min-w-0">
      <legend className={hideLegend ? 'sr-only' : 'label mb-2'}>{legend}</legend>
      <div className={`gap-1 rounded-xl border border-line bg-black/25 p-1 ${options.length > 4 ? 'grid grid-cols-3' : 'flex'}`}>
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <label
              key={o.value}
              className={`flex-1 cursor-pointer rounded-lg px-2 py-2 text-center text-[13px] font-medium transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-1 has-[:focus-visible]:outline-select ${
                selected ? 'bg-panel-3 text-fg' : 'text-label hover:text-fg'
              }`}
            >
              <input
                type="radio"
                name={name}
                value={o.value}
                checked={selected}
                onChange={() => onChange(o.value)}
                className="sr-only"
              />
              {o.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
