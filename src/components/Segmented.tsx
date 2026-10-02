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
      <legend className="mb-2 text-xs font-semibold tracking-[0.08em] text-muted uppercase">{legend}</legend>
      <div className="flex rounded-lg border border-line bg-surface p-1">
        {options.map((o) => (
          <label
            key={o.value}
            className={`flex-1 cursor-pointer rounded-md px-2 py-2 text-center text-sm font-medium has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-1 has-[:focus-visible]:outline-signal ${
              o.value === value ? 'bg-ink text-paper' : 'text-muted hover:text-ink'
            }`}
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={o.value === value}
              onChange={() => onChange(o.value)}
              className="sr-only"
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
