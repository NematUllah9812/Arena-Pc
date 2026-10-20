import Link from 'next/link';
import { getRepo } from '@/lib/repo';
import { requireAdminPage } from '@/lib/security/admin';
import { STAGES } from '@/lib/engine/build-bay';
import { formatDate, money } from '@/lib/format';
import { AdminShell } from '@/components/admin/AdminShell';
import { TierBadge } from '@/components/hud/Badges';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Foundry Queue' };

export default async function FoundryQueue() {
  const admin = await requireAdminPage('foundry');
  const orders = await getRepo().listOrders({ limit: 200 });
  return (
    <AdminShell admin={admin} active="/admin/foundry">
      <h1 className="hud-title mb-6 text-3xl">Foundry Queue</h1>
      <div className="overflow-x-auto border border-hairline">
        <table className="data-grid w-full min-w-[860px]">
          <thead>
            <tr>
              <th>Order</th>
              <th>Mode</th>
              <th>Stage</th>
              <th>Confidence</th>
              <th>Technician</th>
              <th>Dispatch</th>
              <th className="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td>
                  <Link href={`/admin/foundry/${o.order_number}`} className="tabular font-mono text-volt hover:underline">
                    {o.order_number}
                  </Link>
                </td>
                <td className="font-mono text-xs">{o.fulfillment_type === 'PRO_BUILT_FOUNDRY_RIG' ? 'PRO' : 'DIY'}</td>
                <td className="font-mono text-xs">{STAGES[o.current_stage].short}</td>
                <td>
                  <TierBadge tier={o.compatibility_confidence} compact />
                  {o.requires_tech_clearance_check ? <span className="ml-1 font-mono text-[0.6rem] text-tolerance">MANUAL FIT</span> : null}
                </td>
                <td className="font-mono text-xs">{o.assigned_technician_code ?? '—'}</td>
                <td className="font-mono text-xs">{formatDate(o.estimated_dispatch_date)}</td>
                <td className="tabular text-right">{money(o.total_charged_cents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
