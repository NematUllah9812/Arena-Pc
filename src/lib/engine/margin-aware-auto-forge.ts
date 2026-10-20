// src/lib/engine/margin-aware-auto-forge.ts
// VORTEX LABS — Margin-Aware Multi-Objective Auto-Forge (Spec §6).
//
//   V_i   = min(1, days_in_inventory / 90) + 0.35·[overstock_priority]
//   M_i   = (price − cost) / price
//   U_i(W)= w_i(W) · P_i · (1 + α·M_i + β·V_i)          α = 0.18, β = 0.22
//   max_B Σ U_i(W) − λ · max(0, |P_gpu / P_cpu − ρ(W)| − τ)
//   s.t.  Σ price_i ≤ C_max  ∧  Compatibility(B) ≠ HARD_CONFLICT
//
// Performance-floor constraint: a commercially-favoured SKU (overstock / high
// margin) may only displace an alternative if it is within 4% of the raw
// benchmark of the best-performing candidate at the same or lower price.
//
// SERVER ONLY — reads cost_price_cents.

import { FEES } from '@/lib/config/company';
import type { FulfillmentMode, Product } from '@/lib/types';
import { evaluateBuildCompatibilityV2, type BuildManifest, type CompatibilityReportV2 } from './compatibility-engine-v2';

export type WorkloadProfile = 'ESPORTS_1080P' | 'GAMING_1440P' | 'ULTRA_4K' | 'WORKSTATION';

export const WORKLOAD_LABELS: Record<WorkloadProfile, string> = {
  ESPORTS_1080P: 'Esports 1080p / 360Hz+',
  GAMING_1440P: 'Competitive 1440p',
  ULTRA_4K: 'Apex 4K Ultra',
  WORKSTATION: 'Workstation / AI'
};

const TARGET_GPU_CPU_RATIO: Record<WorkloadProfile, number> = {
  ESPORTS_1080P: 1.05,
  GAMING_1440P: 1.35,
  ULTRA_4K: 1.65,
  WORKSTATION: 1.15
};

/** Fraction of hardware budget each component may consume. */
const BUDGET_CAPS: Record<WorkloadProfile, { cpu: number; gpu: number; cpuGpu: number; ram: number; storage: number }> = {
  ESPORTS_1080P: { cpu: 0.34, gpu: 0.5, cpuGpu: 0.74, ram: 0.12, storage: 0.1 },
  GAMING_1440P: { cpu: 0.3, gpu: 0.56, cpuGpu: 0.74, ram: 0.12, storage: 0.1 },
  ULTRA_4K: { cpu: 0.26, gpu: 0.62, cpuGpu: 0.78, ram: 0.12, storage: 0.1 },
  WORKSTATION: { cpu: 0.32, gpu: 0.5, cpuGpu: 0.74, ram: 0.16, storage: 0.14 }
};

export const ALPHA_MARGIN = 0.18;
export const BETA_VELOCITY = 0.22;
export const LAMBDA_BOTTLENECK = 2200;
export const TAU_RATIO_TOLERANCE = 0.25;
export const PERFORMANCE_FLOOR = 0.96;

export const priceOf = (p: Pick<Product, 'sale_price_cents' | 'base_price_cents'>) => p.sale_price_cents ?? p.base_price_cents;

export function agingFactor(sku: Product): number {
  return Math.min(1.0, (sku.days_in_inventory ?? 0) / 90) + (sku.overstock_priority ? 0.35 : 0);
}

export function grossMarginRatio(sku: Product): number {
  const effectivePrice = priceOf(sku);
  return Math.max(0, (effectivePrice - sku.cost_price_cents) / Math.max(1, effectivePrice));
}

function workloadWeight(sku: Product, workload: WorkloadProfile): number {
  return workload === 'WORKSTATION' ? Number(sku.workstation_tier_weight ?? 1) : Number(sku.gaming_tier_weight ?? 1);
}

/**
 * Commercial + performance composite utility of a SKU.
 * Never sacrifices more than 4% raw performance to clear overstock (enforced by `applyPerformanceFloor`).
 */
