'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { FlashDealWithProduct } from '@/lib/types';
import { money } from '@/lib/format';
import { Countdown } from '@/components/hud/Countdown';
import { ProductImage } from '@/components/hud/ProductImage';
import { useCart } from '@/components/cart/CartProvider';
import { useLiveDeals } from './useLiveDeals';

function DealCard({ deal, now }: { deal: FlashDealWithProduct; now: number | null }) {
  const { add } = useCart();
  const p = deal.product;
  const remaining = Math.max(0, deal.max_claims - deal.claimed_count - deal.reserved_claims);
  const upcoming = now != null && new Date(deal.starts_at).getTime() > now;
  const depleted = remaining === 0;
  const off = Math.round((1 - deal.deal_price_cents / p.base_price_cents) * 100);
  const claimedPct = Math.min(100, ((deal.claimed_count + deal.reserved_claims) / deal.max_claims) * 100);

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-[14px] border border-hairline bg-white">
      <Link href={`/product/${p.slug}`} className="relative block aspect-[4/3] bg-white">
        <ProductImage src={p.primary_image_url} alt={p.name} className="p-6" />
        <span className={`badge absolute top-3 left-3 ${upcoming ? 'badge-cryo' : 'badge-tungsten badge-solid'}`}>{upcoming ? 'Coming soon' : `Save ${off}%`}</span>
      </Link>
      <div className="flex flex-1 flex-col gap-3 border-t border-hairline p-5">
        <div>
          <p className="text-xs font-medium text-tungsten">{deal.deal_title}</p>
          <h3 className="mt-1 line-clamp-2 text-[0.95rem] leading-snug font-semibold">
            <Link href={`/product/${p.slug}`} className="hover:text-volt">
              {p.name}
            </Link>
          </h3>
        </div>
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="tabular text-2xl font-bold text-tungsten">{money(deal.deal_price_cents)}</p>
            <p className="tabular text-xs text-muted line-through">{money(p.base_price_cents)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted">{upcoming ? 'Starts in' : 'Ends in'}</p>
            <Countdown to={upcoming ? deal.starts_at : deal.expires_at} className="text-sm font-semibold text-primary" />
          </div>
        </div>
        <div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[#f3f4f6]">
            <div className="h-full rounded-full bg-tungsten" style={{ width: `${claimedPct}%` }} />
          </div>
          <p className="tabular mt-1.5 text-xs text-secondary">{depleted ? 'All claimed' : `${remaining} of ${deal.max_claims} left at this price`}</p>
        </div>
        <button
          type="button"
          className="btn-overclock tone-tungsten mt-auto w-full"
          disabled={upcoming || depleted || p.available_quantity <= 0}
          onClick={() => add(p, { flashDealId: deal.id, dealPriceCents: deal.deal_price_cents })}
        >
          {upcoming ? 'Not started yet' : depleted ? 'Sold out' : 'Add to cart'}
        </button>
      </div>
    </article>
  );
}

export function FlashDealBoard({ initial, limit }: { initial: FlashDealWithProduct[]; limit?: number }) {
  const { deals } = useLiveDeals(initial);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);
  const list = deals.filter((d) => d.is_active && (now == null || new Date(d.expires_at).getTime() > now)).slice(0, limit ?? deals.length);
  return list.length ? (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {list.map((d) => (
        <DealCard key={d.id} deal={d} now={now} />
      ))}
    </div>
  ) : (
    <p className="hud-panel p-8 text-secondary">No deals are running right now — check back soon.</p>
  );
}
