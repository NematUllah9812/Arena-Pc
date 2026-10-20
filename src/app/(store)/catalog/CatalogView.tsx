import Link from 'next/link';
import { Suspense } from 'react';
import type { HardwareFacet, PartCategory, PublicProduct } from '@/lib/types';
import { CATEGORY_LABEL, CATEGORY_SLUG, PUBLIC_CATEGORIES } from '@/lib/format';
import { ProductCard } from '@/components/product/ProductCard';
import { CatalogFilters } from '@/components/product/CatalogFilters';

export const PAGE_SIZE = 24;

export function CatalogView({
  products,
  facets,
  category,
  title,
  eyebrow,
  page,
  searchParams
}: {
  products: PublicProduct[];
  facets: HardwareFacet[];
  category?: PartCategory;
  title: string;
  eyebrow: string;
  page: number;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const pageCount = Math.max(1, Math.ceil(products.length / PAGE_SIZE));
  const current = Math.min(Math.max(1, page), pageCount);
  const visible = products.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const base = category ? `/catalog/${CATEGORY_SLUG[category as keyof typeof CATEGORY_SLUG]}` : '/catalog';
  const hrefFor = (n: number) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) if (k !== 'page' && typeof v === 'string' && v) qs.set(k, v);
    if (n > 1) qs.set('page', String(n));
    const q = qs.toString();
    return q ? `${base}?${q}` : base;
  };
  return (
    <div className="container-hud py-8 md:py-10">
      <nav className="mb-3 text-sm text-muted" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-volt">
          Home
        </Link>{' '}
        / <span className="text-secondary">{eyebrow}</span>
      </nav>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <h1 className="hud-title text-3xl md:text-4xl">{title}</h1>
        <p className="text-sm text-muted">
          {products.length} product{products.length === 1 ? '' : 's'}
        </p>
      </header>
      <nav className="no-scrollbar mb-8 flex gap-2 overflow-x-auto pb-1" aria-label="Categories">
        <Link href="/catalog" className={`chip ${!category ? 'is-active' : ''}`}>
          All
        </Link>
        {PUBLIC_CATEGORIES.map((c) => (
          <Link key={c} href={`/catalog/${CATEGORY_SLUG[c]}`} className={`chip ${category === c ? 'is-active' : ''}`}>
            {CATEGORY_LABEL[c]}
          </Link>
        ))}
      </nav>
      <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
        <div className="lg:sticky lg:top-[calc(var(--header-h)+24px)] lg:self-start">
          <Suspense fallback={<div className="skeleton h-96" />}>
            <CatalogFilters facets={facets} category={category} total={products.length} />
          </Suspense>
        </div>
        {products.length ? (
          <div className="flex flex-col gap-8">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              {visible.map((p, i) => (
                <ProductCard key={p.id} product={p} priority={i < 4} />
              ))}
            </div>
            {pageCount > 1 ? (
              <nav className="flex flex-wrap items-center gap-1.5" aria-label="Pagination">
                {current > 1 ? (
                  <Link href={hrefFor(current - 1)} className="btn-ghost size-sm" rel="prev">
                    ‹ Previous
                  </Link>
                ) : null}
                {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
                  <Link key={n} href={hrefFor(n)} className={`btn-ghost size-sm tabular ${n === current ? 'is-active' : ''}`} aria-current={n === current ? 'page' : undefined}>
                    {n}
                  </Link>
                ))}
                {current < pageCount ? (
                  <Link href={hrefFor(current + 1)} className="btn-ghost size-sm" rel="next">
                    Next ›
                  </Link>
                ) : null}
                <span className="hud-label ml-2">
                  {(current - 1) * PAGE_SIZE + 1}–{Math.min(current * PAGE_SIZE, products.length)} of {products.length}
                </span>
              </nav>
            ) : null}
          </div>
        ) : (
          <div className="hud-panel flex flex-col items-start gap-3 p-10">
            <p className="font-semibold">No products found</p>
            <p className="text-secondary">Try removing a filter or searching for something else.</p>
            <Link href={category ? `/catalog/${CATEGORY_SLUG[category as keyof typeof CATEGORY_SLUG]}` : '/catalog'} className="btn-ghost size-sm">
              Reset filters
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
