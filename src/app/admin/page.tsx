import Link from 'next/link';
import { getRepo } from '@/lib/repo';
import { requireAdminPage, can } from '@/lib/security/admin';
import { STAGES } from '@/lib/engine/build-bay';
import { BUILD_BAY_STAGES } from '@/lib/types';
import { formatDateTime, money } from '@/lib/format';
import { AdminShell } from '@/components/admin/AdminShell';
import { HudCard } from '@/components/hud/HudCard';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Command' };

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const admin = await requireAdminPage();
  const { denied } = await searchParams;
  const repo = getRepo();
  const [orders, products, deals, audit] = await Promise.all([
    repo.listOrders({ limit: 200 }),
    can(admin, 'inventory') ? repo.listProductsInternal() : Promise.resolve([]),
    can(admin, 'deals') ? repo.listFlashDeals({ includeUpcoming: true }) : Promise.resolve([]),
    can(admin, 'audit') ? repo.listAuditLogs(8) : Promise.resolve([])
  ]);
  const byStage = Object.fromEntries(BUILD_BAY_STAGES.map((s) => [s, orders.filter((o) => o.current_stage === s).length]));
  const lowStock = products.filter((p) => p.is_active && p.stock_quantity - p.reserved_quantity <= 3).sort((a, b) => a.stock_quantity - b.stock_quantity);
  const aged = products.filter((p) => p.days_in_inventory >= 90).length;
  const openValue = orders.filter((o) => o.current_stage !== 'DELIVERED').reduce((s, o) => s + o.total_charged_cents, 0);

  return (
    <AdminShell admin={admin} active="/admin">
      {denied ? <p className="mb-6 border-l-2 border-conflict bg-conflict/5 px-4 py-2 font-mono text-xs text-conflict">Capability “{denied}” is not granted to your role.</p> : null}
      <h1 className="hud-title mb-6 text-3xl">Command</h1>
      <div className="grid grid-cols-2 gap-px border border-hairline bg-hairline md:grid-cols-4">
        {[
          ['Open orders', orders.filter((o) => o.current_stage !== 'DELIVERED').length],
          ['Open order value', money(openValue)],
          ['Tech clearance checks', orders.filter((o) => o.requires_tech_clearance_check && o.current_stage !== 'DELIVERED').length],
          ['Aged SKUs (90d+)', can(admin, 'inventory') ? aged : '—']
        ].map(([l, v]) => (
          <div key={String(l)} className="bg-chassis p-4">
            <p className="hud-label">{l}</p>
            <p className="tabular mt-1 text-2xl">{v}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <HudCard innerClassName="p-5">
          <div className="mb-4 flex items-center justify-between">
            <span className="hud-eyebrow">Build Bay load</span>
            {can(admin, 'foundry') ? (
              <Link href="/admin/foundry" className="hud-label hover:text-volt">
                Queue →
              </Link>
            ) : null}
          </div>
          <ul className="flex flex-col gap-2">
            {BUILD_BAY_STAGES.map((s) => (
              <li key={s} className="grid grid-cols-[140px_1fr_32px] items-center gap-3">
                <span className="font-mono text-[0.65rem] text-secondary">{STAGES[s].short}</span>
                <div className="h-1.5 bg-elevated">
                  <div className="h-full bg-volt" style={{ width: `${Math.min(100, (byStage[s] / Math.max(1, orders.length)) * 100)}%` }} />
                </div>
                <span className="tabular text-right font-mono text-xs">{byStage[s]}</span>
              </li>
            ))}
          </ul>
        </HudCard>

        {can(admin, 'inventory') ? (
          <HudCard innerClassName="p-5">
            <div className="mb-4 flex items-center justify-between">
              <span className="hud-eyebrow">Low stock</span>
              <Link href="/admin/inventory" className="hud-label hover:text-volt">
                Inventory →
              </Link>
            </div>
            {lowStock.length ? (
              <ul className="flex flex-col gap-1.5 text-sm">
                {lowStock.slice(0, 8).map((p) => (
                  <li key={p.id} className="flex justify-between gap-3">
                    <span className="truncate text-secondary">{p.name}</span>
                    <span className={`tabular font-mono text-xs ${p.stock_quantity - p.reserved_quantity <= 0 ? 'text-conflict' : 'text-tolerance'}`}>
                      {p.stock_quantity - p.reserved_quantity} avail · BIN {p.warehouse_bin}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-verified">All active SKUs above threshold.</p>
            )}
          </HudCard>
        ) : null}

        {can(admin, 'deals') ? (
          <HudCard innerClassName="p-5">
            <span className="hud-eyebrow">Flash deals</span>
            <ul className="mt-4 flex flex-col gap-1.5 text-sm">
              {deals.map((d) => (
                <li key={d.id} className="flex justify-between gap-3">
                  <span className="truncate text-secondary">{d.deal_title}</span>
                  <span className="tabular font-mono text-xs">
                    {d.claimed_count}+{d.reserved_claims}/{d.max_claims}
                  </span>
                </li>
              ))}
            </ul>
          </HudCard>
        ) : null}

        {can(admin, 'audit') ? (
          <HudCard innerClassName="p-5">
            <div className="mb-4 flex items-center justify-between">
              <span className="hud-eyebrow">Recent audit</span>
              <Link href="/admin/audit" className="hud-label hover:text-volt">
                Ledger →
              </Link>
            </div>
            <ul className="flex flex-col gap-1.5 font-mono text-[0.68rem]">
              {audit.map((a) => (
                <li key={a.id} className="flex justify-between gap-3">
                  <span className="truncate">
                    <span className="text-tungsten">{a.action_type}</span> · {a.admin_codename ?? a.admin_id.slice(0, 8)}
                  </span>
                  <span className="shrink-0 text-muted">{formatDateTime(a.executed_at)}</span>
                </li>
              ))}
            </ul>
          </HudCard>
        ) : null}
      </div>
    </AdminShell>
  );
}
