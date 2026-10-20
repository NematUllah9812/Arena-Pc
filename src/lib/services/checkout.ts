import 'server-only';
import { z } from 'zod';
import { duplicateSingleSlotCategories, evaluateBuildCompatibilityV2, manifestFromParts } from '@/lib/engine/compatibility-engine-v2';
import { estimateDispatchDate, quoteOrder } from '@/lib/engine/pricing';
import { getRepo } from '@/lib/repo';
import type { ManifestLine, Order, PublicProduct } from '@/lib/types';

/* ------------------------------------------------------------------ */
/* Cart reservation                                                    */
/* ------------------------------------------------------------------ */
export const cartLinesSchema = z.object({
  lines: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().int().min(1).max(10),
        flashDealId: z.string().uuid().nullable().optional()
      })
    )
    .min(1)
    .max(40)
});

export type ReserveCartResult =
  | { ok: true; expiresAt: string; reservations: { productId: string; quantity: number; lockedPriceCents: number; flashDealId: string | null }[] }
  | { ok: false; error: string; productId?: string };

/**
 * Re-lease the whole cart atomically from the client's point of view: release
 * this session's previous leases, then call reserve_inventory_atomic per line.
 * Any failure releases everything so stock is never stranded.
 */
export async function reserveCart(sessionId: string, input: z.infer<typeof cartLinesSchema>): Promise<ReserveCartResult> {
  const repo = getRepo();
  await repo.releaseReservations(sessionId);

  // Merge duplicate lines (same product + deal).
  const merged = new Map<string, { productId: string; quantity: number; flashDealId: string | null }>();
  for (const l of input.lines) {
    const key = `${l.productId}:${l.flashDealId ?? ''}`;
    const prev = merged.get(key);
    merged.set(key, { productId: l.productId, flashDealId: l.flashDealId ?? null, quantity: Math.min(10, (prev?.quantity ?? 0) + l.quantity) });
  }

  const reservations: { productId: string; quantity: number; lockedPriceCents: number; flashDealId: string | null }[] = [];
  let expiresAt = '';
  // Deterministic order → consistent lock ordering across concurrent carts.
  for (const line of [...merged.values()].sort((a, b) => a.productId.localeCompare(b.productId))) {
    const res = await repo.reserve(sessionId, line.productId, line.quantity, line.flashDealId);
    if (!res.success) {
      await repo.releaseReservations(sessionId);
      return { ok: false, error: res.error, productId: line.productId };
    }
    reservations.push({ productId: line.productId, quantity: line.quantity, lockedPriceCents: res.locked_price_cents, flashDealId: line.flashDealId });
    if (!expiresAt || res.expires_at < expiresAt) expiresAt = res.expires_at;
  }
  return { ok: true, expiresAt, reservations };
}

