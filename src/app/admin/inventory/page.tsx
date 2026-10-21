import { getRepo } from '@/lib/repo';
import { requireAdminPage, can } from '@/lib/security/admin';
import { productPhotos } from '@/lib/format';
import { AdminShell } from '@/components/admin/AdminShell';
import { InventoryTable, type InventoryRow } from '@/components/admin/InventoryTable';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Products' };

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ photos?: string; stock?: string }> }) {
  const admin = await requireAdminPage('inventory');
  const [sp, products] = await Promise.all([searchParams, getRepo().listProductsInternal()]);
  const rows: InventoryRow[] = products.map((p) => ({
    id: p.id,
    sku: p.sku,
    slug: p.slug,
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
    active: p.is_active,
    primary: p.primary_image_url,
    photos: productPhotos(p)
  }));
  return (
    <AdminShell admin={admin} active="/admin/inventory" title="Products" description="Click a product to add photos, update stock or change its price. Every change is recorded in the activity log.">
      <InventoryTable rows={rows} canPrice={can(admin, 'pricing')} initialFilter={sp.photos === 'missing' ? 'photos' : sp.stock === 'low' ? 'low' : 'all'} />
    </AdminShell>
  );
}
