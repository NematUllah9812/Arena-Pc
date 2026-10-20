import { NotFoundContent } from '@/components/layout/NotFoundContent';

export const metadata = { title: '404 — Signal Lost', robots: { index: false } };

/** notFound() inside storefront pages — the (store) layout already supplies header/footer. */
export default function StoreNotFound() {
  return <NotFoundContent />;
}
