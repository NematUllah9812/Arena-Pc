import { getRepo } from '@/lib/repo';
import { requireAdminPage, can } from '@/lib/security/admin';
import { AdminShell } from '@/components/admin/AdminShell';
import { InventoryTable, type InventoryRow } from '@/components/admin/InventoryTable';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Inventory & Pricing' };

export default async function InventoryPage() {
  const admin = await requireAdminPage('inventory');
  const products = await getRepo().listProductsInternal();
  const rows: InventoryRow[] = products.map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    category: p.category,
    base: p.base_price_cents,
    sale: p.sale_price_cents,
    cost: p.cost_price_cents,
    stock: p.stock_quantity,
    reserved: p.reserved_quantity,
    bin: p.warehouse_bin,
    days: p.days_in_inventory,
    overstock: p.overstock_priority,
    clearance: p.is_leftover_clearance,
    active: p.is_active
  }));
  return (
    <AdminShell admin={admin} active="/admin/inventory">
      <h1 className="hud-title mb-2 text-3xl">Inventory &amp; Pricing</h1>
      <p className="mb-6 max-w-3xl text-sm text-secondary">
        Price-floor circuit breaker: no list or sale price may fall below 60% of wholesale cost without a dual-admin override token issued by a second Overseer. Every mutation is written to the
        audit ledger.
      </p>
      <InventoryTable rows={rows} canPrice={can(admin, 'pricing')} />
    </AdminShell>
  );
}
