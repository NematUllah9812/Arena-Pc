'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { money } from '@/lib/format';
import type { IndexEntry } from './search.worker';
import { playClick } from '@/components/layout/feedback';

export function SearchPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<IndexEntry[]>([]);
  const [active, setActive] = useState(0);
  const [ready, setReady] = useState(false);
  const worker = useRef<Worker | null>(null);
  const seq = useRef(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const boot = useCallback(async () => {
    if (worker.current) return;
    const w = new Worker(new URL('./search.worker.ts', import.meta.url), { type: 'module' });
    worker.current = w;
    w.onmessage = (e) => {
      if (e.data.type === 'ready') setReady(true);
      if (e.data.type === 'results' && e.data.seq === seq.current) {
        setResults(e.data.results);
        setActive(0);
      }
    };
    const res = await fetch('/api/catalog/index');
    const data = (await res.json()) as { entries: IndexEntry[] };
    w.postMessage({ type: 'index', entries: data.entries });
  }, []);

  const show = useCallback(() => {
    setOpen(true);
    void boot();
  }, [boot]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        show();
      }
    };
    const onOpen = () => show();
    window.addEventListener('keydown', onKey);
    window.addEventListener('vortex:search', onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('vortex:search', onOpen);
      worker.current?.terminate();
    };
  }, [show]);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      setTimeout(() => input.current?.focus(), 10);
    } else if (!open && d.open) d.close();
  }, [open]);

  useEffect(() => {
    if (!worker.current || !ready) return;
    seq.current++;
    worker.current.postMessage({ type: 'query', q, seq: seq.current });
  }, [q, ready]);

  const go = (en: IndexEntry) => {
    playClick('thock');
    setOpen(false);
    router.push(`/product/${en.slug}`);
  };

  return (
    <dialog ref={dialog} className="hud-dialog" onClose={() => setOpen(false)} onClick={(e) => e.target === dialog.current && setOpen(false)} aria-label="Search the catalog">
      <div className="hud-panel chamfer reticle">
        <div className="flex items-center gap-3 border-b border-hairline px-4">
          <span className="font-mono text-xs text-volt">&gt;_</span>
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((a) => Math.min(results.length - 1, a + 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((a) => Math.max(0, a - 1));
              } else if (e.key === 'Enter') {
                if (results[active]) go(results[active]);
                else if (q.trim()) {
                  setOpen(false);
                  router.push(`/catalog?q=${encodeURIComponent(q.trim())}`);
                }
              }
            }}
            placeholder="Search 4090, AM5, DDR5-6000, 360mm AIO…"
            className="w-full bg-transparent py-4 font-mono text-sm text-primary outline-none placeholder:text-muted"
            aria-label="Search query"
          />
          <kbd className="hud-label">ESC</kbd>
        </div>
        <ul className="max-h-[55vh] overflow-y-auto py-2" role="listbox">
          {!ready && <li className="px-4 py-3 font-mono text-xs text-muted">Indexing catalog in Web Worker…</li>}
          {ready && q && results.length === 0 && (
            <li className="px-4 py-3 font-mono text-xs text-muted">
              No direct hits. Press Enter for full-text search across specs.
            </li>
          )}
          {results.map((r, i) => (
            <li key={r.id} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => go(r)}
                className={`flex w-full items-center gap-4 px-4 py-2.5 text-left ${i === active ? 'bg-module-hover' : ''}`}
              >
                <span className="hud-label w-10 shrink-0">{r.c.slice(0, 3)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-primary">{r.n}</span>
                  <span className="block font-mono text-[0.65rem] text-muted">{r.s}</span>
                </span>
                <span className="tabular text-sm text-volt">{money(r.p)}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between border-t border-hairline px-4 py-2">
          <span className="hud-label">↑↓ navigate · ↵ open</span>
          <Link href="/catalog" className="hud-label hover:text-volt" onClick={() => setOpen(false)}>
            Full catalog →
          </Link>
        </div>
      </div>
    </dialog>
  );
}

export function SearchButton({ className = '' }: { className?: string }) {
  return (
    <button type="button" onClick={() => window.dispatchEvent(new Event('vortex:search'))} className={`btn-ghost size-sm ${className}`} aria-label="Search (Ctrl+K)">
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
        <circle cx="7" cy="7" r="5" />
        <path d="M11 11l4 4" />
      </svg>
      <span className="hidden lg:inline">Search</span>
      <kbd className="hidden text-muted lg:inline">⌘K</kbd>
    </button>
  );
}
