'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

export const NAV = [
  { href: '/catalog', label: 'Catalog' },
  { href: '/forge', label: 'Rig Forge' },
  { href: '/syndicate', label: 'Syndicate Rigs' },
  { href: '/deals', label: 'Flash Deals' },
  { href: '/telemetry', label: 'Telemetry' },
  { href: '/support', label: 'Support' }
];

export function NavLinks() {
  const path = usePathname();
  return (
    <nav className="hidden items-center gap-7 md:flex" aria-label="Primary">
      {NAV.map((n) => (
        <Link key={n.href} href={n.href} className="nav-link" aria-current={path === n.href || path.startsWith(n.href + '/') ? 'page' : undefined}>
          {n.label}
        </Link>
      ))}
    </nav>
  );
}

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  return (
    <div className="md:hidden">
      <button type="button" className="btn-ghost size-sm" aria-expanded={open} aria-controls="mobile-nav" onClick={() => setOpen((o) => !o)}>
        {open ? 'Close' : 'Menu'}
      </button>
      {open ? (
        <nav id="mobile-nav" className="fixed inset-x-0 top-[var(--header-h)] z-50 border-b border-hairline bg-chassis" aria-label="Mobile">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className={`block border-t border-hairline px-6 py-4 font-mono text-xs tracking-[0.16em] uppercase ${path.startsWith(n.href) ? 'text-volt' : 'text-secondary'}`}>
              {n.label}
            </Link>
          ))}
        </nav>
      ) : null}
    </div>
  );
}
