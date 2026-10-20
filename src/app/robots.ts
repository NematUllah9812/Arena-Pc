import type { MetadataRoute } from 'next';

// Ring 1 — zero public footprint: /admin is deliberately NOT listed here either.
export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://vortexlabs.gg';
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/', '/cart', '/checkout'] }],
    sitemap: `${base}/sitemap.xml`
  };
}
