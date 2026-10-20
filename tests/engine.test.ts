import { describe, expect, it } from 'vitest';
import { evaluateBuildCompatibilityV2, manifestFromParts } from '@/lib/engine/compatibility-engine-v2';
import { quoteOrder } from '@/lib/engine/pricing';
import { forgeMarginOptimalBuild } from '@/lib/engine/margin-aware-auto-forge';
import { nextStage, stageSequence } from '@/lib/engine/build-bay';
import { SEED_PRODUCTS, seedProduct } from '@/lib/data/seed-catalog';
import { SEED_ORDERS, SEED_PACKAGES } from '@/lib/data/seed-commerce';
import { FEES, SERVICE_CODES } from '@/lib/config/company';
import type { FulfillmentMode } from '@/lib/types';

const build = (skus: string[], mode: FulfillmentMode = 'PRO_BUILT_FOUNDRY_RIG') => evaluateBuildCompatibilityV2(manifestFromParts(skus.map((s) => ({ part: seedProduct(s), quantity: 1 })), mode));
const BASE_AM5 = ['VL-MB-X870-TOMAHAWK', 'VL-RAM-TZ5N-32-6000', 'VL-GPU-5070TI-GOC', 'VL-SSD-990PRO-2TB', 'VL-COOL-LF3PRO-360', 'VL-CASE-O11EVO-RGB', 'VL-PSU-RM1000X'];

describe('seed data integrity', () => {
  it('every seed order evaluates without HARD_CONFLICT', () => {
    for (const o of SEED_ORDERS) {
      const r = evaluateBuildCompatibilityV2(manifestFromParts(o.skus.map((s) => ({ part: seedProduct(s.sku), quantity: s.qty })), o.mode));
      expect(r.overallConfidence, o.orderNumber).not.toBe('HARD_CONFLICT');
    }
  });

  it('every Syndicate package is a complete, checkout-able system', () => {
    for (const p of SEED_PACKAGES) {
      const r = build(p.component_skus);
      expect(r.canCheckout, p.slug).toBe(true);
      expect(r.isCompleteSystem, p.slug).toBe(true);
    }
  });

  it('SKUs and slugs are unique; no list price below the 60% cost floor', () => {
    expect(new Set(SEED_PRODUCTS.map((p) => p.sku)).size).toBe(SEED_PRODUCTS.length);
    expect(new Set(SEED_PRODUCTS.map((p) => p.slug)).size).toBe(SEED_PRODUCTS.length);
    for (const p of SEED_PRODUCTS.filter((x) => x.category !== 'INTERNAL_BRACE')) {
      expect(p.base_price_cents, p.sku).toBeGreaterThanOrEqual(Math.ceil(p.cost_price_cents * FEES.PRICE_FLOOR_RATIO));
      if (p.sale_price_cents != null) expect(p.sale_price_cents, p.sku).toBeGreaterThanOrEqual(Math.ceil(p.cost_price_cents * FEES.PRICE_FLOOR_RATIO));
    }
  });
});

