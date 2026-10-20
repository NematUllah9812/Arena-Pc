import Link from 'next/link';
import { Suspense } from 'react';
import type { HardwareFacet, PartCategory, PublicProduct } from '@/lib/types';
import { CATEGORY_LABEL, CATEGORY_SLUG, PUBLIC_CATEGORIES } from '@/lib/format';
import { ProductCard } from '@/components/product/ProductCard';
import { CatalogFilters } from '@/components/product/CatalogFilters';

export function CatalogView({ products, facets, category, title, eyebrow }: { products: PublicProduct[]; facets: HardwareFacet[]; category?: PartCategory; title: string; eyebrow: string }) {
  return (
    <div className="container-hud py-10 md:py-14">
      <header className="mb-8 flex flex-col gap-3">
        <span className="hud-eyebrow">{eyebrow}</span>
        <h1 className="hud-title text-4xl md:text-6xl">{title}</h1>
      </header>
      <nav className="mb-8 flex gap-1.5 overflow-x-auto pb-2" aria-label="Categories">
        <Link href="/catalog" className={`btn-ghost size-sm ${!category ? 'is-active' : ''}`}>
          All
        </Link>
        {PUBLIC_CATEGORIES.map((c) => (
          <Link key={c} href={`/catalog/${CATEGORY_SLUG[c]}`} className={`btn-ghost size-sm ${category === c ? 'is-active' : ''}`}>
            {CATEGORY_LABEL[c]}
          </Link>
        ))}
      </nav>
      <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
        <div className="lg:sticky lg:top-[calc(var(--header-h)+24px)] lg:self-start">
          <Suspense fallback={<div className="skeleton h-96" />}>
            <CatalogFilters facets={facets} category={category} total={products.length} />
          </Suspense>
        </div>
        {products.length ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {products.map((p, i) => (
              <ProductCard key={p.id} product={p} priority={i < 4} />
            ))}
          </div>
        ) : (
          <div className="hud-panel chamfer flex flex-col items-start gap-3 p-10">
            <span className="hud-label">NO_MATCH</span>
            <p className="text-secondary">No SKUs match these filters. Loosen the constraints or reset.</p>
            <Link href={category ? `/catalog/${CATEGORY_SLUG[category as keyof typeof CATEGORY_SLUG]}` : '/catalog'} className="btn-ghost size-sm">
              Reset filters
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
