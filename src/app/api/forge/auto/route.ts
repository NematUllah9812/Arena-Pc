import { z } from 'zod';
import { getRepo } from '@/lib/repo';
import { forgeMarginOptimalBuild } from '@/lib/engine/margin-aware-auto-forge';
import { json, limit, readJson } from '@/lib/api';

export const dynamic = 'force-dynamic';

const schema = z.object({
  budgetCents: z.number().int().min(50_000).max(1_500_000),
  workload: z.enum(['ESPORTS_1080P', 'GAMING_1440P', 'ULTRA_4K', 'WORKSTATION']),
  fulfillmentMode: z.enum(['DIY_PARTS_ONLY', 'PRO_BUILT_FOUNDRY_RIG']).default('PRO_BUILT_FOUNDRY_RIG')
});

/**
 * Margin-aware Auto-Forge (§6). Runs server-side only: the objective function
 * reads cost/velocity columns that never leave the server. The response carries
 * only product ids + customer-safe rationale.
 */
export async function POST(req: Request) {
  const limited = await limit(req, 'auto-forge', 12, 60);
  if (limited) return limited;
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) return json({ ok: false, error: 'INVALID_INPUT', detail: parsed.error.issues[0]?.message }, { status: 400 });
  const { budgetCents, workload, fulfillmentMode } = parsed.data;
  const catalog = await getRepo().listProductsInternal();
  const result = forgeMarginOptimalBuild(budgetCents, workload, catalog, fulfillmentMode);
  if (!result.manifest || !result.compatibilityReport) {
    return json({ ok: false, error: 'NO_VIABLE_BUILD', detail: 'No verified build fits this budget. Raise the budget or change the workload.', evaluatedCombinations: result.evaluatedCombinations }, { status: 422 });
  }
  const qty = new Map<string, number>();
  for (const p of result.parts) qty.set(p.id, (qty.get(p.id) ?? 0) + 1);
  return json({
    ok: true,
    parts: [...qty.entries()].map(([id, quantity]) => ({ id, quantity })),
    totalCents: result.totalCents,
    assemblyFeeCents: result.assemblyFeeCents,
    overallConfidence: result.compatibilityReport.overallConfidence,
    evaluatedCombinations: result.evaluatedCombinations,
    bottleneckRatio: result.bottleneckRatio,
    rationale: result.rationale
  });
}
