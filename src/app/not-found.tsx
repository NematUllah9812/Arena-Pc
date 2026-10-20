import { SiteFooter } from '@/components/layout/SiteFooter';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { NotFoundContent } from '@/components/layout/NotFoundContent';

export const metadata = { title: '404 — Signal Lost', robots: { index: false } };

/** Global 404 for unmatched URLs. The /admin cloak rewrites to an unrouted path, so it renders exactly this. */
export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="main">
        <NotFoundContent />
      </main>
      <SiteFooter />
    </>
  );
}
