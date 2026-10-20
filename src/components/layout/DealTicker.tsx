import Link from 'next/link';
import { getRepo } from '@/lib/repo';
import { money } from '@/lib/format';

export async function DealTicker() {
  let deals: Awaited<ReturnType<ReturnType<typeof getRepo>['listFlashDeals']>> = [];
  try {
    deals = await getRepo().listFlashDeals();
  } catch {
    deals = [];
  }
  if (!deals.length) return null;
  const items = deals.map((d) => (
    <Link key={d.id} href="/deals" className="inline-flex items-center gap-3 font-mono text-[0.68rem] tracking-[0.12em] uppercase">
      <span className="badge badge-tungsten badge-solid">FLASH</span>
      <span className="text-primary">{d.deal_title}</span>
      <span className="text-tungsten tabular">{money(d.deal_price_cents)}</span>
      <span className="text-muted tabular">
        {d.max_claims - d.claimed_count - d.reserved_claims}/{d.max_claims} UNCLAIMED
      </span>
    </Link>
  ));
  return (
    <div className="ticker" aria-label="Live flash deals">
      <div className="ticker-track anim-continuous">
        {items}
        <span aria-hidden className="contents">
          {items}
        </span>
      </div>
    </div>
  );
}
