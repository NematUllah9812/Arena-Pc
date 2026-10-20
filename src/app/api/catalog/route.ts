import { getRepo } from '@/lib/repo';
import { parseCatalogQuery } from '@/lib/catalog-query';
import { SLUG_CATEGORY } from '@/lib/format';
import { json, limit } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const limited = await limit(req, 'catalog', 120, 60);
  if (limited) return limited;
  const url = new URL(req.url);
  const sp = Object.fromEntries(url.searchParams.entries());
  const cat = sp.category ? SLUG_CATEGORY[sp.category] ?? (sp.category.toUpperCase() as never) : undefined;
  const products = await getRepo().listProducts(parseCatalogQuery(sp, cat));
  return json({ ok: true, count: products.length, products });
}
