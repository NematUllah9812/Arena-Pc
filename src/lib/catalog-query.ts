import type { CatalogQuery, PartCategory } from '@/lib/types';

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

export function parseCatalogQuery(sp: SP, category?: PartCategory): CatalogQuery {
  const sort = one(sp.sort);
  const max = Number(one(sp.max));
  return {
    category,
    q: one(sp.q)?.slice(0, 80),
    brands: one(sp.brand)?.split(',').filter(Boolean).slice(0, 12),
    socket: one(sp.socket),
    memoryType: one(sp.mem),
    formFactor: one(sp.ff),
    inStockOnly: one(sp.stock) === '1',
    clearanceOnly: one(sp.clearance) === '1',
    maxPriceCents: Number.isFinite(max) && max > 0 ? max * 100 : undefined,
    sort: (['price_asc', 'price_desc', 'performance', 'newest'].includes(sort ?? '') ? sort : 'featured') as CatalogQuery['sort']
  };
}
