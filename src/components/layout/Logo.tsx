export function VortexMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <path d="M2 2h20l8 8v20H10l-8-8V2z" stroke="#D4FF00" strokeWidth="1.5" />
      <path d="M9 9l7 14 7-14" stroke="#F3F5F8" strokeWidth="2.2" strokeLinecap="square" />
      <path d="M16 23v4" stroke="#D4FF00" strokeWidth="1.5" />
      <circle cx="16" cy="9" r="1.4" fill="#00F0FF" />
    </svg>
  );
}
