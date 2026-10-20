import { evaluateBuildCompatibilityV2, manifestFromParts } from '@/lib/engine/compatibility-engine-v2';
import { quoteOrder } from '@/lib/engine/pricing';
import type { BuildBayTelemetryLog, ManifestLine, Order, Product } from '@/lib/types';
import { SEED_ORDERS } from './seed-commerce';
import { stableUuid } from './stable-id';
import { effectivePrice } from '@/lib/repo/shared';

/** Materialise the demo orders (and their Build Bay logs) against a product list. */
export function buildSeedOrders(products: Product[], now: number = Date.now()): { orders: Order[]; logs: BuildBayTelemetryLog[] } {
  const bySku = new Map(products.map((p) => [p.sku, p]));
  const orders: Order[] = [];
  const logs: BuildBayTelemetryLog[] = [];

  for (const s of SEED_ORDERS) {
    const parts = s.skus.map(({ sku, qty }) => ({ part: bySku.get(sku)!, quantity: qty })).filter((x) => x.part);
    const manifest = manifestFromParts(parts, s.mode);
    const report = evaluateBuildCompatibilityV2(manifest);
    const lines: ManifestLine[] = parts.map(({ part, quantity }) => ({
      product_id: part.id,
      sku: part.sku,
      name: part.name,
      brand: part.brand,
      category: part.category,
      quantity,
      unit_price_cents: effectivePrice(part),
      flash_deal_id: null,
      warehouse_bin: part.warehouse_bin,
      weight_grams: part.weight_grams
    }));
    const subtotal = lines.reduce((acc, l) => acc + l.unit_price_cents * l.quantity, 0);
    const quote = quoteOrder({
      partsSubtotalCents: subtotal,
      fulfillmentMode: s.mode,
      isSyndicatePackage: Boolean(s.packageSlug),
      optInBiosPreflash: Boolean(s.optInBios),
      report
    });
    const created = new Date(now - s.createdHoursAgo * 3600_000);
    const dispatch = new Date(created.getTime() + (s.mode === 'PRO_BUILT_FOUNDRY_RIG' ? 6 : 1) * 86400_000);
    const id = stableUuid(`order:${s.orderNumber}`);

    orders.push({
      id,
      order_number: s.orderNumber,
      user_id: null,
      customer_email: s.email,
      customer_name: s.name,
      shipping_address: {
        full_name: s.name,
        phone: '+1 (555) 010-0000',
        line1: '— on file —',
        city: s.city,
        region: s.region,
        postal_code: s.postal,
        country: 'US'
      },
      fulfillment_type: s.mode,
      includes_bios_preflash_service: quote.includesBiosPreflash,
      includes_foam_gpu_brace: quote.includesFoamBrace,
      assembly_fee_cents: quote.assemblyFeeCents,
      services_fee_cents: quote.servicesFeeCents,
      subtotal_cents: subtotal,
      total_charged_cents: quote.totalCents,
      current_stage: s.stage,
      assigned_technician_code: s.technician,
      estimated_dispatch_date: dispatch.toISOString().slice(0, 10),
      carrier: s.carrier ?? null,
      carrier_tracking_number: s.tracking ?? null,
      manifest_snapshot: {
        lines,
        services: quote.services,
        compatibility: {
          overall: report.overallConfidence,
          estimated_base_wattage: report.estimatedBaseWattage,
          estimated_peak_transient_wattage: report.estimatedPeakTransientWattage,
          recommended_psu_wattage: report.recommendedPsuWattage,
          issues: report.issues.map((i) => ({ code: i.code, tier: i.tier, title: i.title, remediation: i.remediationSuggestion }))
        },
        syndicate_package_slug: s.packageSlug
      },
      compatibility_confidence: report.overallConfidence,
      requires_tech_clearance_check: report.requiresTechnicianManualVerify,
      syndicate_package_slug: s.packageSlug,
      created_at: created.toISOString(),
      updated_at: new Date(now - Math.min(...s.logs.map((l) => l.hoursAgo)) * 3600_000).toISOString()
    });

    s.logs.forEach((l, i) => {
      logs.push({
        id: stableUuid(`log:${s.orderNumber}:${i}`),
        order_id: id,
        stage: l.stage,
        technician_code: l.technician,
        telemetry_metrics: l.metrics ?? {},
        proof_screenshot_url: l.proof ?? null,
        technician_notes: l.notes ?? null,
        logged_at: new Date(now - l.hoursAgo * 3600_000).toISOString()
      });
    });
  }
  return { orders, logs };
}
