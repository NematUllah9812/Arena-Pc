import Link from 'next/link';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { SiteHeader } from '@/components/layout/SiteHeader';

export const metadata = { title: '404 — Signal Lost', robots: { index: false } };

/** Standard storefront 404. The /admin cloak rewrites here so the vault is indistinguishable from a dead route. */
export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="container-hud flex min-h-[70vh] flex-col items-start justify-center gap-6 py-24">
        <span className="hud-eyebrow">ERR_404 // ROUTE_NOT_FOUND</span>
        <h1 className="hud-title glitch text-6xl md:text-8xl">
          Signal <span className="text-tungsten">Lost</span>
        </h1>
        <p className="max-w-lg text-secondary">The coordinates you requested don&apos;t resolve to any bay in the foundry. The part may have been retired, or the link was mistyped.</p>
        <div className="flex flex-wrap gap-3">
          <Link href="/" className="btn-overclock">
            Return to Base
          </Link>
          <Link href="/catalog" className="btn-ghost">
            Browse Catalog
          </Link>
        </div>
        <pre className="mt-6 font-mono text-[0.65rem] leading-relaxed text-muted" aria-hidden>
{`> trace --route
  hop 01  edge.vortexlabs.gg     OK
  hop 02  foundry.austin.tx      OK
  hop 03  ????????               TIMEOUT`}
        </pre>
      </main>
      <SiteFooter />
    </>
  );
}
