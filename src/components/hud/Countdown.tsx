'use client';
import { useEffect, useState } from 'react';

function split(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { h: Math.floor(s / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}
const pad = (n: number) => n.toString().padStart(2, '0');

/** Hydration-safe ticking countdown (renders placeholder until mounted). */
export function Countdown({ to, onElapsed, className = '' }: { to: string; onElapsed?: () => void; className?: string }) {
  const target = new Date(to).getTime();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n >= target) {
        clearInterval(t);
        onElapsed?.();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [target, onElapsed]);
  if (now == null) return <span className={`tabular ${className}`}>--:--:--</span>;
  const { h, m, s } = split(target - now);
  return (
    <span className={`tabular ${className}`} suppressHydrationWarning>
      {pad(h)}:{pad(m)}:{pad(s)}
    </span>
  );
}
