'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { FEES, SERVICE_CODES } from '@/lib/config/company';
import { CATEGORY_LABEL, money } from '@/lib/format';
import { estimateDispatchDate, isBeforeSameDayCutoff } from '@/lib/engine/pricing';
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
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-hairline bg-white px-6 py-16 text-center">
        <p className="text-lg font-semibold">Your cart is empty</p>
        <p className="max-w-md text-secondary">Browse parts, pick a prebuilt PC, or design your own in the PC Builder.</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/syndicate" className="btn-overclock">
            Shop prebuilt PCs
          </Link>
          <Link href="/catalog" className="btn-ghost">
            Shop parts
          </Link>
        </div>
      </div>
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
        push({ title: line ? `Couldn’t reserve ${line.name}` : 'Couldn’t reserve your items', body: data.detail ?? data.error, tone: 'error' });
        playClick('error');
        return;
      }
      const lockedPrices: Record<string, number> = {};
      for (const r of data.reservations) lockedPrices[`${r.productId}:${r.flashDealId ?? ''}`] = r.lockedPriceCents;
      cart.setLease({ expiresAt: data.expiresAt, lockedPrices });
      router.push('/checkout');
    } catch {
      push({ title: 'Connection problem', body: 'Please check your connection and try again.', tone: 'error' });
    } finally {
      setLocking(false);
    }
  };

  const blocked = report ? !report.canCheckout : false;
  const isPro = mode === 'PRO_BUILT_FOUNDRY_RIG';
  const sameDay = !isPro && isBeforeSameDayCutoff();
  const biosMandatory = Boolean(report?.autoInjectedLogisticsItems.some((i) => i.code === SERVICE_CODES.BIOS_FLASH_DIY));

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div className="flex flex-col gap-5">
        {cart.packageSlug ? (
          <div className={`rounded-xl px-4 py-3 text-sm ${cart.isPackageIntact && isPro ? 'bg-[#f0fdf4] text-verified' : 'bg-[#fffbeb] text-tolerance'}`}>
            {cart.isPackageIntact && isPro
              ? `Prebuilt PC — free assembly applied (save ${money(FEES.PRO_BUILT_ASSEMBLY_CENTS)}).`
              : isPro
                ? 'You changed parts in this prebuilt PC, so it’s now a custom build.'
                : 'Free assembly only applies when we build the PC for you.'}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" role="radiogroup" aria-label="How would you like it?">
          {(
            [
              ['DIY_PARTS_ONLY', 'Parts only', sameDay ? 'Ships today' : `Ships ${estimateDispatchDate('DIY_PARTS_ONLY')}`],
              ['PRO_BUILT_FOUNDRY_RIG', 'Built by us', `Assembled & tested · ships ${estimateDispatchDate('PRO_BUILT_FOUNDRY_RIG')}`]
            ] as const
          ).map(([m, l, d]) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => cart.setMode(m)}
              className={`flex items-start gap-3 rounded-xl border bg-white p-4 text-left transition ${mode === m ? 'border-volt ring-1 ring-volt' : 'border-hairline hover:border-[#d1d5db]'}`}
            >
              <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${mode === m ? 'border-volt' : 'border-[#d1d5db]'}`}>
                {mode === m ? <span className="h-2.5 w-2.5 rounded-full bg-volt" /> : null}
              </span>
              <span>
                <span className="block font-semibold text-primary">{l}</span>
                <span className="block text-sm text-secondary">{d}</span>
              </span>
            </button>
          ))}
        </div>

        <ul className="divide-y divide-hairline overflow-hidden rounded-xl border border-hairline bg-white" aria-label="Cart items">
          {lines.map((l) => (
            <li key={`${l.productId}:${l.flashDealId ?? ''}`} className="flex flex-wrap items-center gap-4 p-4">
              <div className="relative h-20 w-20 shrink-0 rounded-lg bg-white">
                <ProductImage src={l.image} alt="" sizes="80px" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted">
                  {CATEGORY_LABEL[l.category]}
                  {l.flashDealId ? <span className="ml-2 font-medium text-tungsten">Deal price</span> : null}
                </p>
                <Link href={`/product/${l.slug}`} className="line-clamp-2 text-[0.95rem] font-medium text-primary hover:text-volt">
                  {l.name}
                </Link>
                <p className="tabular text-sm text-secondary">
                  {money(l.unitPriceCents)}
                  {l.unitPriceCents < l.basePriceCents ? <span className="ml-2 text-muted line-through">{money(l.basePriceCents)}</span> : null}
                </p>
              </div>
              <div className="flex items-center rounded-lg border border-hairline">
                <button type="button" className="h-9 w-9 text-secondary hover:text-primary" aria-label="Decrease quantity" onClick={() => cart.setQuantity(l.productId, l.flashDealId, l.quantity - 1)}>
                  −
                </button>
                <span className="tabular w-8 text-center text-sm">{l.quantity}</span>
                <button type="button" className="h-9 w-9 text-secondary hover:text-primary" aria-label="Increase quantity" onClick={() => cart.setQuantity(l.productId, l.flashDealId, l.quantity + 1)}>
                  +
                </button>
              </div>
              <span className="tabular w-24 text-right font-semibold">{money(l.unitPriceCents * l.quantity)}</span>
              <button type="button" className="text-sm text-muted hover:text-conflict" onClick={() => cart.remove(l.productId, l.flashDealId)} aria-label={`Remove ${l.name}`}>
                Remove
              </button>
            </li>
          ))}
        </ul>

        {report ? (
          <div className={`flex flex-col gap-3 rounded-xl border p-5 ${blocked ? 'border-[#fecaca] bg-[#fef2f2]' : 'border-hairline bg-white'}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="font-semibold">Compatibility check</span>
              <TierBadge tier={report.overallConfidence} />
            </div>
            <p className="text-sm text-secondary">
              Estimated power use {report.estimatedBaseWattage} W · recommended power supply {report.recommendedPsuWattage} W
              {!report.isCompleteSystem ? ` · Not a complete PC yet (missing ${report.missingSlots.map((m) => m.toLowerCase().replace(/_/g, ' ')).join(', ')})` : ''}
            </p>
            {report.issues.length ? (
              <ul className="flex flex-col gap-2">
                {report.issues.map((i) => (
                  <li key={i.code + i.involvedSlots.join()} className={`tier-${i.tier} tier-border rounded-lg border-l-4 bg-white px-3 py-2`}>
                    <p className="text-sm font-medium">{i.title}</p>
                    <p className="text-sm text-secondary">{i.remediationSuggestion}</p>
                  </li>
                ))}
              </ul>
            ) : null}
            {report.requiresTechnicianManualVerify && isPro ? <p className="text-sm text-tolerance">Some parts are a tight fit — our technician will double-check them during assembly.</p> : null}
          </div>
        ) : null}
      </div>

      <aside className="flex flex-col gap-3 lg:sticky lg:top-[calc(var(--header-h)+20px)] lg:self-start">
        <div className="flex flex-col gap-4 rounded-xl border border-hairline bg-white p-5">
          <span className="text-lg font-semibold">Order summary</span>
          <QuoteLines quote={quote} showReasons />
          {!isPro && lines.some((l) => l.category === 'MOTHERBOARD') ? (
            <label className="flex items-start gap-2.5 text-sm text-secondary">
              <input type="checkbox" className="hud-check mt-0.5" checked={biosMandatory || cart.optInBios} disabled={biosMandatory} onChange={(e) => cart.setOptInBios(e.target.checked)} />
              <span>
                Update the motherboard BIOS before shipping (+{money(FEES.DIY_BIOS_PREFLASH_CENTS)})
                {biosMandatory ? <span className="block text-tolerance">Required — this board needs a BIOS update to run your processor.</span> : null}
              </span>
            </label>
          ) : null}
          <button type="button" className="btn-overclock w-full" onClick={lock} disabled={locking || blocked}>
            {blocked ? 'Fix compatibility issues to continue' : locking ? 'Reserving your items…' : 'Checkout'}
          </button>
          <p className="text-xs text-muted">We’ll hold your items and price for {FEES.RESERVATION_TTL_MINUTES} minutes while you check out.</p>
        </div>
        <button type="button" className="self-start text-sm text-muted hover:text-conflict" onClick={() => confirm('Remove everything from your cart?') && cart.clear()}>
          Clear cart
        </button>
      </aside>
    </div>
  );
}
