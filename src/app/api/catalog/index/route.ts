import { getRepo } from '@/lib/repo';
import type { IndexEntry } from '@/components/search/search.worker';

export const revalidate = 300;

/** Compact search index consumed by the Web Worker trie (Ctrl+K palette). */
export async function GET() {
  const products = await getRepo().listProducts({ sort: 'featured' });
  const entries: IndexEntry[] = products.map((p) => ({
    id: p.id,
    n: p.name,
    b: p.brand,
    s: p.sku,
    c: p.category,
    slug: p.slug,
    p: p.sale_price_cents ?? p.base_price_cents,
    img: p.primary_image_url,
    k: Object.entries(p.specs)
      .filter(([, v]) => typeof v === 'string' || typeof v === 'number')
      .map(([, v]) => String(v))
      .join(' ')
      .slice(0, 400)
  }));
  return Response.json({ entries }, { headers: { 'cache-control': 'public, s-maxage=300, stale-while-revalidate=600' } });
}
