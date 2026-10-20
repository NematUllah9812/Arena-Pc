import { z } from 'zod';
import { getRepo } from '@/lib/repo';
import { json, readJson } from '@/lib/api';
import { requireAdminApi } from '@/lib/security/admin';

export const dynamic = 'force-dynamic';

const pricing = z.object({
  kind: z.literal('pricing'),
  productId: z.string().uuid(),
  basePriceCents: z.number().int().min(100).max(5_000_000),
  salePriceCents: z.number().int().min(100).max(5_000_000).nullable(),
  overrideToken: z.string().max(128).nullable().optional()
});
const inventory = z.object({
  kind: z.literal('inventory'),
  productId: z.string().uuid(),
  stockQuantity: z.number().int().min(0).max(100_000),
  warehouseBin: z.string().trim().regex(/^[A-Z0-9-]{2,16}$/),
  overstockPriority: z.boolean(),
  isLeftoverClearance: z.boolean(),
  isActive: z.boolean()
});
const schema = z.discriminatedUnion('kind', [pricing, inventory]);

export async function PATCH(req: Request) {
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) return json({ ok: false, error: 'INVALID_INPUT', detail: parsed.error.issues[0]?.message }, { status: 400 });
  const auth = await requireAdminApi(parsed.data.kind === 'pricing' ? 'pricing' : 'inventory');
  if ('error' in auth) return auth.error;
  const repo = getRepo();
  const d = parsed.data;
  const res =
    d.kind === 'pricing'
      ? await repo.updateProductPricing({ adminId: auth.admin.id, productId: d.productId, basePriceCents: d.basePriceCents, salePriceCents: d.salePriceCents, overrideToken: d.overrideToken ?? null, ip: auth.ip })
      : await repo.updateProductInventory({ adminId: auth.admin.id, productId: d.productId, stockQuantity: d.stockQuantity, warehouseBin: d.warehouseBin, overstockPriority: d.overstockPriority, isLeftoverClearance: d.isLeftoverClearance, isActive: d.isActive, ip: auth.ip });
  if (!res.ok) return json(res, { status: 422 });
  const p = res.value;
  return json({ ok: true, product: { id: p.id, base_price_cents: p.base_price_cents, sale_price_cents: p.sale_price_cents, stock_quantity: p.stock_quantity, reserved_quantity: p.reserved_quantity, warehouse_bin: p.warehouse_bin, overstock_priority: p.overstock_priority, is_leftover_clearance: p.is_leftover_clearance, is_active: p.is_active } });
}
