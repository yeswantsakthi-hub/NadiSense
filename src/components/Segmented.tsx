import { useId } from 'react';

interface Props<T extends string> {
  legend: string;
  value: T;
  options: { value: T; label: string }[];
  onChange(value: T): void;
}

/** Radio group styled as a segmented control; arrow keys work because these are real radios. */
export function Segmented<T extends string>({ legend, value, options, onChange }: Props<T>) {
  const name = useId();
  return (
    <fieldset>
      <legend className="label mb-2">{legend}</legend>
      <div className="flex gap-1 rounded-[3px] border border-line bg-bg p-1">
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <label
              key={o.value}
              className={`flex-1 cursor-pointer rounded-[2px] border px-2 py-2 text-center text-[13px] font-medium transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-1 has-[:focus-visible]:outline-select ${
                selected ? 'border-signal/50 bg-signal/10 text-signal' : 'border-transparent text-muted hover:text-fg'
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
