'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { FEES, SERVICE_CODES } from '@/lib/config/company';
import { CATEGORY_CODE, money } from '@/lib/format';
import { estimateDispatchDate, isBeforeSameDayCutoff } from '@/lib/engine/pricing';
import { HudCard } from '@/components/hud/HudCard';
import { TierBadge } from '@/components/hud/Badges';
import { ProductImage } from '@/components/hud/ProductImage';
import { useToast } from '@/components/layout/Toasts';
import { playClick } from '@/components/layout/feedback';
import { QuoteLines } from './QuoteLines';
import { useCart } from './CartProvider';

export function CartView() {
  const cart = useCart();
  const { push } = useToast();
  const router = useRouter();
  const [locking, setLocking] = useState(false);
  const { lines, report, quote, mode } = cart;

  if (!cart.hydrated) return <div className="skeleton h-96" />;
  if (!lines.length) {
    return (
      <HudCard innerClassName="flex flex-col items-start gap-4 p-10">
        <span className="hud-label">MANIFEST_EMPTY</span>
        <p className="text-lg text-secondary">No hardware queued. Forge a rig, deploy a Syndicate package or claim a flash drop.</p>
        <div className="flex flex-wrap gap-3">
          <Link href="/forge" className="btn-overclock">
            Open Rig Forge
          </Link>
          <Link href="/syndicate" className="btn-ghost">
            Syndicate Rigs
          </Link>
        </div>
      </HudCard>
    );
  }

  const lock = async () => {
    setLocking(true);
    playClick('confirm');
    try {
      const res = await fetch('/api/cart/reserve', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ lines: lines.map((l) => ({ productId: l.productId, quantity: l.quantity, flashDealId: l.flashDealId })) })
      });
      const data = (await res.json()) as
        | { ok: true; expiresAt: string; reservations: { productId: string; lockedPriceCents: number; flashDealId: string | null }[] }
        | { ok: false; error: string; detail?: string; productId?: string };
      if (!data.ok) {
        const line = lines.find((l) => l.productId === data.productId);
        push({ title: line ? `Lock failed · ${line.name}` : 'Lock failed', body: data.detail ?? data.error, tone: 'error' });
        playClick('error');
        return;
      }
      const lockedPrices: Record<string, number> = {};
      for (const r of data.reservations) lockedPrices[`${r.productId}:${r.flashDealId ?? ''}`] = r.lockedPriceCents;
      cart.setLease({ expiresAt: data.expiresAt, lockedPrices });
      router.push('/checkout');
    } catch {
      push({ title: 'Network fault', body: 'Could not reach the reservation ledger.', tone: 'error' });
    } finally {
      setLocking(false);
    }
  };

  const blocked = report ? !report.canCheckout : false;
  const isPro = mode === 'PRO_BUILT_FOUNDRY_RIG';
  const sameDay = !isPro && isBeforeSameDayCutoff();
  const biosMandatory = Boolean(report?.autoInjectedLogisticsItems.some((i) => i.code === SERVICE_CODES.BIOS_FLASH_DIY));

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <div className="flex flex-col gap-6">
        {cart.packageSlug ? (
          <div className={`border-l-2 px-4 py-3 text-sm ${cart.isPackageIntact && isPro ? 'border-volt bg-volt/5' : 'border-tolerance bg-tolerance/5'}`}>
            <span className="font-mono text-xs tracking-[0.12em] uppercase">Syndicate Package · {cart.packageSlug}</span>
            <p className="text-secondary">
              {cart.isPackageIntact && isPro
                ? `Intact package — ${money(FEES.PRO_BUILT_ASSEMBLY_CENTS)} Foundry assembly waived.`
                : isPro
                  ? 'Package modified — converted to a custom Pro-Built rig.'
                  : 'DIY mode selected — the Foundry assembly waiver only applies to Pro-Built rigs.'}
            </p>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-px border border-hairline bg-hairline sm:grid-cols-2" role="radiogroup" aria-label="Fulfillment mode">
          {(
            [
              ['DIY_PARTS_ONLY', 'Mode A · DIY Component Kit', sameDay ? 'Before 16:00 CST — ships TODAY' : `Ships ${estimateDispatchDate('DIY_PARTS_ONLY')}`],
              ['PRO_BUILT_FOUNDRY_RIG', 'Mode B · Pro-Built Foundry Rig', `Assembled, tuned, stress-tested · est. dispatch ${estimateDispatchDate('PRO_BUILT_FOUNDRY_RIG')}`]
            ] as const
          ).map(([m, l, d]) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => cart.setMode(m)}
              className={`p-4 text-left transition-colors ${mode === m ? 'bg-volt/10 shadow-[inset_0_-2px_0_var(--accent-volt)]' : 'bg-chassis hover:bg-elevated'}`}
            >
              <p className={`font-display text-sm font-semibold tracking-wide uppercase ${mode === m ? 'text-volt' : ''}`}>{l}</p>
              <p className="mt-0.5 font-mono text-[0.65rem] text-muted">{d}</p>
            </button>
          ))}
        </div>

        <ul className="flex flex-col gap-2" aria-label="Manifest lines">
          {lines.map((l) => (
            <li key={`${l.productId}:${l.flashDealId ?? ''}`} className="hud-panel flex flex-wrap items-center gap-4 p-3">
              <div className="relative h-16 w-20 shrink-0 bg-void">
                <ProductImage src={l.image} alt="" sizes="80px" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="hud-label">
                  {CATEGORY_CODE[l.category]} · {l.sku} · BIN #{l.bin}
                  {l.flashDealId ? <span className="ml-2 text-tungsten">FLASH DEAL</span> : null}
                </p>
                <Link href={`/product/${l.slug}`} className="block truncate text-sm text-primary hover:text-volt">
                  {l.name}
                </Link>
                <p className="tabular text-xs text-secondary">
                  {money(l.unitPriceCents)}
                  {l.unitPriceCents < l.basePriceCents ? <span className="ml-2 text-muted line-through">{money(l.basePriceCents)}</span> : null}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button type="button" className="btn-ghost size-sm px-2.5" aria-label="Decrease quantity" onClick={() => cart.setQuantity(l.productId, l.flashDealId, l.quantity - 1)}>
                  −
                </button>
                <span className="tabular w-7 text-center text-sm">{l.quantity}</span>
                <button type="button" className="btn-ghost size-sm px-2.5" aria-label="Increase quantity" onClick={() => cart.setQuantity(l.productId, l.flashDealId, l.quantity + 1)}>
                  +
                </button>
              </div>
              <span className="tabular w-24 text-right text-sm font-semibold">{money(l.unitPriceCents * l.quantity)}</span>
              <button type="button" className="hud-label hover:text-conflict" onClick={() => cart.remove(l.productId, l.flashDealId)} aria-label={`Remove ${l.name}`}>
                ×
              </button>
            </li>
          ))}
        </ul>

        {report ? (
          <HudCard tone={blocked ? 'tungsten' : 'default'} innerClassName="flex flex-col gap-3 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="hud-eyebrow">Compatibility Engine v2 · Pre-checkout scan</span>
              <TierBadge tier={report.overallConfidence} />
            </div>
            <p className="tabular font-mono text-xs text-muted">
              Base {report.estimatedBaseWattage}W · Peak transient {report.estimatedPeakTransientWattage}W · PSU target {report.recommendedPsuWattage}W
              {!report.isCompleteSystem ? ` · Incomplete system (missing ${report.missingSlots.join(', ')})` : ''}
            </p>
            {report.issues.length ? (
              <ul className="flex flex-col gap-2">
                {report.issues.map((i) => (
                  <li key={i.code + i.involvedSlots.join()} className={`tier-${i.tier} tier-border border-l-2 bg-void px-3 py-2`}>
                    <p className="tier-text font-mono text-[0.6rem] tracking-[0.12em]">{i.code}</p>
                    <p className="text-sm">{i.title}</p>
                    <p className="text-xs text-secondary">{i.remediationSuggestion}</p>
                  </li>
                ))}
              </ul>
            ) : null}
            {report.requiresTechnicianManualVerify && isPro ? <p className="text-xs text-tolerance">A Foundry technician will manually verify tight-tolerance clearances during assembly.</p> : null}
          </HudCard>
        ) : null}
      </div>

      <aside className="flex flex-col gap-4 lg:sticky lg:top-[calc(var(--header-h)+20px)] lg:self-start">
        <HudCard innerClassName="flex flex-col gap-4 p-5">
          <span className="hud-eyebrow">Order Quote</span>
          <QuoteLines quote={quote} showReasons />
          {!isPro && lines.some((l) => l.category === 'MOTHERBOARD') ? (
            <label className="flex items-start gap-2 text-xs text-secondary">
              <input type="checkbox" className="hud-check mt-0.5" checked={biosMandatory || cart.optInBios} disabled={biosMandatory} onChange={(e) => cart.setOptInBios(e.target.checked)} />
              <span>
                Pre-ship BIOS flash &amp; socket pin inspection (+{money(FEES.DIY_BIOS_PREFLASH_CENTS)})
                {biosMandatory ? <span className="block text-tolerance">Mandatory — this board ships below the CPU&rsquo;s required BIOS and has no flashback button.</span> : null}
              </span>
            </label>
          ) : null}
          <button type="button" className="btn-overclock w-full" onClick={lock} disabled={locking || blocked}>
            {blocked ? 'Blocked · Hard Conflict' : locking ? 'Locking inventory…' : 'Lock Inventory & Checkout'}
          </button>
          <p className="font-mono text-[0.62rem] leading-relaxed text-muted">
            Locking reserves every unit for {FEES.RESERVATION_TTL_MINUTES} minutes with row-level locks and freezes your price — including flash-deal pricing.
          </p>
        </HudCard>
        <button type="button" className="hud-label self-start hover:text-conflict" onClick={() => confirm('Purge the entire manifest?') && cart.clear()}>
          Purge manifest
        </button>
      </aside>
    </div>
  );
}
