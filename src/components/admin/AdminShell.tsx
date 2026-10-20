import Link from 'next/link';
import type { ReactNode } from 'react';
import type { AdminVaultUser } from '@/lib/types';
import { can, ROLE_CAPABILITIES } from '@/lib/security/admin';
import { VortexMark } from '@/components/layout/Logo';
import { LogoutButton } from './LogoutButton';

const NAV = [
  ['/admin', 'Command', null],
  ['/admin/inventory', 'Inventory & Pricing', 'inventory'],
  ['/admin/deals', 'Flash Deals', 'deals'],
  ['/admin/foundry', 'Foundry Queue', 'foundry'],
  ['/admin/vault', 'Vault', 'vault'],
  ['/admin/audit', 'Audit Ledger', 'audit']
] as const;

export function AdminShell({ admin, active, children }: { admin: AdminVaultUser; active: string; children: ReactNode }) {
  return (
    <div className="min-h-svh">
      <header className="sticky top-0 z-40 border-b border-tungsten/40 bg-void/95 backdrop-blur">
        <div className="container-hud flex h-14 items-center gap-6">
          <Link href="/admin" className="flex items-center gap-2">
            <VortexMark size={22} />
            <span className="font-mono text-[0.65rem] tracking-[0.2em] text-tungsten">OVERSEER VAULT</span>
          </Link>
          <nav className="hidden flex-1 gap-1 overflow-x-auto md:flex" aria-label="Admin">
            {NAV.filter(([, , cap]) => !cap || can(admin, cap)).map(([href, label]) => (
              <Link key={href} href={href} className={`nav-link ${active === href ? 'is-active' : ''}`}>
                {label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-right font-mono text-[0.6rem] leading-tight sm:block">
              <span className="block text-primary">{admin.codename}</span>
              <span className="text-muted">{ROLE_CAPABILITIES[admin.role].label}</span>
            </span>
            <LogoutButton />
          </div>
        </div>
        <nav className="container-hud flex gap-1 overflow-x-auto pb-2 md:hidden" aria-label="Admin mobile">
          {NAV.filter(([, , cap]) => !cap || can(admin, cap)).map(([href, label]) => (
            <Link key={href} href={href} className={`btn-ghost size-sm shrink-0 ${active === href ? 'is-active' : ''}`}>
              {label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="container-hud py-8">{children}</main>
    </div>
  );
}
