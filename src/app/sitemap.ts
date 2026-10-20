import type { MetadataRoute } from 'next';
import { getRepo } from '@/lib/repo';
import { CATEGORY_SLUG } from '@/lib/format';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://vortexlabs.gg';
  const repo = getRepo();
  const [products, packages] = await Promise.all([repo.listProducts({ limit: 500 }).catch(() => []), repo.listPackages().catch(() => [])]);
  const now = new Date();
  return [
    ...['', '/catalog', '/forge', '/syndicate', '/deals', '/telemetry', '/support'].map((p) => ({ url: `${base}${p}`, lastModified: now, changeFrequency: 'daily' as const, priority: p === '' ? 1 : 0.8 })),
    ...Object.values(CATEGORY_SLUG).map((s) => ({ url: `${base}/catalog/${s}`, lastModified: now, changeFrequency: 'daily' as const, priority: 0.7 })),
    ...packages.map((p) => ({ url: `${base}/syndicate/${p.slug}`, lastModified: now, priority: 0.8 })),
    ...products.map((p) => ({ url: `${base}/product/${p.slug}`, lastModified: new Date(p.updated_at), priority: 0.6 }))
  ];
}
