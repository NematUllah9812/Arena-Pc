export function VortexMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <rect width="32" height="32" rx="8" fill="#2563EB" />
      <path d="M9 10l7 13 7-13" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="flex items-center gap-2.5">
      <VortexMark />
      <span className="text-[1.15rem] font-bold tracking-tight text-primary">
        Vortex<span className="text-volt">Labs</span>
      </span>
    </span>
  );
}
