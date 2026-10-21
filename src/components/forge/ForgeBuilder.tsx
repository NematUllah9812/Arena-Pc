'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { evaluateBuildCompatibilityV2, manifestFromParts, type CompatibilityIssue, type CompatibilityReportV2 } from '@/lib/engine/compatibility-engine-v2';
import { quoteOrder } from '@/lib/engine/pricing';
import type { ConfidenceTier, FulfillmentMode, PartCategory, PublicProduct } from '@/lib/types';
import { FEES, SERVICE_CODES } from '@/lib/config/company';
import { money } from '@/lib/format';
import { HudCard } from '@/components/hud/HudCard';
import { TierBadge } from '@/components/hud/Badges';
import { ProductImage } from '@/components/hud/ProductImage';
import { lineFromProduct, useCart } from '@/components/cart/CartProvider';
import { QuoteLines } from '@/components/cart/QuoteLines';
import { useToast } from '@/components/layout/Toasts';
import { playClick } from '@/components/layout/feedback';
import { keySpecs } from '@/components/product/key-specs';
import { CheckIcon } from '@/components/ui/Icons';

const FORGE_KEY = 'vortex.forge.v2';

interface SlotDef {
  key: PartCategory;
  label: string;
  maxQty: number;
  multi?: boolean;
  optional?: boolean;
}
const SLOTS: SlotDef[] = [
  { key: 'CPU', label: 'Processor', maxQty: 1 },
  { key: 'MOTHERBOARD', label: 'Motherboard', maxQty: 1 },
  { key: 'CPU_COOLER', label: 'CPU Cooler', maxQty: 1 },
  { key: 'RAM', label: 'Memory Kit', maxQty: 2 },
  { key: 'GPU', label: 'Graphics', maxQty: 1 },
  { key: 'STORAGE', label: 'Storage', maxQty: 2, multi: true },
  { key: 'PSU', label: 'Power Supply', maxQty: 1 },
  { key: 'CASE', label: 'Chassis', maxQty: 1 },
  { key: 'CASE_FAN', label: 'Case Fans', maxQty: 4, optional: true },
  { key: 'OS', label: 'Operating System', maxQty: 1, optional: true }
];

type Pick = { id: string; qty: number };
type Picks = Partial<Record<PartCategory, Pick[]>>;
interface ForgeState {
  mode: FulfillmentMode;
  picks: Picks;
  optInBios: boolean;
}

const TIER_RANK: Record<ConfidenceTier, number> = { VERIFIED_FIT: 0, TIGHT_TOLERANCE: 1, HARD_CONFLICT: 2 };
const worst = (issues: CompatibilityIssue[]): ConfidenceTier =>
  issues.reduce<ConfidenceTier>((acc, i) => (TIER_RANK[i.tier] > TIER_RANK[acc] ? i.tier : acc), 'VERIFIED_FIT');

const WORKLOADS = [
  ['ESPORTS_1080P', 'Esports · 1080p high refresh'],
  ['GAMING_1440P', 'Gaming · 1440p'],
  ['ULTRA_4K', 'Gaming · 4K'],
  ['WORKSTATION', 'Workstation / AI']
] as const;

interface AutoForgeResponse {
  ok: boolean;
  error?: string;
  parts?: { id: string; quantity: number }[];
  totalCents?: number;
  assemblyFeeCents?: number;
  overallConfidence?: ConfidenceTier;
  evaluatedCombinations?: number;
  bottleneckRatio?: number | null;
  rationale?: string[];
}

