import type { Metadata } from 'next';
import { getRepo } from '@/lib/repo';
import { parseCatalogQuery } from '@/lib/catalog-query';
import { CatalogView } from './CatalogView';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Component Catalog',
  description: 'Every CPU, GPU, motherboard, memory kit, cooler, chassis and PSU in the Vortex Labs foundry — live stock, warehouse bins and verified compatibility data.'
};

export default async function CatalogPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const repo = getRepo();
  const q = parseCatalogQuery(sp);
  const [products, facets] = await Promise.all([repo.listProducts(q), repo.getFacets()]);
  return <CatalogView products={products} facets={facets} title={q.q ? `Results: “${q.q}”` : 'Component Catalog'} eyebrow="INVENTORY // LIVE FROM AUSTIN HUB" page={Number(sp.page) || 1} searchParams={sp} />;
}
