import Link from 'next/link';
import { getRepo } from '@/lib/repo';
import { requireAdminPage } from '@/lib/security/admin';
import { STAGES } from '@/lib/engine/build-bay';
import { formatDate, money } from '@/lib/format';
import { AdminShell } from '@/components/admin/AdminShell';
import { TierBadge } from '@/components/hud/Badges';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Orders' };

export default async function FoundryQueue() {
  const admin = await requireAdminPage('foundry');
  const orders = await getRepo().listOrders({ limit: 200 });
  return (
    <AdminShell admin={admin} active="/admin/foundry" title="Orders" description="Open an order to log progress, upload test results and add tracking.">
      <div className="overflow-x-auto rounded-xl border border-hairline bg-white">
        <table className="data-grid min-w-[860px]">
          <thead>
            <tr>
              <th>Order</th>
              <th>Type</th>
              <th>Stage</th>
              <th>Compatibility</th>
              <th>Technician</th>
              <th>Ship by</th>
              <th className="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td>
                  <Link href={`/admin/foundry/${o.order_number}`} className="tabular font-medium text-volt hover:underline">
                    {o.order_number}
                  </Link>
                </td>
                <td className="text-secondary">{o.fulfillment_type === 'PRO_BUILT_FOUNDRY_RIG' ? 'Built by us' : 'Parts only'}</td>
                <td>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${o.current_stage === 'DELIVERED' ? 'bg-[#f0fdf4] text-verified' : 'bg-[#eff6ff] text-volt'}`}>{STAGES[o.current_stage].label}</span>
                </td>
                <td>
                  <span className="flex items-center gap-2">
                    <TierBadge tier={o.compatibility_confidence} compact />
                    {o.requires_tech_clearance_check ? <span className="text-xs text-tolerance">Check fit</span> : null}
                  </span>
                </td>
                <td className="text-secondary">{o.assigned_technician_code ?? '—'}</td>
                <td className="text-secondary">{formatDate(o.estimated_dispatch_date)}</td>
                <td className="tabular text-right font-medium">{money(o.total_charged_cents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!orders.length ? <p className="p-6 text-center text-sm text-muted">No orders yet.</p> : null}
      </div>
    </AdminShell>
  );
}