describe('compatibility engine v2', () => {
  it('a clean AM5 build is VERIFIED_FIT', () => {
    const r = build(['VL-CPU-9800X3D', ...BASE_AM5]);
    expect(r.overallConfidence).toBe('VERIFIED_FIT');
    expect(r.canCheckout).toBe(true);
  });

  it('DDR4 memory in a DDR5 board is a HARD_CONFLICT that blocks checkout', () => {
    const r = build(['VL-CPU-9800X3D', ...BASE_AM5.map((s) => (s === 'VL-RAM-TZ5N-32-6000' ? 'VL-RAM-LPX-32-3600' : s))]);
    expect(r.overallConfidence).toBe('HARD_CONFLICT');
    expect(r.canCheckout).toBe(false);
  });

  it('Intel CPU on an AM5 board is a socket HARD_CONFLICT', () => {
    const r = build(['VL-CPU-285K', ...BASE_AM5]);
    expect(r.issues.some((i) => i.tier === 'HARD_CONFLICT' && i.involvedSlots.includes('CPU') && i.involvedSlots.includes('MOTHERBOARD'))).toBe(true);
  });

  it('DIY: CPU needing newer BIOS on a board without flashback auto-injects the mandatory $15 flash', () => {
    const r = build(['VL-CPU-9950X3D', 'VL-MB-B650M-PRORS', 'VL-RAM-TZ5N-32-6000', 'VL-GPU-5070TI-GOC', 'VL-SSD-990PRO-2TB', 'VL-COOL-LF3PRO-360', 'VL-CASE-O11EVO-RGB', 'VL-PSU-RM1000X'], 'DIY_PARTS_ONLY');
    const flash = r.autoInjectedLogisticsItems.find((i) => i.code === SERVICE_CODES.BIOS_FLASH_DIY);
    expect(flash?.priceCents).toBe(FEES.DIY_BIOS_PREFLASH_CENTS);
    expect(r.canCheckout).toBe(true);
    const q = quoteOrder({ partsSubtotalCents: 100_000, fulfillmentMode: 'DIY_PARTS_ONLY', isSyndicatePackage: false, optInBiosPreflash: false, report: r });
    expect(q.servicesFeeCents).toBe(FEES.DIY_BIOS_PREFLASH_CENTS);
    expect(q.includesBiosPreflash).toBe(true);
  });

  it('heavy GPU (>1200 g) in a Pro-Built rig auto-injects the Instapak foam brace', () => {
    const gpu = seedProduct('VL-GPU-5090-ASTRAL');
    expect(gpu.weight_grams).toBeGreaterThan(FEES.GPU_FOAM_BRACE_THRESHOLD_GRAMS);
    const r = build(['VL-CPU-9950X3D', 'VL-MB-X870E-HERO', 'VL-RAM-TZ5N-32-6000', 'VL-GPU-5090-ASTRAL', 'VL-SSD-990PRO-2TB', 'VL-COOL-LF3PRO-360', 'VL-CASE-NORTHXL', 'VL-PSU-VERTEX-GX1200']);
    expect(r.autoInjectedLogisticsItems.some((i) => i.code === SERVICE_CODES.FOAM_BRACE)).toBe(true);
  });

  it('flags the 358 mm Astral 5090 in a 360 mm 4000D (air-cooled) as TIGHT_TOLERANCE', () => {
    const r = build(['VL-CPU-9950X3D', 'VL-MB-X870E-HERO', 'VL-RAM-TZ5N-32-6000', 'VL-GPU-5090-ASTRAL', 'VL-SSD-990PRO-2TB', 'VL-COOL-PA120SE', 'VL-CASE-4000D-RS', 'VL-PSU-VERTEX-GX1200']);
    const gpuCase = r.issues.filter((i) => i.involvedSlots.includes('GPU') && i.involvedSlots.includes('CASE'));
    expect(gpuCase.some((i) => i.tier === 'TIGHT_TOLERANCE')).toBe(true);
    expect(r.canCheckout).toBe(true);
  });

  it('a front-mounted 360 mm radiator eats GPU clearance → HARD collision in the same chassis', () => {
    const r = build(['VL-CPU-9950X3D', 'VL-MB-X870E-HERO', 'VL-RAM-TZ5N-32-6000', 'VL-GPU-5090-ASTRAL', 'VL-SSD-990PRO-2TB', 'VL-COOL-LF3PRO-360', 'VL-CASE-4000D-RS', 'VL-PSU-VERTEX-GX1200']);
    expect(r.issues.some((i) => i.code === 'ERR_GPU_PHYSICAL_COLLISION' && i.tier === 'HARD_CONFLICT')).toBe(true);
  });

  it('undersized PSU for a 5090 is flagged on PSU × GPU', () => {
    const r = build(['VL-CPU-9950X3D', 'VL-MB-X870E-HERO', 'VL-RAM-TZ5N-32-6000', 'VL-GPU-5090-ASTRAL', 'VL-SSD-990PRO-2TB', 'VL-COOL-LF3PRO-360', 'VL-CASE-NORTHXL', 'VL-PSU-GFA3-750']);
    expect(r.issues.some((i) => i.involvedSlots.includes('PSU') && i.tier !== 'VERIFIED_FIT')).toBe(true);
  });
});

describe('pricing', () => {
  it('Pro-Built custom rig charges the $149 assembly; intact Syndicate package waives it', () => {
    const custom = quoteOrder({ partsSubtotalCents: 200_000, fulfillmentMode: 'PRO_BUILT_FOUNDRY_RIG', isSyndicatePackage: false, optInBiosPreflash: false, report: null });
    const pkg = quoteOrder({ partsSubtotalCents: 200_000, fulfillmentMode: 'PRO_BUILT_FOUNDRY_RIG', isSyndicatePackage: true, optInBiosPreflash: false, report: null });
    expect(custom.totalCents).toBe(200_000 + FEES.PRO_BUILT_ASSEMBLY_CENTS);
    expect(pkg.totalCents).toBe(200_000);
    expect(pkg.assemblyFeeWaivedCents).toBe(FEES.PRO_BUILT_ASSEMBLY_CENTS);
  });

  it('DIY opt-in BIOS flash adds $15 once', () => {
    const q = quoteOrder({ partsSubtotalCents: 50_000, fulfillmentMode: 'DIY_PARTS_ONLY', isSyndicatePackage: false, optInBiosPreflash: true, report: null });
    expect(q.totalCents).toBe(50_000 + FEES.DIY_BIOS_PREFLASH_CENTS);
  });
});

describe('margin-aware auto-forge', () => {
  it.each([
    [150_000, 'ESPORTS_1080P'],
    [280_000, 'GAMING_1440P'],
    [520_000, 'ULTRA_4K']
  ] as const)('builds a checkout-able system within a $%i budget (%s)', (budget, workload) => {
    const r = forgeMarginOptimalBuild(budget, workload, SEED_PRODUCTS);
    expect(r.compatibilityReport?.canCheckout).toBe(true);
    expect(r.totalCents).toBeLessThanOrEqual(budget);
    expect(r.rationale.join(' ')).not.toMatch(/margin|cost|velocity/i);
  });
});

describe('build bay pipeline', () => {
  it('Pro-Built runs all stages; DIY skips bench + burn-in', () => {
    expect(stageSequence('PRO_BUILT_FOUNDRY_RIG', true)).toHaveLength(8);
    expect(stageSequence('DIY_PARTS_ONLY', false)).not.toContain('OCCT_THERMAL_BURN_IN_4HR');
    expect(stageSequence('DIY_PARTS_ONLY', true)).toContain('BIOS_FLASH_AND_EXPO_TUNING');
    expect(nextStage('PRO_BUILT_FOUNDRY_RIG', true, 'BIOS_FLASH_AND_EXPO_TUNING')).toBe('OCCT_THERMAL_BURN_IN_4HR');
    expect(nextStage('PRO_BUILT_FOUNDRY_RIG', true, 'DELIVERED')).toBeNull();
  });
});
