import { getRepo } from '@/lib/repo';
import { requireAdminPage } from '@/lib/security/admin';
import { AdminShell } from '@/components/admin/AdminShell';
import { DealsManager } from '@/components/admin/DealsManager';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Flash Deals' };

export default async function DealsAdminPage() {
  const admin = await requireAdminPage('deals');
  const repo = getRepo();
  const [deals, products] = await Promise.all([repo.listFlashDeals({ includeUpcoming: true, includeInactive: true }), repo.listProductsInternal()]);
  const options = products
    .filter((p) => p.is_active)
    .sort((a, b) => b.days_in_inventory - a.days_in_inventory)
    .map((p) => ({ id: p.id, label: `${p.sku} — ${p.name}`, base: p.base_price_cents, floor: Math.ceil(p.cost_price_cents * 0.6), days: p.days_in_inventory, stock: p.stock_quantity - p.reserved_quantity }));
  return (
    <AdminShell admin={admin} active="/admin/deals">
      <h1 className="hud-title mb-6 text-3xl">Flash Deals</h1>
      <DealsManager initial={deals} products={options} />
    </AdminShell>
  );
}
