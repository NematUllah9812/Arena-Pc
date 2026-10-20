'use client';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { playClick } from './feedback';

type Tone = 'info' | 'error' | 'warn';
interface Toast {
  id: number;
  title: string;
  body?: string;
  tone: Tone;
}

const Ctx = createContext<{ push: (t: Omit<Toast, 'id' | 'tone'> & { tone?: Tone }) => void }>({ push: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((t: Omit<Toast, 'id' | 'tone'> & { tone?: Tone }) => {
    const id = Date.now() + Math.random();
    const toast = { ...t, id, tone: t.tone ?? 'info' };
    playClick(toast.tone === 'error' ? 'error' : 'confirm');
    setToasts((prev) => [...prev.slice(-3), toast]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 5200);
  }, []);
  const value = useMemo(() => ({ push }), [push]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 bottom-4 z-[200] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast hud-glass-panel pointer-events-auto border border-hairline px-4 py-3 ${t.tone !== 'info' ? `tone-${t.tone}` : ''}`}>
            <p className="font-mono text-[0.7rem] tracking-[0.14em] text-primary uppercase">{t.title}</p>
            {t.body ? <p className="mt-1 text-xs leading-relaxed text-secondary">{t.body}</p> : null}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
