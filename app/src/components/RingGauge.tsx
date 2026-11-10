import { useId, type ReactNode } from 'react';

interface Props {
  /** 0–1, or null for an empty track. */
  value: number | null;
  /** CSS colour variable for the arc, e.g. "--signal". */
  color?: string;
  size?: number;
  stroke?: number;
  /** Degrees of the circle used by the track; the gap sits at the bottom. 360 = full circle. */
  sweep?: number;
  children?: ReactNode;
  label: string;
  className?: string;
}

/** Circular progress gauge with content in the middle. */
export function RingGauge({ value, color = '--signal', size = 120, stroke = 10, sweep = 360, children, label, className = '' }: Props) {
  const gradientId = useId();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const track = (c * sweep) / 360;
  const v = value === null ? 0 : Math.max(0, Math.min(1, value));
  // Start so that the gap is centred at the bottom.
  const rotate = 90 + (360 - sweep) / 2;

  return (
    <div
      role="img"
      aria-label={label}
      className={`relative grid place-items-center ${className}`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0" aria-hidden>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={`var(${color})`} stopOpacity="0.55" />
            <stop offset="1" stopColor={`var(${color})`} />
          </linearGradient>
        </defs>
        <g transform={`rotate(${rotate} ${size / 2} ${size / 2})`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--panel-2)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${track} ${c}`}
          />
          {value !== null && v > 0 && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={`url(#${gradientId})`}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${track * v} ${c}`}
              style={{ transition: 'stroke-dasharray 0.6s ease' }}
            />
          )}
        </g>
      </svg>
      <div className="relative flex flex-col items-center text-center">{children}</div>
    </div>
  );
}