/* ------------------------------------------------------------------ */
/* Checkout                                                            */
/* ------------------------------------------------------------------ */
export const checkoutSchema = z.object({
  customerEmail: z.string().trim().email().max(255),
  customerName: z.string().trim().min(2).max(160),
  shippingAddress: z.object({
    full_name: z.string().trim().min(2).max(160),
    phone: z.string().trim().min(7).max(32),
    line1: z.string().trim().min(3).max(200),
    line2: z.string().trim().max(200).optional().default(''),
    city: z.string().trim().min(2).max(100),
    region: z.string().trim().min(2).max(64),
    postal_code: z.string().trim().regex(/^\d{5}(-\d{4})?$/, 'US ZIP required'),
    country: z.literal('US')
  }),
  fulfillmentMode: z.enum(['DIY_PARTS_ONLY', 'PRO_BUILT_FOUNDRY_RIG']),
  optInBiosPreflash: z.boolean().default(false),
  syndicatePackageSlug: z.string().max(64).nullable().optional()
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

export type CheckoutResult =
  | { ok: true; order: Order }
  | { ok: false; error: string; detail?: string; issues?: { code: string; title: string; remediation: string }[] };

export async function checkout(sessionId: string, input: CheckoutInput): Promise<CheckoutResult> {
  const repo = getRepo();
  const reservations = await repo.listActiveReservations(sessionId);
  if (!reservations.length) return { ok: false, error: 'RESERVATION_EXPIRED', detail: 'Your 10-minute inventory lock expired. Re-lock the cart to continue.' };

  const products = new Map((await repo.getProductsByIds([...new Set(reservations.map((r) => r.product_id))])).map((p) => [p.id, p]));
  const lines: ManifestLine[] = [];
  for (const r of reservations) {
    const p = products.get(r.product_id);
    if (!p) return { ok: false, error: 'SKU_UNAVAILABLE' };
    lines.push({
      product_id: p.id,
      sku: p.sku,
      name: p.name,
      brand: p.brand,
      category: p.category,
      quantity: r.quantity,
      unit_price_cents: r.locked_price_cents,
      flash_deal_id: r.flash_deal_id,
      warehouse_bin: p.warehouse_bin,
      weight_grams: p.weight_grams
    });
  }

  // Aggregate quantities per product for the engine.
  const qty = new Map<string, number>();
  for (const l of lines) qty.set(l.product_id, (qty.get(l.product_id) ?? 0) + l.quantity);
  const parts = [...qty.entries()].map(([id, quantity]) => ({ part: products.get(id) as PublicProduct, quantity }));

  const isPro = input.fulfillmentMode === 'PRO_BUILT_FOUNDRY_RIG';
  if (isPro) {
    const dupes = duplicateSingleSlotCategories(parts);
    if (dupes.length) return { ok: false, error: 'ERR_DUPLICATE_SINGLE_SLOT', detail: `A Pro-Built rig can only contain one ${dupes.join(', ')}.` };
  }

  const report = evaluateBuildCompatibilityV2(manifestFromParts(parts, input.fulfillmentMode));
  if (!report.canCheckout) {
    return {
      ok: false,
      error: 'HARD_CONFLICT',
      detail: 'The Compatibility Engine blocked this configuration.',
      issues: report.issues.filter((i) => i.tier === 'HARD_CONFLICT').map((i) => ({ code: i.code, title: i.title, remediation: i.remediationSuggestion }))
    };
  }

  // Syndicate Package: exact component set, qty 1 each → assembly fee waived (Pro only).
  let packageSlug: string | null = null;
  if (input.syndicatePackageSlug) {
    const pkg = await repo.getPackage(input.syndicatePackageSlug);
    if (pkg) {
      const cartSkus = lines.map((l) => l.sku).sort();
      const pkgSkus = [...pkg.component_skus].sort();
      const exact = cartSkus.length === pkgSkus.length && cartSkus.every((s, i) => s === pkgSkus[i]) && lines.every((l) => l.quantity === 1);
      if (exact) packageSlug = pkg.slug;
    }
  }

  const subtotal = lines.reduce((acc, l) => acc + l.unit_price_cents * l.quantity, 0);
  const quote = quoteOrder({
    partsSubtotalCents: subtotal,
    fulfillmentMode: input.fulfillmentMode,
    isSyndicatePackage: isPro && Boolean(packageSlug),
    optInBiosPreflash: input.optInBiosPreflash,
    report
  });

  const result = await repo.placeOrder({
    sessionId,
    reservationIds: reservations.map((r) => r.id),
    customerEmail: input.customerEmail.toLowerCase(),
    customerName: input.customerName,
    shippingAddress: { ...input.shippingAddress, line2: input.shippingAddress.line2 || undefined },
    fulfillmentMode: input.fulfillmentMode,
    includesBiosPreflash: quote.includesBiosPreflash,
    includesFoamBrace: quote.includesFoamBrace,
    assemblyFeeCents: quote.assemblyFeeCents,
    servicesFeeCents: quote.servicesFeeCents,
    subtotalCents: subtotal,
    totalChargedCents: quote.totalCents,
    estimatedDispatchDate: estimateDispatchDate(input.fulfillmentMode),
    manifestSnapshot: {
      lines,
      services: quote.services,
      compatibility: {
        overall: report.overallConfidence,
        estimated_base_wattage: report.estimatedBaseWattage,
        estimated_peak_transient_wattage: report.estimatedPeakTransientWattage,
        recommended_psu_wattage: report.recommendedPsuWattage,
        issues: report.issues.map((i) => ({ code: i.code, tier: i.tier, title: i.title, remediation: i.remediationSuggestion }))
      },
      syndicate_package_slug: packageSlug
    },
    compatibilityConfidence: report.overallConfidence === 'HARD_CONFLICT' ? 'TIGHT_TOLERANCE' : report.overallConfidence,
    requiresTechClearanceCheck: report.requiresTechnicianManualVerify,
    syndicatePackageSlug: packageSlug
  });

  if (!result.ok) return { ok: false, error: result.error, detail: result.detail };
  return { ok: true, order: result.order };
}
