import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getRepo } from '@/lib/repo';
import { parseCatalogQuery } from '@/lib/catalog-query';
import { CATEGORY_LABEL, SLUG_CATEGORY } from '@/lib/format';
import { CatalogView } from '../CatalogView';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }): Promise<Metadata> {
  const { category } = await params;
  const cat = SLUG_CATEGORY[category];
  if (!cat) return {};
  return { title: CATEGORY_LABEL[cat], description: `Shop ${CATEGORY_LABEL[cat].toLowerCase()} with live stock, warehouse bin data and 3-tier compatibility verification.` };
}

export default async function CategoryPage({ params, searchParams }: { params: Promise<{ category: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ category }, sp] = await Promise.all([params, searchParams]);
  const cat = SLUG_CATEGORY[category];
  if (!cat) notFound();
  const repo = getRepo();
  const [products, facets] = await Promise.all([repo.listProducts(parseCatalogQuery(sp, cat)), repo.getFacets()]);
  return <CatalogView products={products} facets={facets} category={cat} title={CATEGORY_LABEL[cat]} eyebrow={`CATALOG // ${cat}`} page={Number(sp.page) || 1} searchParams={sp} />;
}
