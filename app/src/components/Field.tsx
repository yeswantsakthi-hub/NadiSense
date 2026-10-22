import { useId, type InputHTMLAttributes, type ReactNode } from 'react';

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  label: string;
  value: string;
  onChange(value: string): void;
  hint?: string;
}

/** Labelled console-style text input. */
export function Field({ label, value, onChange, hint, className = '', ...input }: FieldProps) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="label mb-1 block">
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="h-11 w-full rounded-[3px] border border-line bg-bg px-3 text-[15px] text-fg placeholder:text-muted focus:border-signal focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-1"
        {...input}
      />
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-[11px] text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

/** Checkbox styled as a switch row, with a title and an explanation. */
export function Toggle({
  checked,
  onChange,
  title,
  hint,
  aside,
}: {
  checked: boolean;
  onChange(checked: boolean): void;
  title: string;
  hint: string;
  aside?: ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex items-start gap-3 py-2">
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-describedby={`${id}-hint`}
        className="peer sr-only"
      />
      <label
        htmlFor={id}
        aria-hidden
        className={`relative mt-0.5 h-6 w-11 shrink-0 cursor-pointer rounded-full border transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-select ${
          checked ? 'border-signal bg-signal' : 'border-line-strong bg-bg'
        }`}
      >
        <span
          className={`absolute top-0.5 size-[18px] rounded-full bg-fg transition-transform ${checked ? 'translate-x-[22px]' : 'translate-x-0.5'}`}
        />
      </label>
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="flex cursor-pointer items-center justify-between gap-2 font-semibold">
          {title}
          {aside}
        </label>
        <p id={`${id}-hint`} className="mt-0.5 text-xs text-label">
          {hint}
        </p>
      </div>
    </div>
  );
}