export function computeCommercialUtility(sku: Product, categoryWeight: number, workload: WorkloadProfile = 'GAMING_1440P'): number {
  const commercialMultiplier = 1 + ALPHA_MARGIN * grossMarginRatio(sku) + BETA_VELOCITY * agingFactor(sku);
  return sku.performance_score * categoryWeight * workloadWeight(sku, workload) * commercialMultiplier;
}

/**
 * Remove candidates that are dominated by >4%: if another candidate costs the
 * same or less and benchmarks more than 4% higher, commercial weighting is not
 * allowed to promote the weaker part.
 */
export function applyPerformanceFloor(candidates: Product[]): Product[] {
  return candidates.filter(
    (c) => !candidates.some((o) => o !== c && priceOf(o) <= priceOf(c) && c.performance_score < o.performance_score * PERFORMANCE_FLOOR)
  );
}

export interface AutoForgeResult {
  manifest: BuildManifest | null;
  compatibilityReport: CompatibilityReportV2 | null;
  parts: Product[];
  partsCostCents: number;
  assemblyFeeCents: number;
  totalCents: number;
  objectiveScore: number;
  bottleneckRatio: number | null;
  targetRatio: number;
  evaluatedCombinations: number;
  /** Blended gross margin across selected parts (bps). Admin-only diagnostic. */
  blendedMarginBps: number;
  rationale: string[];
}

