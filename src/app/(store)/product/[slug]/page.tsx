import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getRepo } from '@/lib/repo';
import { COMPANY, FEES } from '@/lib/config/company';
import { CATEGORY_LABEL, CATEGORY_SLUG, money, specLabel, specValue } from '@/lib/format';
import { StockBadge } from '@/components/hud/Badges';
import { AddToCartButton } from '@/components/cart/AddToCartButton';
import { ProductCard } from '@/components/product/ProductCard';
import { ProductGallery } from '@/components/product/ProductGallery';
import { keySpecs } from '@/components/product/key-specs';
import { CheckIcon, ShieldIcon, TruckIcon, WrenchIcon } from '@/components/ui/Icons';

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
  const highlights = keySpecs(p.category, p.specs, 5);
  const catSlug = CATEGORY_SLUG[p.category as keyof typeof CATEGORY_SLUG];
  const others = related.filter((r) => r.id !== p.id).slice(0, 4);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    sku: p.sku,
    brand: { '@type': 'Brand', name: p.brand },
    description: p.description,
    image: [p.primary_image_url, ...(p.gallery_urls ?? [])],
    offers: {
      '@type': 'Offer',
      priceCurrency: 'USD',
      price: (price / 100).toFixed(2),
      availability: p.available_quantity > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      seller: { '@type': 'Organization', name: COMPANY.legalName }
    }
  };

  return (
    <div className="container-hud py-8 md:py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <nav className="mb-6 flex flex-wrap items-center gap-1.5 text-sm text-muted" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-volt">
          Home
        </Link>
        <span>/</span>
        {catSlug ? (
          <Link href={`/catalog/${catSlug}`} className="hover:text-volt">
            {CATEGORY_LABEL[p.category]}
          </Link>
        ) : (
          <span>{CATEGORY_LABEL[p.category]}</span>
        )}
        <span>/</span>
        <span className="line-clamp-1 text-secondary">{p.name}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-2">
        <ProductGallery images={[p.primary_image_url, ...(p.gallery_urls ?? [])]} alt={p.name} />

        <div className="flex flex-col gap-5">
          <div>
            <p className="text-sm font-medium text-volt">{p.brand}</p>
            <h1 className="hud-title mt-1 text-2xl md:text-3xl">{p.name}</h1>
            <p className="mt-1 text-sm text-muted">SKU {p.sku}</p>
          </div>

          <div className="flex flex-wrap items-baseline gap-3">
            <p className={`tabular text-3xl font-bold ${onSale ? 'text-tungsten' : 'text-primary'}`}>{money(price)}</p>
            {onSale ? (
              <>
                <p className="tabular text-muted line-through">{money(p.base_price_cents)}</p>
                <span className="badge badge-tungsten">Save {money(p.base_price_cents - price)}</span>
              </>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <StockBadge available={p.available_quantity} />
            {p.is_leftover_clearance ? <span className="badge badge-tungsten">Clearance</span> : null}
          </div>

          {highlights.length ? (
            <ul className="space-y-1.5 text-[0.95rem] text-secondary">
              {highlights.map((h) => (
                <li key={h.label} className="flex gap-2">
                  <CheckIcon size={18} className="mt-0.5 shrink-0 text-verified" />
                  <span>
                    <span className="text-primary">{h.label}:</span> {h.value}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          {deal ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#fecaca] bg-[#fef2f2] p-4">
              <div>
                <p className="text-sm font-semibold text-tungsten">Deal: {deal.deal_title}</p>
                <p className="tabular text-2xl font-bold text-tungsten">{money(deal.deal_price_cents)}</p>
                <p className="text-xs text-secondary">
                  {deal.max_claims - deal.claimed_count - deal.reserved_claims} of {deal.max_claims} left at this price
                </p>
              </div>
              <AddToCartButton product={p} flashDealId={deal.id} dealPriceCents={deal.deal_price_cents} label="Get this deal" tone="tungsten" />
            </div>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex-1">
              <AddToCartButton product={p} block />
            </div>
            <Link href={`/forge?add=${p.id}`} className="btn-ghost flex-1">
              Add to a PC build
            </Link>
          </div>

          <ul className="grid gap-3 rounded-xl bg-chassis p-4 text-sm text-secondary sm:grid-cols-3">
            <li className="flex items-center gap-2">
              <TruckIcon size={18} className="text-volt" /> Free insured shipping
            </li>
            <li className="flex items-center gap-2">
              <ShieldIcon size={18} className="text-volt" /> Compatibility checked
            </li>
            <li className="flex items-center gap-2">
              <WrenchIcon size={18} className="text-volt" /> Pro assembly {money(FEES.PRO_BUILT_ASSEMBLY_CENTS)}
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-12 grid gap-10 lg:grid-cols-2">
        {p.description ? (
          <section>
            <h2 className="mb-3 text-xl font-semibold">Overview</h2>
            <p className="leading-relaxed text-secondary">{p.description}</p>
          </section>
        ) : null}
        <section aria-labelledby="specs-h" className={p.description ? '' : 'lg:col-span-2'}>
          <h2 id="specs-h" className="mb-3 text-xl font-semibold">
            Specifications
          </h2>
          <div className="overflow-hidden rounded-xl border border-hairline">
            <table className="spec-table">
              <tbody>
                <tr>
                  <th scope="row">Brand</th>
                  <td>{p.brand}</td>
                </tr>
                {specs.map(([k, v]) => (
                  <tr key={k}>
                    <th scope="row">{specLabel(k)}</th>
                    <td>{specValue(k, v)}</td>
                  </tr>
                ))}
                {sockets ? (
                  <tr>
                    <th scope="row">Supported sockets</th>
                    <td>{sockets.join(', ')}</td>
                  </tr>
                ) : null}
                {p.weight_grams ? (
                  <tr>
                    <th scope="row">Weight</th>
                    <td>{p.weight_grams.toLocaleString()} g</td>
                  </tr>
                ) : null}
                {p.tdp_watts ? (
                  <tr>
                    <th scope="row">Power (TDP)</th>
                    <td>{p.tdp_watts} W</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {others.length ? (
        <section className="mt-16">
          <div className="mb-5 flex items-end justify-between">
            <h2 className="text-xl font-semibold">You might also like</h2>
            {catSlug ? (
              <Link href={`/catalog/${catSlug}`} className="text-sm font-medium text-volt hover:underline">
                All {CATEGORY_LABEL[p.category].toLowerCase()} ›
              </Link>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {others.map((r) => (
              <ProductCard key={r.id} product={r} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
