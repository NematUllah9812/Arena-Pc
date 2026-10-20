import { DealTicker } from '@/components/layout/DealTicker';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { SiteHeader } from '@/components/layout/SiteHeader';

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DealTicker />
      <SiteHeader />
      <main id="main">{children}</main>
      <SiteFooter />
    </>
  );
}
