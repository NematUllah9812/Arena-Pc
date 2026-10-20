import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getRepo } from '@/lib/repo';
import { COMPANY, FEES } from '@/lib/config/company';
import { CATEGORY_CODE, CATEGORY_LABEL, CATEGORY_SLUG, money, specLabel, specValue } from '@/lib/format';
import { HudCard, Meter } from '@/components/hud/HudCard';
import { StockBadge } from '@/components/hud/Badges';
import { ProductImage } from '@/components/hud/ProductImage';
import { AddToCartButton } from '@/components/cart/AddToCartButton';
import { ProductCard } from '@/components/product/ProductCard';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = await getRepo().getProductBySlug(slug);
  if (!p) return { title: 'Not found' };
  return {
    title: p.name,
    description: p.description ?? `${p.name} — ${CATEGORY_LABEL[p.category]} at Vortex Labs.`,
    openGraph: { images: [{ url: p.primary_image_url }] }
  };
}

const HIDDEN_SPECS = new Set(['supported_sockets']);

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const repo = getRepo();
  const p = await repo.getProductBySlug(slug);
  if (!p) notFound();
  const [related, deals] = await Promise.all([repo.listProducts({ category: p.category, inStockOnly: true, sort: 'featured' }), repo.listFlashDeals()]);
  const deal = deals.find((d) => d.product_id === p.id);
  const price = p.sale_price_cents ?? p.base_price_cents;
  const onSale = p.sale_price_cents != null && p.sale_price_cents < p.base_price_cents;
  const specs = Object.entries(p.specs).filter(([k]) => !HIDDEN_SPECS.has(k));
  const sockets = p.specs.supported_sockets as string[] | undefined;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    sku: p.sku,
    brand: { '@type': 'Brand', name: p.brand },
    description: p.description,
    image: p.primary_image_url,
    offers: {
      '@type': 'Offer',
      priceCurrency: 'USD',
      price: (price / 100).toFixed(2),
      availability: p.available_quantity > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      seller: { '@type': 'Organization', name: COMPANY.legalName }
    }
  };

  return (
    <div className="container-hud py-10 md:py-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <nav className="mb-6 flex flex-wrap items-center gap-2 font-mono text-[0.65rem] tracking-[0.14em] text-muted uppercase" aria-label="Breadcrumb">
        <Link href="/catalog" className="hover:text-volt">
          Catalog
        </Link>
        <span>/</span>
        <Link href={`/catalog/${CATEGORY_SLUG[p.category as keyof typeof CATEGORY_SLUG]}`} className="hover:text-volt">
          {CATEGORY_LABEL[p.category]}
        </Link>
        <span>/</span>
        <span className="text-secondary">{p.sku}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr]">
        <div className="flex flex-col gap-4">
          <HudCard innerClassName="relative aspect-[4/3] bg-void">
            <ProductImage src={p.primary_image_url} alt={p.name} priority sizes="(max-width: 1024px) 100vw, 55vw" />
            <div className="absolute top-4 left-4 z-[1] flex gap-2">
              <span className="badge badge-muted bg-void/80">{CATEGORY_CODE[p.category]}</span>
              {p.specs.lithography ? <span className="badge badge-cryo bg-void/80">{String(p.specs.lithography)}</span> : null}
            </div>
            <div className="absolute right-4 bottom-4 z-[1] font-mono text-[0.6rem] tracking-[0.2em] text-muted">SCHEMATIC // {p.sku}</div>
          </HudCard>
          <div className="grid grid-cols-3 gap-px border border-hairline bg-hairline">
            {[
              ['Perf Index', p.performance_score.toLocaleString()],
              ['Mass', `${p.weight_grams.toLocaleString()} g`],
              ['TDP', p.tdp_watts ? `${p.tdp_watts} W` : '—']
            ].map(([l, v]) => (
              <div key={l} className="bg-chassis p-4">
                <p className="hud-label">{l}</p>
                <p className="tabular mt-1 text-lg">{v}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div>
            <p className="hud-label">
              {p.brand} · SKU {p.sku}
            </p>
            <h1 className="hud-title mt-2 text-3xl md:text-5xl">{p.name}</h1>
            {p.description ? <p className="mt-4 leading-relaxed text-secondary">{p.description}</p> : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <StockBadge available={p.available_quantity} bin={p.warehouse_bin} />
            {p.is_leftover_clearance ? <span className="badge badge-tungsten">Leftover Clearance</span> : null}
            {p.overstock_priority ? <span className="badge badge-cryo">Overstock Priority</span> : null}
          </div>

          <div className="hud-panel chamfer flex flex-col gap-5 p-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                {onSale ? <p className="tabular text-sm text-muted line-through">{money(p.base_price_cents)}</p> : null}
                <p className={`tabular text-4xl font-bold ${onSale ? 'text-tungsten' : ''}`}>{money(price)}</p>
                <p className="mt-1 font-mono text-[0.65rem] text-muted">Free insured freight · Price locks for {FEES.RESERVATION_TTL_MINUTES} min at checkout</p>
              </div>
              <div className="w-40">
                <p className="hud-label mb-1.5">Perf Tier</p>
                <Meter value={Math.round(p.performance_score / 1000)} />
              </div>
            </div>
            {deal ? (
              <div className="flex flex-wrap items-center justify-between gap-3 border border-tungsten/50 bg-tungsten/5 p-4">
                <div>
                  <p className="font-mono text-[0.65rem] tracking-[0.14em] text-tungsten uppercase">Flash deal live · {deal.deal_title}</p>
                  <p className="tabular text-2xl font-bold text-tungsten">{money(deal.deal_price_cents)}</p>
                  <p className="hud-label">
                    {deal.max_claims - deal.claimed_count - deal.reserved_claims} of {deal.max_claims} claims left
                  </p>
                </div>
                <AddToCartButton product={p} flashDealId={deal.id} dealPriceCents={deal.deal_price_cents} label="Claim Deal" tone="tungsten" />
              </div>
            ) : null}
            <div className="flex flex-wrap gap-3">
              <AddToCartButton product={p} />
              <Link href={`/forge?add=${p.id}`} className="btn-ghost">
                Send to Rig Forge
              </Link>
            </div>
          </div>

          <section aria-labelledby="specs-h">
            <h2 id="specs-h" className="hud-eyebrow mb-3">
              Hardware Specification Schematic
            </h2>
            <table className="spec-table">
              <tbody>
                {specs.map(([k, v]) => (
                  <tr key={k}>
                    <th scope="row">{specLabel(k)}</th>
                    <td>{specValue(k, v)}</td>
                  </tr>
                ))}
                {sockets ? (
                  <tr>
                    <th scope="row">Sockets</th>
                    <td>{sockets.join(' / ')}</td>
                  </tr>
                ) : null}
                <tr>
                  <th scope="row">Warehouse Bin</th>
                  <td>BIN #{p.warehouse_bin} · Austin US-CENTRAL</td>
                </tr>
              </tbody>
            </table>
          </section>
        </div>
      </div>

      {related.filter((r) => r.id !== p.id).length ? (
        <section className="mt-20">
          <div className="mb-6 flex items-end justify-between">
            <h2 className="hud-title text-2xl md:text-3xl">Adjacent SKUs</h2>
            <Link href={`/catalog/${CATEGORY_SLUG[p.category as keyof typeof CATEGORY_SLUG]}`} className="hud-label hover:text-volt">
              All {CATEGORY_LABEL[p.category]} →
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {related
              .filter((r) => r.id !== p.id)
              .slice(0, 4)
              .map((r) => (
                <ProductCard key={r.id} product={r} />
              ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
