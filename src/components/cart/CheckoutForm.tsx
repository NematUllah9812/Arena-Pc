'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { COMPANY } from '@/lib/config/company';
import { estimateDispatchDate } from '@/lib/engine/pricing';
import { money } from '@/lib/format';
import { HudCard } from '@/components/hud/HudCard';
import { Countdown } from '@/components/hud/Countdown';
import { TierBadge } from '@/components/hud/Badges';
import { useToast } from '@/components/layout/Toasts';
import { playClick } from '@/components/layout/feedback';
import { QuoteLines } from './QuoteLines';
import { useCart } from './CartProvider';

const US_STATES = 'AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' ');

export function CheckoutForm() {
  const cart = useCart();
  const { push } = useToast();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<{ title: string; detail?: string; issues?: { code: string; title: string; remediation: string }[] } | null>(null);

  if (!cart.hydrated) return <div className="skeleton h-96" />;
  if (!cart.lines.length || !cart.lease) {
    return (
      <HudCard innerClassName="flex flex-col items-start gap-4 p-10">
        <span className="text-lg font-semibold">{cart.lines.length ? 'Your reservation expired' : 'Your cart is empty'}</span>
        <p className="text-secondary">
          {cart.lines.length ? 'We held your items for 10 minutes. Go back to your cart to reserve them again.' : 'Add something to your cart first.'}
        </p>
        <Link href={cart.lines.length ? '/cart' : '/catalog'} className="btn-overclock">
          {cart.lines.length ? 'Back to cart' : 'Shop parts'}
        </Link>
      </HudCard>
    );
  }

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const v = (k: string) => String(f.get(k) ?? '').trim();
    setSubmitting(true);
    setError(null);
    playClick('confirm');
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          customerEmail: v('email'),
          customerName: v('full_name'),
          shippingAddress: {
            full_name: v('full_name'),
            phone: v('phone'),
            line1: v('line1'),
            line2: v('line2'),
            city: v('city'),
            region: v('region'),
            postal_code: v('postal_code'),
            country: 'US'
          },
          fulfillmentMode: cart.mode,
          optInBiosPreflash: cart.optInBios,
          syndicatePackageSlug: cart.isPackageIntact ? cart.packageSlug : null
        })
      });
      const data = (await res.json()) as
        | { ok: true; order: { order_number: string } }
        | { ok: false; error: string; detail?: string; issues?: { code: string; title: string; remediation: string }[] };
      if (!data.ok) {
        playClick('error');
        setError({ title: data.error === 'RESERVATION_EXPIRED' ? 'Your reservation expired' : 'We couldn’t place your order', detail: data.detail, issues: data.issues });
        if (data.error === 'RESERVATION_EXPIRED') cart.setLease(null);
        return;
      }
      cart.clear();
      push({ title: `Order ${data.order.order_number} confirmed`, body: 'You can track it from your order page.' });
      router.push(`/telemetry/${data.order.order_number}?welcome=1`);
    } catch {
      setError({ title: 'Connection problem', detail: 'Your order was not placed. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  const isPro = cart.mode === 'PRO_BUILT_FOUNDRY_RIG';
  return (
    <form onSubmit={onSubmit} className="grid gap-8 lg:grid-cols-[1fr_400px]">
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#eff6ff] px-4 py-3">
          <span className="text-sm font-medium text-volt">Your items and prices are reserved</span>
          <span className="flex items-center gap-2 text-sm text-secondary">
            Time left <Countdown to={cart.lease.expiresAt} className="font-semibold text-volt" />
          </span>
        </div>

        <fieldset className="rounded-xl border border-hairline bg-white grid gap-4 p-5 sm:grid-cols-2">
          <legend className="px-1 text-base font-semibold text-primary">Contact</legend>
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-sm font-medium text-secondary">Full name</span>
            <input name="full_name" className="hud-input" required minLength={2} maxLength={160} autoComplete="name" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-secondary">Email</span>
            <input name="email" type="email" className="hud-input" required maxLength={255} autoComplete="email" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-secondary">Phone</span>
            <input name="phone" type="tel" className="hud-input" required minLength={7} maxLength={32} autoComplete="tel" />
          </label>
        </fieldset>

        <fieldset className="rounded-xl border border-hairline bg-white grid gap-4 p-5 sm:grid-cols-6">
          <legend className="px-1 text-base font-semibold text-primary">Shipping address (US only)</legend>
          <label className="flex flex-col gap-1.5 sm:col-span-6">
            <span className="text-sm font-medium text-secondary">Street address</span>
            <input name="line1" className="hud-input" required minLength={3} maxLength={200} autoComplete="address-line1" />
          </label>
          <label className="flex flex-col gap-1.5 sm:col-span-6">
            <span className="text-sm font-medium text-secondary">Apt / Suite (optional)</span>
            <input name="line2" className="hud-input" maxLength={200} autoComplete="address-line2" />
          </label>
          <label className="flex flex-col gap-1.5 sm:col-span-3">
            <span className="text-sm font-medium text-secondary">City</span>
            <input name="city" className="hud-input" required minLength={2} maxLength={100} autoComplete="address-level2" />
          </label>
          <label className="flex flex-col gap-1.5 sm:col-span-1">
            <span className="text-sm font-medium text-secondary">State</span>
            <select name="region" className="hud-select" required defaultValue="TX" autoComplete="address-level1">
              {US_STATES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-sm font-medium text-secondary">ZIP</span>
            <input name="postal_code" className="hud-input" required pattern="\d{5}(-\d{4})?" inputMode="numeric" autoComplete="postal-code" />
          </label>
        </fieldset>

        <fieldset className="rounded-xl border border-hairline bg-white flex flex-col gap-3 p-5">
          <legend className="px-1 text-base font-semibold text-primary">Payment</legend>
          <p className="text-sm text-secondary">
            Your order is confirmed right away. We&rsquo;ll email you a secure payment link, and {isPro ? 'assembly' : 'shipping'} starts once payment clears. Questions: <a className="text-volt hover:underline" href={`mailto:${COMPANY.contacts.support.email}`}>{COMPANY.contacts.support.email}</a>.
          </p>
          <label className="flex items-start gap-2.5 text-sm text-secondary">
            <input type="checkbox" className="hud-check mt-0.5" required />
            <span>I confirm my order and address are correct and agree to the Vortex Labs terms of sale and returns policy.</span>
          </label>
        </fieldset>

        {error ? (
          <div role="alert" className="rounded-xl border border-[#fecaca] bg-[#fef2f2] px-4 py-3">
            <p className="text-sm font-semibold text-conflict">{error.title}</p>
            {error.detail ? <p className="mt-1 text-sm text-secondary">{error.detail}</p> : null}
            {error.issues?.map((i) => (
              <p key={i.code} className="mt-1 text-xs text-secondary">
                {i.title} — {i.remediation}
              </p>
            ))}
            {error.title === 'Your reservation expired' ? (
              <Link href="/cart" className="btn-ghost size-sm mt-3">
                Back to cart
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>

      <aside className="flex flex-col gap-4 lg:sticky lg:top-[calc(var(--header-h)+20px)] lg:self-start">
        <HudCard innerClassName="flex flex-col gap-4 p-5">
          <div className="flex items-center justify-between">
            <span className="text-lg font-semibold">{isPro ? 'Built by us' : 'Parts only'}</span>
            {cart.report ? <TierBadge tier={cart.report.overallConfidence} compact /> : null}
          </div>
          <ul className="flex max-h-60 flex-col gap-2 overflow-y-auto border-b border-hairline pb-3 text-sm">
            {cart.lines.map((l) => {
              const locked = cart.lease?.lockedPrices[`${l.productId}:${l.flashDealId ?? ''}`] ?? l.unitPriceCents;
              return (
                <li key={`${l.productId}:${l.flashDealId ?? ''}`} className="flex justify-between gap-3">
                  <span className="truncate text-secondary">
                    {l.quantity}× {l.name}
                  </span>
                  <span className="tabular shrink-0">{money(locked * l.quantity)}</span>
                </li>
              );
            })}
          </ul>
          <QuoteLines quote={cart.quote} />
          <p className="text-xs text-muted">Estimated ship date: {estimateDispatchDate(cart.mode)}</p>
          <button type="submit" className="btn-overclock w-full" disabled={submitting}>
            {submitting ? 'Placing order…' : `Place order · ${money(cart.quote.totalCents)}`}
          </button>
        </HudCard>
      </aside>
    </form>
  );
}