export function ForgeBuilder({ products, initialAddId }: { products: PublicProduct[]; initialAddId?: string }) {
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const [state, setState] = useState<ForgeState>({ mode: 'PRO_BUILT_FOUNDRY_RIG', picks: {}, optInBios: false });
  const [hydrated, setHydrated] = useState(false);
  const [open, setOpen] = useState<PartCategory | null>(null);
  const [filter, setFilter] = useState('');
  const [hideConflicts, setHideConflicts] = useState(false);
  const [budget, setBudget] = useState(2800);
  const [workload, setWorkload] = useState<(typeof WORKLOADS)[number][0]>('GAMING_1440P');
  const [forging, setForging] = useState(false);
  const [forgeResult, setForgeResult] = useState<AutoForgeResponse | null>(null);
  const { replaceWith, setOptInBios, lines: cartLines } = useCart();
  const { push } = useToast();
  const router = useRouter();

  // Hydrate from storage, then apply ?add=
  useEffect(() => {
    let next: ForgeState = { mode: 'PRO_BUILT_FOUNDRY_RIG', picks: {}, optInBios: false };
    try {
      const raw = localStorage.getItem(FORGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ForgeState;
        const picks: Picks = {};
        for (const [k, arr] of Object.entries(parsed.picks ?? {})) {
          const valid = (arr ?? []).filter((x) => byId.has(x.id));
          if (valid.length) picks[k as PartCategory] = valid;
        }
        next = { mode: parsed.mode === 'DIY_PARTS_ONLY' ? 'DIY_PARTS_ONLY' : 'PRO_BUILT_FOUNDRY_RIG', picks, optInBios: Boolean(parsed.optInBios) };
      }
    } catch {
      /* corrupted storage */
    }
    if (initialAddId && byId.has(initialAddId)) {
      const p = byId.get(initialAddId)!;
      const slot = SLOTS.find((s) => s.key === p.category);
      if (slot) {
        const existing = next.picks[slot.key] ?? [];
        next.picks = { ...next.picks, [slot.key]: slot.multi ? [...existing.filter((x) => x.id !== p.id), { id: p.id, qty: 1 }] : [{ id: p.id, qty: 1 }] };
      }
      router.replace('/forge', { scroll: false });
    }
    setState(next);
    setHydrated(true);
  }, [byId, initialAddId, router]);

  useEffect(() => {
    if (hydrated) localStorage.setItem(FORGE_KEY, JSON.stringify(state));
  }, [state, hydrated]);

  const partsFor = useCallback(
    (picks: Picks) =>
      Object.values(picks)
        .flat()
        .filter((x): x is Pick => Boolean(x && byId.has(x.id)))
        .map((x) => ({ part: byId.get(x.id)!, quantity: x.qty })),
    [byId]
  );

  const parts = useMemo(() => partsFor(state.picks), [partsFor, state.picks]);
  const report: CompatibilityReportV2 = useMemo(() => evaluateBuildCompatibilityV2(manifestFromParts(parts, state.mode)), [parts, state.mode]);
  const subtotal = parts.reduce((s, x) => s + (x.part.sale_price_cents ?? x.part.base_price_cents) * x.quantity, 0);
  const quote = useMemo(
    () => quoteOrder({ partsSubtotalCents: subtotal, fulfillmentMode: state.mode, isSyndicatePackage: false, optInBiosPreflash: state.optInBios, report }),
    [subtotal, state.mode, state.optInBios, report]
  );

  const setPicks = (fn: (p: Picks) => Picks) => setState((s) => ({ ...s, picks: fn(s.picks) }));
  const choose = (slot: SlotDef, p: PublicProduct) => {
    playClick('thock');
    setPicks((picks) => {
      const cur = picks[slot.key] ?? [];
      if (slot.multi) {
        if (cur.some((x) => x.id === p.id)) return picks;
        return { ...picks, [slot.key]: [...cur, { id: p.id, qty: 1 }].slice(-3) };
      }
      return { ...picks, [slot.key]: [{ id: p.id, qty: 1 }] };
    });
    if (!slot.multi) setOpen(null);
  };
  const removePick = (slot: PartCategory, id: string) => setPicks((picks) => ({ ...picks, [slot]: (picks[slot] ?? []).filter((x) => x.id !== id) }));
  const setQty = (slot: SlotDef, id: string, qty: number) =>
    setPicks((picks) => ({ ...picks, [slot.key]: (picks[slot.key] ?? []).map((x) => (x.id === id ? { ...x, qty: Math.max(1, Math.min(slot.maxQty, qty)) } : x)) }));

  // Candidate pre-flight: evaluate the build as if each candidate were slotted in.
  const candidates = useMemo(() => {
    if (!open) return [];
    const slot = SLOTS.find((s) => s.key === open)!;
    const q = filter.trim().toLowerCase();
    return products
      .filter((p) => p.category === open)
      .filter((p) => !q || `${p.name} ${p.brand} ${p.sku}`.toLowerCase().includes(q))
      .map((p) => {
        const trial: Picks = { ...state.picks, [open]: slot.multi ? [...(state.picks[open] ?? []).filter((x) => x.id !== p.id), { id: p.id, qty: 1 }] : [{ id: p.id, qty: 1 }] };
        const r = evaluateBuildCompatibilityV2(manifestFromParts(partsFor(trial), state.mode));
        const related = r.issues.filter((i) => i.involvedSlots.includes(open));
        return { p, tier: worst(related), topIssue: related.sort((a, b) => TIER_RANK[b.tier] - TIER_RANK[a.tier])[0] };
      })
      .filter((c) => !hideConflicts || c.tier !== 'HARD_CONFLICT')
      .sort((a, b) => TIER_RANK[a.tier] - TIER_RANK[b.tier] || (a.p.sale_price_cents ?? a.p.base_price_cents) - (b.p.sale_price_cents ?? b.p.base_price_cents));
  }, [open, filter, hideConflicts, products, state.picks, state.mode, partsFor]);

  const slotTier = (key: PartCategory) => worst(report.issues.filter((i) => i.involvedSlots.includes(key)));

  const runAutoForge = async () => {
    setForging(true);
    setForgeResult(null);
    playClick('confirm');
    try {
      const res = await fetch('/api/forge/auto', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ budgetCents: budget * 100, workload, fulfillmentMode: state.mode })
      });
      const data = (await res.json()) as AutoForgeResponse;
      setForgeResult(data);
      if (data.ok && data.parts) {
        const picks: Picks = {};
        for (const { id, quantity } of data.parts) {
          const p = byId.get(id);
          if (!p) continue;
          picks[p.category] = [...(picks[p.category] ?? []), { id, qty: quantity }];
        }
        setState((s) => ({ ...s, picks }));
        push({ title: 'Auto-Forge complete', body: `${data.evaluatedCombinations?.toLocaleString()} combinations evaluated.`, tone: 'info' });
      } else {
        push({ title: 'Auto-Forge failed', body: data.error ?? 'No viable build in budget.', tone: 'error' });
      }
    } catch {
      push({ title: 'Couldn’t suggest a build', body: 'Please check your connection and try again.', tone: 'error' });
    } finally {
      setForging(false);
    }
  };

  const sendToManifest = () => {
    if (!report.canCheckout) return;
    if (cartLines.length && !confirm('Replace the items in your cart with this build?')) return;
    replaceWith(
      parts.map(({ part, quantity }) => lineFromProduct(part, { quantity })),
      { packageSlug: null, mode: state.mode }
    );
    setOptInBios(state.optInBios);
    push({ title: 'Build added to cart', body: 'Review it and check out when ready.', tone: 'info' });
    router.push('/cart');
  };

  const wattPct = report.recommendedPsuWattage ? Math.min(100, (report.estimatedPeakTransientWattage / Math.max(report.recommendedPsuWattage, 1)) * 100) : 0;
  const psu = parts.find((x) => x.part.category === 'PSU')?.part;
  const psuW = Number(psu?.specs.wattage ?? 0);
  const openSlot = SLOTS.find((s) => s.key === open);
  const biosOptional = report.optionalServices.find((s) => s.serviceCode === SERVICE_CODES.BIOS_FLASH_DIY);

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="flex flex-col gap-6">
        {/* Auto-forge console */}
        <div className="grid gap-5 rounded-xl border border-hairline bg-chassis p-5 md:grid-cols-[1fr_auto] md:items-end">
          <p className="font-semibold md:col-span-2">Not sure where to start? Set a budget and we&rsquo;ll suggest a build.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="flex justify-between text-sm font-medium text-secondary">
                Budget <span className="tabular font-semibold text-primary">{money(budget * 100)}</span>
              </span>
              <input type="range" className="hud-range" min={800} max={8000} step={50} value={budget} onChange={(e) => setBudget(Number(e.target.value))} />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-secondary">Main use</span>
              <select className="hud-select" value={workload} onChange={(e) => setWorkload(e.target.value as typeof workload)}>
                {WORKLOADS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button type="button" className="btn-overclock" onClick={runAutoForge} disabled={forging}>
            {forging ? 'Finding parts…' : 'Suggest a build'}
          </button>
          {forgeResult?.ok && forgeResult.rationale ? (
            <ul className="space-y-1 border-t border-hairline pt-4 text-sm text-secondary md:col-span-2">
              {forgeResult.rationale.map((r) => (
                <li key={r}>
                  <CheckIcon size={14} strokeWidth={2.4} className="mr-1 inline-block align-[-2px] text-verified" />{r}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {/* Mode */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" role="radiogroup" aria-label="How would you like it?">
          {(
            [
              ['DIY_PARTS_ONLY', 'Parts only', 'I’ll build it myself · ships same day before 4 PM CST'],
              ['PRO_BUILT_FOUNDRY_RIG', 'Built by us', `Assembled & stress-tested · ${money(FEES.PRO_BUILT_ASSEMBLY_CENTS)}`]
            ] as const
          ).map(([m, l, d]) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={state.mode === m}
              onClick={() => setState((s) => ({ ...s, mode: m }))}
              className={`rounded-xl border bg-white p-4 text-left transition ${state.mode === m ? 'border-volt ring-1 ring-volt' : 'border-hairline hover:border-[#d1d5db]'}`}
            >
              <p className={`font-semibold ${state.mode === m ? 'text-volt' : 'text-primary'}`}>{l}</p>
              <p className="mt-0.5 text-sm text-secondary">{d}</p>
            </button>
          ))}
        </div>

        {/* Slots */}
        <ol className="flex flex-col gap-2">
          {SLOTS.map((slot, idx) => {
            const picks = state.picks[slot.key] ?? [];
            const tier = picks.length ? slotTier(slot.key) : null;
            const missing = report.missingSlots.includes(slot.key);
            return (
              <li key={slot.key}>
                <div className={`hud-panel ${open === slot.key ? 'border-volt ring-1 ring-volt' : ''} ${tier ? `tier-${tier}` : ''}`}>
                  <div className="flex items-center gap-4 p-3 pr-4">
                    <span className="tabular grid h-8 w-8 shrink-0 place-items-center rounded-full bg-chassis text-sm font-semibold text-secondary">{idx + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 text-sm font-semibold text-primary">
                        {slot.label}
                        {slot.optional ? <span className="font-normal text-muted">(optional)</span> : null}
                        {missing ? <span className="font-normal text-tolerance">· required</span> : null}
                      </p>
                      {picks.length === 0 ? (
                        <p className="mt-0.5 text-sm text-muted">Not selected</p>
                      ) : (
                        <ul className="mt-1 flex flex-col gap-1.5">
                          {picks.map((pk) => {
                            const p = byId.get(pk.id)!;
                            return (
                              <li key={pk.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                <Link href={`/product/${p.slug}`} className="min-w-0 truncate text-sm text-primary hover:text-volt">
                                  {p.name}
                                </Link>
                                <span className="tabular text-xs text-secondary">{money((p.sale_price_cents ?? p.base_price_cents) * pk.qty)}</span>
                                {slot.maxQty > 1 ? (
                                  <span className="flex items-center gap-1">
                                    <button type="button" className="btn-ghost size-sm px-2" aria-label="Decrease" onClick={() => setQty(slot, pk.id, pk.qty - 1)}>
                                      −
                                    </button>
                                    <span className="tabular w-5 text-center text-xs">{pk.qty}</span>
                                    <button type="button" className="btn-ghost size-sm px-2" aria-label="Increase" onClick={() => setQty(slot, pk.id, pk.qty + 1)}>
                                      +
                                    </button>
                                  </span>
                                ) : null}
                                <button type="button" className="text-xs text-muted hover:text-conflict" onClick={() => removePick(slot.key, pk.id)} aria-label={`Remove ${p.name}`}>
                                  Remove
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                    {tier ? <TierBadge tier={tier} compact /> : null}
                    <button
                      type="button"
                      className={`btn-ghost size-sm ${open === slot.key ? 'is-active' : ''}`}
                      onClick={() => {
                        setOpen(open === slot.key ? null : slot.key);
                        setFilter('');
                      }}
                      aria-expanded={open === slot.key}
                    >
                      {open === slot.key ? 'Done' : picks.length ? (slot.multi ? 'Add another' : 'Change') : 'Choose'}
                    </button>
                  </div>

                  {open === slot.key && openSlot ? (
                    <div className="border-t border-hairline p-3">
                      <div className="mb-3 flex flex-wrap items-center gap-3">
                        <input className="hud-input max-w-xs flex-1" placeholder={`Search ${slot.label.toLowerCase()}…`} value={filter} onChange={(e) => setFilter(e.target.value)} autoFocus />
                        <label className="flex items-center gap-2 text-sm text-secondary">
                          <input type="checkbox" className="hud-check" checked={hideConflicts} onChange={(e) => setHideConflicts(e.target.checked)} />
                          Hide incompatible parts
                        </label>
                        <span className="hud-label ml-auto">{candidates.length} options</span>
                      </div>
                      <ul className="grid max-h-[520px] gap-2 overflow-y-auto pr-1 md:grid-cols-2">
                        {candidates.map(({ p, tier: ct, topIssue }) => {
                          const selected = picks.some((x) => x.id === p.id);
                          const out = p.available_quantity <= 0;
                          return (
                            <li key={p.id}>
                              <button
                                type="button"
                                disabled={out}
                                onClick={() => choose(openSlot, p)}
                                className={`tier-${ct} group flex w-full gap-3 rounded-lg border bg-white p-2.5 text-left transition-colors disabled:opacity-40 ${selected ? 'border-volt ring-1 ring-volt' : 'border-hairline hover:border-[#d1d5db]'}`}
                              >
                                <div className="relative h-16 w-16 shrink-0">
                                  <ProductImage src={p.primary_image_url} alt="" sizes="64px" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-start justify-between gap-2">
                                    <p className="line-clamp-2 text-sm leading-snug text-primary">{p.name}</p>
                                    <span className="tabular shrink-0 text-sm font-semibold">{money(p.sale_price_cents ?? p.base_price_cents)}</span>
                                  </div>
                                  <p className="mt-1 truncate text-xs text-muted">
                                    {keySpecs(p.category, p.specs, 3)
                                      .map((s) => s.value)
                                      .join(' · ')}
                                  </p>
                                  <div className="mt-1.5 flex items-center gap-2">
                                    <TierBadge tier={ct} compact />
                                    {out ? <span className="hud-label text-conflict">Out of stock</span> : null}
                                    {topIssue && ct !== 'VERIFIED_FIT' ? <span className="truncate text-xs text-secondary">{topIssue.title}</span> : null}
                                  </div>
                                </div>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Diagnostics rail */}
      <aside className="flex flex-col gap-4 xl:sticky xl:top-[calc(var(--header-h)+20px)] xl:self-start" aria-label="Build diagnostics">
        <HudCard tone={report.overallConfidence === 'HARD_CONFLICT' ? 'tungsten' : 'default'} innerClassName="flex flex-col gap-4 p-5">
          <div className="flex items-center justify-between">
            <span className="font-semibold">Compatibility</span>
            <TierBadge tier={report.overallConfidence} />
          </div>
          <div>
            <div className="mb-1.5 flex justify-between text-xs text-muted">
              <span>Peak power vs recommended PSU</span>
              <span className="tabular text-secondary">
                {report.estimatedPeakTransientWattage}W / {report.recommendedPsuWattage}W{psuW ? ` · PSU ${psuW}W` : ''}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[#f3f4f6]">
              <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${wattPct}%`, background: psuW && psuW < report.recommendedPsuWattage ? 'var(--status-conflict)' : 'var(--accent)' }} />
            </div>
            <p className="tabular mt-1.5 text-xs text-muted">Typical draw {report.estimatedBaseWattage}W</p>
          </div>
          {report.missingSlots.length ? (
            <p className="rounded-lg bg-[#fffbeb] px-3 py-2 text-sm text-secondary">
              Still needed: <span className="font-medium text-tolerance">{report.missingSlots.map((m) => SLOTS.find((x) => x.key === m)?.label ?? m).join(', ')}</span>
            </p>
          ) : null}
          {report.issues.length ? (
            <ul className="flex max-h-[340px] flex-col gap-2 overflow-y-auto pr-1">
              {report.issues
                .slice()
                .sort((a, b) => TIER_RANK[b.tier] - TIER_RANK[a.tier])
                .map((i) => (
                  <li key={i.code + i.involvedSlots.join()} className={`tier-${i.tier} tier-border rounded-lg border-l-4 bg-white px-3 py-2.5`}>
                    <p className="text-sm font-medium text-primary">{i.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-secondary">{i.explanation}</p>
                    {i.remediationSuggestion ? <p className="mt-1 text-xs font-medium text-primary">Tip: {i.remediationSuggestion}</p> : null}
                  </li>
                ))}
            </ul>
          ) : parts.length ? (
            <p className="text-sm text-verified">Everything you&rsquo;ve picked works together.</p>
          ) : (
            <p className="text-sm text-muted">Choose parts on the left. We check each option against what you&rsquo;ve already picked.</p>
          )}
          {report.autoInjectedLogisticsItems.map((l) => (
            <p key={l.code} className="rounded-lg bg-[#f0f9ff] px-3 py-2 text-sm text-secondary">
              <span className="font-medium text-primary">{l.name}</span> — {l.reason}
            </p>
          ))}
          {state.mode === 'DIY_PARTS_ONLY' && parts.some((x) => x.part.category === 'MOTHERBOARD') && !report.autoInjectedLogisticsItems.some((l) => l.code === SERVICE_CODES.BIOS_FLASH_DIY) ? (
            <label className="flex items-start gap-2.5 text-sm text-secondary">
              <input type="checkbox" className="hud-check mt-0.5" checked={state.optInBios} onChange={(e) => setState((s) => ({ ...s, optInBios: e.target.checked }))} />
              <span>
                {biosOptional ? 'Update the BIOS before shipping' : 'Update the BIOS before shipping'} (+{money(FEES.DIY_BIOS_PREFLASH_CENTS)})
              </span>
            </label>
          ) : null}
        </HudCard>

        <HudCard innerClassName="flex flex-col gap-3 p-5">
          <span className="font-semibold">Summary</span>
          <QuoteLines quote={quote} />
          <button type="button" className="btn-overclock w-full" disabled={!report.canCheckout || !parts.length} onClick={sendToManifest}>
            {report.overallConfidence === 'HARD_CONFLICT' ? 'Fix compatibility issues first' : !report.isCompleteSystem ? 'Add these parts to cart' : 'Add build to cart'}
          </button>
          <div className="flex justify-between">
            <button type="button" className="text-sm text-muted hover:text-conflict" onClick={() => setState((s) => ({ ...s, picks: {} }))} disabled={!parts.length}>
              Start over
            </button>
            <span className="hud-label">{parts.reduce((n, x) => n + x.quantity, 0)} parts</span>
          </div>
        </HudCard>
      </aside>
    </div>
  );
}
