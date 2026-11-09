/** The NadiSense ring, drawn as a glowing band seen at an angle. Decorative. */
export function RingArt({ active = false, className = '' }: { active?: boolean; className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 200 140" className={className}>
      <defs>
        <radialGradient id="ring-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="var(--signal)" stopOpacity="0.35" />
          <stop offset="1" stopColor="var(--signal)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ring-band" x1="0" x2="1">
          <stop offset="0" stopColor="#3a404d" />
          <stop offset="0.5" stopColor="#d9dee7" />
          <stop offset="1" stopColor="#3a404d" />
        </linearGradient>
      </defs>
      <ellipse cx="100" cy="72" rx="96" ry="64" fill="url(#ring-glow)" className={active ? 'breathe' : ''} style={{ transformOrigin: '100px 72px' }} />
      <ellipse cx="100" cy="70" rx="58" ry="26" fill="none" stroke="url(#ring-band)" strokeWidth="12" />
      <ellipse cx="100" cy="70" rx="58" ry="26" fill="none" stroke="#0b0d12" strokeWidth="2" strokeOpacity="0.6" />
      {/* Optical window glowing on the inner side. */}
      <ellipse cx="100" cy="95" rx="9" ry="3.5" fill="var(--signal)" className={active ? 'live-dot' : ''} />
    </svg>
  );
}
