import Link from 'next/link';
import type { ReactNode } from 'react';
import type { AdminVaultUser } from '@/lib/types';
import { can, ROLE_CAPABILITIES } from '@/lib/security/admin';
import { VortexMark } from '@/components/layout/Logo';
import { BoxIcon, ExternalIcon, HomeIcon, ListIcon, ShieldIcon, TagIcon, WrenchIcon } from '@/components/ui/Icons';
import { LogoutButton } from './LogoutButton';

const NAV = [
  ['/admin', 'Dashboard', null, HomeIcon],
  ['/admin/inventory', 'Products', 'inventory', BoxIcon],
  ['/admin/deals', 'Deals', 'deals', TagIcon],
  ['/admin/foundry', 'Orders', 'foundry', WrenchIcon],
  ['/admin/vault', 'Team & security', 'vault', ShieldIcon],
  ['/admin/audit', 'Activity log', 'audit', ListIcon]
] as const;

export function AdminShell({
  admin,
  active,
  title,
  description,
  actions,
  children
}: {
  admin: AdminVaultUser;
  active: string;
  title?: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const items = NAV.filter(([, , cap]) => !cap || can(admin, cap));
  return (
    <div className="min-h-svh md:grid md:grid-cols-[232px_minmax(0,1fr)]">
      {/* Sidebar (desktop) */}
      <aside className="sticky top-0 hidden h-svh flex-col border-r border-hairline bg-white md:flex">
        <Link href="/admin" className="flex h-16 items-center gap-2.5 border-b border-hairline px-5">
          <VortexMark size={26} />
          <span className="text-[0.95rem] font-semibold">
            Vortex Labs <span className="font-normal text-muted">Admin</span>
          </span>
        </Link>
        <nav className="flex flex-1 flex-col gap-0.5 p-3" aria-label="Admin">
          {items.map(([href, label, , Icon]) => {
            const on = active === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={on ? 'page' : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${on ? 'bg-[#eff6ff] text-volt' : 'text-secondary hover:bg-chassis hover:text-primary'}`}
              >
                <Icon size={18} />
                {label}
              </Link>
            );
          })}
          <Link href="/" target="_blank" className="mt-2 flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted hover:bg-chassis hover:text-primary">
            <ExternalIcon size={18} />
            View store
          </Link>
        </nav>
        <div className="flex items-center gap-3 border-t border-hairline p-4">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-chassis text-sm font-semibold text-secondary">{admin.codename.slice(0, 1).toUpperCase()}</span>
          <span className="min-w-0 flex-1 text-sm leading-tight">
            <span className="block truncate font-medium">{admin.codename}</span>
            <span className="text-xs text-muted">{ROLE_CAPABILITIES[admin.role].label}</span>
          </span>
          <LogoutButton />
        </div>
      </aside>

      {/* Top bar (mobile) */}
      <header className="sticky top-0 z-40 border-b border-hairline bg-white md:hidden">
        <div className="flex h-14 items-center gap-3 px-4">
          <VortexMark size={24} />
          <span className="font-semibold">Admin</span>
          <span className="ml-auto truncate text-sm text-muted">{admin.codename}</span>
          <LogoutButton />
        </div>
        <nav className="no-scrollbar flex gap-1 overflow-x-auto px-3 pb-2" aria-label="Admin mobile">
          {items.map(([href, label]) => (
            <Link key={href} href={href} className={`chip shrink-0 ${active === href ? 'is-active' : ''}`}>
              {label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="min-w-0 px-4 py-6 md:px-8 md:py-8">
        <div className="mx-auto max-w-[1280px]">
          {title ? (
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-primary">{title}</h1>
                {description ? <p className="mt-1 max-w-3xl text-sm text-secondary">{description}</p> : null}
              </div>
              {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
            </div>
          ) : null}
          {children}
        </div>
      </main>
    </div>
  );
}

/** Small white panel used across admin pages. */
export function AdminPanel({ title, action, children, className = '', flush = false }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; flush?: boolean }) {
  return (
    <section className={`rounded-xl border border-hairline bg-white ${className}`}>
      {title ? (
        <div className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-3.5">
          <h2 className="text-sm font-semibold text-primary">{title}</h2>
          {action}
        </div>
      ) : null}
      <div className={flush ? '' : 'p-5'}>{children}</div>
    </section>
  );
}
