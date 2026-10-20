import { FEES } from '@/lib/config/company';
import type {
  CatalogQuery,
  HardwareFacet,
  PriceOverrideApproval,
  Product,
  PublicProduct,
  SyndicatePackage,
  SyndicatePackageResolved
} from '@/lib/types';

/** Categories never listed on the public storefront (logistics consumables). */
export const HIDDEN_CATEGORIES = new Set(['INTERNAL_BRACE']);

export function effectivePrice(p: Pick<Product, 'sale_price_cents' | 'base_price_cents'>): number {
  return p.sale_price_cents ?? p.base_price_cents;
}

export function toPublicProduct(p: Product): PublicProduct {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { cost_price_cents, dual_admin_price_override_token, days_in_inventory, overstock_priority, stock_quantity, reserved_quantity, ...rest } = p;
  return { ...rest, available_quantity: Math.max(0, stock_quantity - reserved_quantity) };
}

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, ' ')
    .split(' ')
    .filter(Boolean);
}

/** Lightweight relevance score used by the in-memory store (Postgres uses tsvector + pg_trgm). */
export function searchScore(p: PublicProduct, q: string): number {
  const terms = tokenize(q);
  if (!terms.length) return 1;
  const name = p.name.toLowerCase();
  const hay = `${p.name} ${p.brand} ${p.sku} ${p.category} ${Object.values(p.specs ?? {}).join(' ')}`.toLowerCase();
  let score = 0;
  for (const t of terms) {
    if (name.includes(t)) score += 3;
    else if (p.sku.toLowerCase().includes(t)) score += 3;
    else if (hay.includes(t)) score += 1;
    else return 0; // AND semantics
  }
  return score;
}

export function filterAndSortProducts(products: PublicProduct[], q: CatalogQuery, rankedIds?: string[]): PublicProduct[] {
  let list = products.filter((p) => p.is_active && !HIDDEN_CATEGORIES.has(p.category));
  if (q.category) list = list.filter((p) => p.category === q.category);
  if (q.brands?.length) list = list.filter((p) => q.brands!.includes(p.brand));
  if (q.socket) list = list.filter((p) => p.specs.socket === q.socket || (p.specs.supported_sockets ?? []).includes(q.socket));
  if (q.memoryType) list = list.filter((p) => p.specs.memory_type === q.memoryType);
  if (q.formFactor) list = list.filter((p) => p.specs.form_factor === q.formFactor || (p.specs.form_factor_support ?? []).includes(q.formFactor));
  if (q.inStockOnly) list = list.filter((p) => p.available_quantity > 0);
  if (q.clearanceOnly) list = list.filter((p) => p.is_leftover_clearance || p.sale_price_cents != null);
  if (q.minPriceCents != null) list = list.filter((p) => effectivePrice(p) >= q.minPriceCents!);
  if (q.maxPriceCents != null) list = list.filter((p) => effectivePrice(p) <= q.maxPriceCents!);

  let scores: Map<string, number> | null = null;
  if (q.q && q.q.trim()) {
    if (rankedIds) {
      const rank = new Map(rankedIds.map((id, i) => [id, rankedIds.length - i]));
      list = list.filter((p) => rank.has(p.id));
      scores = rank;
    } else {
      scores = new Map(list.map((p) => [p.id, searchScore(p, q.q!)]));
      list = list.filter((p) => (scores!.get(p.id) ?? 0) > 0);
    }
  }

  const sort = q.sort ?? (scores ? 'featured' : 'featured');
  list = [...list].sort((a, b) => {
    if (scores && sort === 'featured') return (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0) || b.performance_score - a.performance_score;
    switch (sort) {
      case 'price_asc':
        return effectivePrice(a) - effectivePrice(b);
      case 'price_desc':
        return effectivePrice(b) - effectivePrice(a);
      case 'performance':
        return b.performance_score - a.performance_score;
      case 'newest':
        return b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id);
      default: {
        // featured: in-stock first, then deals, then performance
        const stock = Number(b.available_quantity > 0) - Number(a.available_quantity > 0);
        if (stock) return stock;
        const deal = Number(b.sale_price_cents != null) - Number(a.sale_price_cents != null);
        if (deal) return deal;
        return b.performance_score - a.performance_score;
      }
    }
  });
  return q.limit ? list.slice(0, q.limit) : list;
}

