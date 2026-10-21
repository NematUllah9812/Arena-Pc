import Link from 'next/link';
import { getRepo } from '@/lib/repo';
import { requireAdminPage, can } from '@/lib/security/admin';
import { STAGES } from '@/lib/engine/build-bay';
import { BUILD_BAY_STAGES } from '@/lib/types';
import { formatDateTime, money } from '@/lib/format';
import { AdminPanel, AdminShell } from '@/components/admin/AdminShell';
import { auditLabel } from '@/components/admin/audit-labels';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Dashboard' };

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
  const open = orders.filter((o) => o.current_stage !== 'DELIVERED');
  const byStage = Object.fromEntries(BUILD_BAY_STAGES.map((s) => [s, orders.filter((o) => o.current_stage === s).length]));
  const maxStage = Math.max(1, ...Object.values(byStage));
  const lowStock = products.filter((p) => p.is_active && p.stock_quantity - p.reserved_quantity <= 3).sort((a, b) => a.stock_quantity - a.reserved_quantity - (b.stock_quantity - b.reserved_quantity));
  const aged = products.filter((p) => p.days_in_inventory >= 90).length;
  const noPhotos = products.filter((p) => p.is_active && p.category !== 'INTERNAL_BRACE' && p.primary_image_url.startsWith('/media/cat-')).length;
  const openValue = open.reduce((s, o) => s + o.total_charged_cents, 0);

  const stats: [string, string | number, string?][] = [
    ['Open orders', open.length],
    ['Value of open orders', money(openValue)],
    ['Need a fit check', open.filter((o) => o.requires_tech_clearance_check).length, 'Tight-fit builds to check by hand'],
    ['Slow movers (90+ days)', can(admin, 'inventory') ? aged : '—']
  ];

  return (
    <AdminShell admin={admin} active="/admin" title={`Welcome back, ${admin.codename}`} description="Here’s what’s happening in the store today.">
      {denied ? <p className="mb-6 rounded-lg border border-[#fecaca] bg-[#fef2f2] px-4 py-2.5 text-sm text-conflict">Your role doesn&rsquo;t have access to “{denied}”.</p> : null}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map(([l, v, hint]) => (
          <div key={l} className="rounded-xl border border-hairline bg-white p-5">
            <p className="text-sm text-muted">{l}</p>
            <p className="tabular mt-1.5 text-2xl font-semibold text-primary">{v}</p>
            {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
          </div>
        ))}
      </div>

      {can(admin, 'inventory') && noPhotos > 0 ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#bfdbfe] bg-[#eff6ff] px-5 py-3.5 text-sm">
          <span className="text-primary">
            <strong className="font-semibold">{noPhotos} products</strong> are still using a generic category photo.
          </span>
          <Link href="/admin/inventory?photos=missing" className="font-medium text-volt hover:underline">
            Add photos
          </Link>
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <AdminPanel
          title="Orders by stage"
          action={
            can(admin, 'foundry') ? (
              <Link href="/admin/foundry" className="text-sm text-volt hover:underline">
                View all
              </Link>
            ) : null
          }
        >
          <ul className="flex flex-col gap-2.5">
            {BUILD_BAY_STAGES.map((s) => (
              <li key={s} className="grid grid-cols-[150px_1fr_28px] items-center gap-3 text-sm">
                <span className="truncate text-secondary">{STAGES[s].label}</span>
                <div className="h-2 overflow-hidden rounded-full bg-elevated">
                  <div className="h-full rounded-full bg-volt" style={{ width: `${(byStage[s] / maxStage) * 100}%` }} />
                </div>
                <span className="tabular text-right font-medium">{byStage[s]}</span>
              </li>
            ))}
          </ul>
        </AdminPanel>

        {can(admin, 'inventory') ? (
          <AdminPanel
            title="Low stock"
            flush
            action={
              <Link href="/admin/inventory" className="text-sm text-volt hover:underline">
                Manage products
              </Link>
            }
          >
            {lowStock.length ? (
              <ul className="divide-y divide-hairline text-sm">
                {lowStock.slice(0, 7).map((p) => {
                  const avail = p.stock_quantity - p.reserved_quantity;
                  return (
                    <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                      <span className="truncate text-primary">{p.name}</span>
                      <span className={`tabular shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${avail <= 0 ? 'bg-[#fef2f2] text-conflict' : 'bg-[#fffbeb] text-tolerance'}`}>
                        {avail <= 0 ? 'Out of stock' : `${avail} left`}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="p-5 text-sm text-verified">Everything is well stocked.</p>
            )}
          </AdminPanel>
        ) : null}

        {can(admin, 'deals') ? (
          <AdminPanel
            title="Active deals"
            flush
            action={
              <Link href="/admin/deals" className="text-sm text-volt hover:underline">
                Manage deals
              </Link>
            }
          >
            {deals.length ? (
              <ul className="divide-y divide-hairline text-sm">
                {deals.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                    <span className="truncate text-primary">{d.deal_title}</span>
                    <span className="tabular shrink-0 text-xs text-muted">
                      {d.claimed_count + d.reserved_claims} of {d.max_claims} claimed
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="p-5 text-sm text-muted">No deals running.</p>
            )}
          </AdminPanel>
        ) : null}

        {can(admin, 'audit') ? (
          <AdminPanel
            title="Recent activity"
            flush
            action={
              <Link href="/admin/audit" className="text-sm text-volt hover:underline">
                Full log
              </Link>
            }
          >
            <ul className="divide-y divide-hairline text-sm">
              {audit.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                  <span className="truncate">
                    <span className="text-primary">{auditLabel(a.action_type)}</span>
                    <span className="text-muted"> · {a.admin_codename ?? a.admin_id.slice(0, 8)}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted">{formatDateTime(a.executed_at)}</span>
                </li>
              ))}
            </ul>
          </AdminPanel>
        ) : null}
      </div>
    </AdminShell>
  );
}
