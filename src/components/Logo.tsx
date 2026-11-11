/**
 * NadiSense mark: the ring seen from the side, with the pulse running through it, plus the
 * wordmark. The three dots on the left are the three fingers of Nadi Pariksha.
 */
export function LogoMark({ className = 'size-8' }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 40 40" className={className}>
      <defs>
        <linearGradient id="nadi-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffc27a" />
          <stop offset="1" stopColor="#ff8a2a" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill="#14171c" />
      <rect x="0.5" y="0.5" width="39" height="39" rx="10.5" fill="none" stroke="rgba(255,255,255,0.08)" />
      <circle cx="21" cy="20" r="10.5" fill="none" stroke="url(#nadi-mark)" strokeWidth="2.6" />
      <path
        d="M5.5 20h7.2l2.2-5 3.4 10 2.6-7.5 1.6 2.5H34.5"
        fill="none"
        stroke="#fff"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark className="size-8" />
      <span className="text-[17px] leading-none font-semibold tracking-[-0.01em] text-fg">
        Nadi<span className="text-brand">Sense</span>
      </span>
    </span>
  );
}