/** Same grouping as the mv_hardware_facets materialized view. */
export function computeFacets(products: Product[]): HardwareFacet[] {
  const groups = new Map<string, HardwareFacet>();
  for (const p of products) {
    if (!p.is_active) continue;
    const key = [p.category, p.brand, p.specs.socket ?? '', p.specs.memory_type ?? '', p.specs.form_factor ?? '', p.is_leftover_clearance].join('|');
    const price = effectivePrice(p);
    const g = groups.get(key) ?? {
      category: p.category,
      brand: p.brand,
      cpu_socket: p.specs.socket ?? null,
      memory_type: p.specs.memory_type ?? null,
      form_factor: p.specs.form_factor ?? null,
      is_leftover_clearance: p.is_leftover_clearance,
      total_skus: 0,
      in_stock_skus: 0,
      min_price_cents: price,
      max_price_cents: price
    };
    g.total_skus++;
    if (p.stock_quantity - p.reserved_quantity > 0) g.in_stock_skus++;
    g.min_price_cents = Math.min(g.min_price_cents, price);
    g.max_price_cents = Math.max(g.max_price_cents, price);
    groups.set(key, g);
  }
  return [...groups.values()];
}

export function resolvePackage(pkg: SyndicatePackage, products: PublicProduct[]): SyndicatePackageResolved {
  const bySku = new Map(products.map((p) => [p.sku, p]));
  const components = pkg.component_skus.map((s) => bySku.get(s)).filter((x): x is PublicProduct => Boolean(x));
  return {
    ...pkg,
    components,
    parts_total_cents: components.reduce((acc, c) => acc + effectivePrice(c), 0),
    assembly_fee_waived_cents: FEES.PRO_BUILT_ASSEMBLY_CENTS,
    in_stock: components.length === pkg.component_skus.length && components.every((c) => c.available_quantity > 0 && c.is_active)
  };
}

export type PriceFloorVerdict =
  | { ok: true; consumeToken: string | null }
  | { ok: false; error: string };

/**
 * Mirror of the Postgres `enforce_product_price_floor` trigger:
 * effective price may not drop below 60% of wholesale cost unless a *different*
 * Overseer issued an unexpired, unconsumed override for this product at or below the new price.
 */
export function checkPriceFloor(
  product: Pick<Product, 'id' | 'category' | 'cost_price_cents'>,
  basePriceCents: number,
  salePriceCents: number | null,
  overrideToken: string | null,
  requestingAdminId: string,
  approvals: PriceOverrideApproval[],
  now: number = Date.now()
): PriceFloorVerdict {
  const effective = salePriceCents ?? basePriceCents;
  if (product.category === 'INTERNAL_BRACE') return { ok: true, consumeToken: null };
  const floor = Math.floor(product.cost_price_cents * FEES.PRICE_FLOOR_RATIO);
  if (effective >= floor) return { ok: true, consumeToken: null };
  if (!overrideToken || overrideToken.length < 32) {
    return {
      ok: false,
      error: `PRICE_FLOOR_CIRCUIT_BREAKER_TRIPPED: Effective price (${effective} cents) is more than 40% below wholesale cost (${product.cost_price_cents} cents). Dual-Overseer cryptographic override token required.`
    };
  }
  const approval = approvals.find((a) => a.token === overrideToken);
  if (!approval || approval.product_id !== product.id) return { ok: false, error: 'OVERRIDE_TOKEN_INVALID: token not issued for this SKU.' };
  if (approval.consumed_at) return { ok: false, error: 'OVERRIDE_TOKEN_CONSUMED: token already used.' };
  if (new Date(approval.expires_at).getTime() <= now) return { ok: false, error: 'OVERRIDE_TOKEN_EXPIRED.' };
  if (approval.approver_admin_id === requestingAdminId) return { ok: false, error: 'OVERRIDE_REQUIRES_SECOND_OVERSEER: approver cannot apply their own token.' };
  if (effective < approval.min_price_cents) return { ok: false, error: `OVERRIDE_BELOW_APPROVED_FLOOR: approved minimum is ${approval.min_price_cents} cents.` };
  return { ok: true, consumeToken: approval.token };
}

export function randomOrderNumber(existing: (n: string) => boolean): string {
  for (let i = 0; i < 50; i++) {
    const n = `VL-ORD-${Math.floor(10000 + Math.random() * 90000)}`;
    if (!existing(n)) return n;
  }
  return `VL-ORD-${Date.now().toString().slice(-6)}`;
}

export function randomToken(bytes = 24): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}