export function forgeMarginOptimalBuild(
  budgetCents: number,
  workload: WorkloadProfile,
  catalog: Product[],
  fulfillmentMode: FulfillmentMode = 'PRO_BUILT_FOUNDRY_RIG'
): AutoForgeResult {
  const assemblyFeeCents = fulfillmentMode === 'PRO_BUILT_FOUNDRY_RIG' ? FEES.PRO_BUILT_ASSEMBLY_CENTS : 0;
  const netHardwareBudget = budgetCents - assemblyFeeCents;
  const caps = BUDGET_CAPS[workload];
  const targetRatio = TARGET_GPU_CPU_RATIO[workload];

  const available = catalog.filter((p) => p.is_active && p.stock_quantity - p.reserved_quantity > 0);
  const byUtility = (w: number) => (a: Product, b: Product) => computeCommercialUtility(b, w, workload) - computeCommercialUtility(a, w, workload);
  const cheapest = (list: Product[]) => (list.length ? Math.min(...list.map(priceOf)) : Infinity);

  const cpus = applyPerformanceFloor(available.filter((p) => p.category === 'CPU' && priceOf(p) <= netHardwareBudget * caps.cpu)).sort(byUtility(1.2));
  const gpus = applyPerformanceFloor(available.filter((p) => p.category === 'GPU' && priceOf(p) <= netHardwareBudget * caps.gpu)).sort(byUtility(1.6));

  let best: Omit<AutoForgeResult, 'evaluatedCombinations' | 'assemblyFeeCents' | 'targetRatio' | 'rationale'> | null = null;
  let evaluated = 0;

  const pickBest = (list: Product[], weight: number, maxPrice: number) => {
    const affordable = list.filter((p) => priceOf(p) <= maxPrice);
    return applyPerformanceFloor(affordable).sort(byUtility(weight))[0];
  };

  for (const cpu of cpus.slice(0, 10)) {
    for (const gpu of gpus.slice(0, 10)) {
      if (priceOf(cpu) + priceOf(gpu) > netHardwareBudget * caps.cpuGpu) continue;
      evaluated++;

      // Candidate pools (compatibility-filtered) for the remaining slots.
      const moboPool = available.filter((p) => p.category === 'MOTHERBOARD' && p.specs.socket === cpu.specs.socket);
      const coolerPool = available.filter(
        (p) =>
          p.category === 'CPU_COOLER' &&
          p.specs.supported_sockets?.includes(cpu.specs.socket) &&
          Number(p.specs.tdp_rating_watts) >= cpu.tdp_watts * 1.15
      );
      const storagePool = available.filter((p) => p.category === 'STORAGE' && p.specs.type === 'NVME_M2' && priceOf(p) <= netHardwareBudget * caps.storage);
      const casePoolAll = available.filter((p) => p.category === 'CASE');
      const psuPoolAll = available.filter((p) => p.category === 'PSU');

      let remaining = netHardwareBudget - priceOf(cpu) - priceOf(gpu);
      // Reserve the cheapest viable option for every slot not yet chosen.
      const reserve = (pools: Product[][]) => pools.reduce((acc, pool) => acc + cheapest(pool), 0);

      const motherboard = pickBest(moboPool, 0.3, remaining - reserve([coolerPool, storagePool, casePoolAll, psuPoolAll]) - cheapestRam(available, moboPool));
      if (!motherboard) continue;
      remaining -= priceOf(motherboard);

      const ramPool = available.filter(
        (p) => p.category === 'RAM' && p.specs.memory_type === motherboard.specs.memory_type && priceOf(p) <= netHardwareBudget * caps.ram
      );
      const ram = pickBest(ramPool, 0.6, remaining - reserve([coolerPool, storagePool, casePoolAll, psuPoolAll]));
      if (!ram) continue;
      remaining -= priceOf(ram);

      const storage = pickBest(storagePool, 0.5, remaining - reserve([coolerPool, casePoolAll, psuPoolAll]));
      if (!storage) continue;
      remaining -= priceOf(storage);

      // Coolers that physically clear the chosen RAM (avoid hard collisions up-front).
      const coolerFit = coolerPool.filter(
        (c) => c.specs.type !== 'AIR' || Number(c.specs.max_ram_height_clearance_mm ?? 40) - Number(ram.specs.height_mm ?? 38) >= -5
      );
      const casePool = casePoolAll.filter(
        (c) => c.specs.form_factor_support?.includes(motherboard.specs.form_factor) && Number(c.specs.max_gpu_length_mm) >= Number(gpu.specs.length_mm) + 8
      );
      const cooler = pickBest(
        coolerFit.filter((c) =>
          casePool.some((pc) =>
            c.specs.type === 'AIR'
              ? Number(pc.specs.max_cpu_cooler_height_mm) >= Number(c.specs.height_mm)
              : [...(pc.specs.supported_radiators_top_mm ?? []), ...(pc.specs.supported_radiators_front_mm ?? [])].includes(c.specs.radiator_size_mm)
          )
        ),
        0.4,
        remaining - reserve([casePool, psuPoolAll])
      );
      if (!cooler) continue;
      remaining -= priceOf(cooler);

      const caseFit = casePool.filter((pc) => {
        if (cooler.specs.type === 'AIR') return Number(pc.specs.max_cpu_cooler_height_mm) >= Number(cooler.specs.height_mm);
        const top: number[] = pc.specs.supported_radiators_top_mm ?? [];
        const front: number[] = pc.specs.supported_radiators_front_mm ?? [];
        if (top.includes(cooler.specs.radiator_size_mm)) return true;
        if (front.includes(cooler.specs.radiator_size_mm))
          return Number(pc.specs.max_gpu_length_mm) - Number(cooler.specs.radiator_thickness_mm ?? 38) >= Number(gpu.specs.length_mm) + 3;
        return false;
      });
      const pcCase = pickBest(caseFit, 0.4, remaining - reserve([psuPoolAll]));
      if (!pcCase) continue;
      remaining -= priceOf(pcCase);

      const tempBuild: BuildManifest = { cpu, gpu: [gpu], motherboard, ram: [ram], storage: [storage], cooler, pcCase, fulfillmentMode };
      const preEval = evaluateBuildCompatibilityV2(tempBuild);

      const psuPool = psuPoolAll.filter(
        (p) =>
          Number(p.specs.wattage) >= preEval.recommendedPsuWattage &&
          (pcCase.specs.psu_form_factor_support ?? ['ATX']).includes(p.specs.form_factor ?? 'ATX')
      );
      const psu = pickBest(psuPool, 0.45, remaining);
      if (!psu) continue;

      const parts = [cpu, gpu, motherboard, ram, storage, cooler, pcCase, psu];
      const partsCost = parts.reduce((acc, x) => acc + priceOf(x), 0);
      if (partsCost > netHardwareBudget) continue;

      const candidate: BuildManifest = { ...tempBuild, psu };
      const finalEval = evaluateBuildCompatibilityV2(candidate);
      if (!finalEval.canCheckout) continue;

      // Bottleneck penalty
      const actualRatio = gpu.performance_score / Math.max(1, cpu.performance_score);
      const bottleneckPenalty = Math.max(0, Math.abs(actualRatio - targetRatio) - TAU_RATIO_TOLERANCE) * LAMBDA_BOTTLENECK;
      // Small preference for VERIFIED_FIT over TIGHT_TOLERANCE builds.
      const tolerancePenalty = finalEval.overallConfidence === 'TIGHT_TOLERANCE' ? 150 : 0;

      const totalUtility =
        computeCommercialUtility(gpu, 1.6, workload) +
        computeCommercialUtility(cpu, 1.2, workload) +
        computeCommercialUtility(ram, 0.5, workload) +
        computeCommercialUtility(storage, 0.4, workload) +
        computeCommercialUtility(motherboard, 0.3, workload) +
        computeCommercialUtility(psu, 0.3, workload) +
        computeCommercialUtility(cooler, 0.2, workload) +
        computeCommercialUtility(pcCase, 0.2, workload) -
        bottleneckPenalty -
        tolerancePenalty;

      if (!best || totalUtility > best.objectiveScore) {
        const revenue = partsCost;
        const cost = parts.reduce((acc, x) => acc + x.cost_price_cents, 0);
        best = {
          manifest: candidate,
          compatibilityReport: finalEval,
          parts,
          partsCostCents: partsCost,
          totalCents: partsCost + assemblyFeeCents,
          objectiveScore: totalUtility,
          bottleneckRatio: actualRatio,
          blendedMarginBps: Math.round(((revenue - cost) / Math.max(1, revenue)) * 10000)
        };
      }
    }
  }

  const rationale: string[] = [];
  if (best) {
    const [cpu, gpu] = best.parts;
    rationale.push(
      `GPU/CPU benchmark ratio ${best.bottleneckRatio!.toFixed(2)} vs ${targetRatio.toFixed(2)} target for ${WORKLOAD_LABELS[workload]}.`,
      `${gpu.name} carries the frame-rate load; ${cpu.name} keeps 1% lows stable.`,
      `PSU sized to ${best.compatibilityReport!.recommendedPsuWattage}W recommendation (peak transient ${best.compatibilityReport!.estimatedPeakTransientWattage}W).`,
      `Every slot verified against socket, DDR generation, clearance and power rules — confidence ${best.compatibilityReport!.overallConfidence}.`
    );
    if (fulfillmentMode === 'PRO_BUILT_FOUNDRY_RIG') rationale.push('$149 Foundry assembly, BIOS/EXPO tuning and stress test included in total.');
  }

  return {
    manifest: best?.manifest ?? null,
    compatibilityReport: best?.compatibilityReport ?? null,
    parts: best?.parts ?? [],
    partsCostCents: best?.partsCostCents ?? 0,
    assemblyFeeCents,
    totalCents: best?.totalCents ?? 0,
    objectiveScore: best?.objectiveScore ?? -Infinity,
    bottleneckRatio: best?.bottleneckRatio ?? null,
    targetRatio,
    evaluatedCombinations: evaluated,
    blendedMarginBps: best?.blendedMarginBps ?? 0,
    rationale
  };
}

function cheapestRam(available: Product[], moboPool: Product[]): number {
  const types = new Set(moboPool.map((m) => m.specs.memory_type));
  const rams = available.filter((p) => p.category === 'RAM' && types.has(p.specs.memory_type));
  return rams.length ? Math.min(...rams.map(priceOf)) : Infinity;
}
