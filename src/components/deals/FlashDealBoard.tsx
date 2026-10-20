'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { FlashDealWithProduct } from '@/lib/types';
import { money } from '@/lib/format';
import { HudCard, Meter } from '@/components/hud/HudCard';
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
  const claimedPct = ((deal.claimed_count + deal.reserved_claims) / deal.max_claims) * 10;

  return (
    <HudCard as="article" tone={upcoming ? 'cryo' : 'tungsten'} innerClassName="flex h-full flex-col">
      <div className="relative aspect-[16/9] border-b border-hairline bg-void">
        <ProductImage src={p.primary_image_url} alt={p.name} className="opacity-80" />
        <div className="absolute inset-x-0 top-0 z-[1] flex items-center justify-between p-3">
          <span className={`badge badge-solid ${upcoming ? '' : 'badge-tungsten'}`} style={upcoming ? { background: 'var(--accent-cryo)' } : undefined}>
            {upcoming ? 'Incoming' : depleted ? 'Depleted' : 'Live'}
          </span>
          <span className="badge bg-void/85 text-tungsten" style={{ borderColor: deal.banner_accent_hex, color: deal.banner_accent_hex }}>
            −{off}%
          </span>
        </div>
      </div>
      <div className="relative z-[1] flex flex-1 flex-col gap-4 p-5">
        <div>
          <p className="font-mono text-[0.65rem] tracking-[0.16em] uppercase" style={{ color: deal.banner_accent_hex }}>
            {deal.deal_title}
          </p>
          <h3 className="mt-1 font-display text-lg leading-tight font-semibold">
            <Link href={`/product/${p.slug}`} className="hover:text-volt">
              {p.name}
            </Link>
          </h3>
        </div>
        <div className="flex items-end justify-between">
          <div>
            <p className="tabular text-xs text-muted line-through">{money(p.base_price_cents)}</p>
            <p className="tabular text-3xl font-bold text-tungsten">{money(deal.deal_price_cents)}</p>
          </div>
          <div className="text-right">
            <p className="hud-label">{upcoming ? 'Drops in' : 'Ends in'}</p>
            <Countdown to={upcoming ? deal.starts_at : deal.expires_at} className="text-xl text-primary" />
          </div>
        </div>
        <div>
          <div className="mb-1.5 flex justify-between">
            <span className="hud-label">Claimed</span>
            <span className="tabular text-xs text-secondary">
              {deal.claimed_count + deal.reserved_claims}/{deal.max_claims} · <span className={remaining <= 5 ? 'text-tungsten' : 'text-primary'}>{remaining} left</span>
            </span>
          </div>
          <Meter value={claimedPct} tone="tungsten" />
        </div>
        <button
          type="button"
          className="btn-overclock tone-tungsten mt-auto w-full"
          disabled={upcoming || depleted || p.available_quantity <= 0}
          onClick={() => add(p, { flashDealId: deal.id, dealPriceCents: deal.deal_price_cents })}
        >
          {upcoming ? 'Standby' : depleted ? 'All Claims Taken' : 'Claim at Deal Price'}
        </button>
      </div>
    </HudCard>
  );
}

export function FlashDealBoard({ initial, limit }: { initial: FlashDealWithProduct[]; limit?: number }) {
  const { deals, live } = useLiveDeals(initial);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);
  const list = deals.filter((d) => d.is_active && (now == null || new Date(d.expires_at).getTime() > now)).slice(0, limit ?? deals.length);
  return (
    <div>
      <div className="mb-4 flex items-center gap-2 font-mono text-[0.65rem] tracking-[0.14em] uppercase">
        <span className={`status-dot ${live === 'realtime' ? 'pulse anim-continuous text-verified' : 'text-tolerance'}`} />
        <span className="text-muted">{live === 'realtime' ? 'Supabase Realtime · live claim feed' : live === 'polling' ? 'Claim feed · 15s sync' : 'Connecting claim feed…'}</span>
      </div>
      {list.length ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {list.map((d) => (
            <DealCard key={d.id} deal={d} now={now} />
          ))}
        </div>
      ) : (
        <p className="hud-panel p-8 text-secondary">No drops are live right now. The next liquidation window opens soon — check back.</p>
      )}
    </div>
  );
}
