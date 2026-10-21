'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CloseIcon, MenuIcon } from '@/components/ui/Icons';

export const NAV = [
  { href: '/catalog', label: 'Shop Parts' },
  { href: '/syndicate', label: 'Prebuilt PCs' },
  { href: '/forge', label: 'PC Builder' },
  { href: '/deals', label: 'Deals' },
  { href: '/support', label: 'Support' }
];

const isActive = (path: string, href: string) => path === href || path.startsWith(href + '/');

export function NavLinks() {
  const path = usePathname();
  return (
    <nav className="hidden items-center gap-7 lg:flex" aria-label="Primary">
      {NAV.map((n) => (
        <Link key={n.href} href={n.href} className="nav-link" aria-current={isActive(path, n.href) ? 'page' : undefined}>
          {n.label}
        </Link>
      ))}
    </nav>
  );
}

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);
  return (
    <div className="lg:hidden">
      <button type="button" className="grid h-10 w-10 place-items-center rounded-lg text-secondary hover:bg-chassis" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} aria-controls="mobile-nav" onClick={() => setOpen((o) => !o)}>
        {open ? <CloseIcon /> : <MenuIcon />}
      </button>
      {open ? (
        <nav id="mobile-nav" className="fixed inset-x-0 top-[var(--header-h)] z-50 border-b border-hairline bg-white shadow-lg" aria-label="Mobile">
          {[...NAV, { href: '/telemetry', label: 'Track Order' }].map((n) => (
            <Link key={n.href} href={n.href} className={`block border-t border-hairline px-6 py-3.5 text-[0.95rem] font-medium ${isActive(path, n.href) ? 'text-volt' : 'text-primary'}`}>
              {n.label}
            </Link>
          ))}
        </nav>
      ) : null}
    </div>
  );
}
