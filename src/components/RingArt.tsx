/** The NadiSense ring as a product shot: brushed-metal band, sensor window, soft floor shadow. */
export function RingArt({ active = false, className = '' }: { active?: boolean; className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 200 140" className={className}>
      <defs>
        <linearGradient id="ring-metal" x1="0" x2="1">
          <stop offset="0" stopColor="#8a93a3" />
          <stop offset="0.35" stopColor="#eef1f5" />
          <stop offset="0.6" stopColor="#c3c9d4" />
          <stop offset="1" stopColor="#6b7384" />
        </linearGradient>
        <linearGradient id="ring-inner" x1="0" x2="1">
          <stop offset="0" stopColor="#3b4252" />
          <stop offset="0.5" stopColor="#5b6475" />
          <stop offset="1" stopColor="#2b3140" />
        </linearGradient>
      </defs>
      <ellipse cx="100" cy="122" rx="62" ry="7" fill="#0f172a" opacity="0.08" />
      {/* Back of the band (inside surface) */}
      <path d="M42 66 A58 26 0 0 1 158 66" fill="none" stroke="url(#ring-inner)" strokeWidth="13" />
      {/* Front of the band */}
      <path d="M42 66 A58 26 0 0 0 158 66" fill="none" stroke="url(#ring-metal)" strokeWidth="15" strokeLinecap="round" />
      <path d="M46 70 A55 22 0 0 0 154 70" fill="none" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="1.5" />
      {/* Optical sensor window */}
      <rect x="90" y="86" width="20" height="7" rx="3.5" fill="#1b2130" />
      <circle cx="96" cy="89.5" r="1.8" fill="#e5484d" className={active ? 'breathe' : ''} />
      <circle cx="104" cy="89.5" r="1.8" fill="#2741c9" className={active ? 'breathe' : ''} />
    </svg>
  );
}
