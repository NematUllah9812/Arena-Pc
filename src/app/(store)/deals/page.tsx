import type { Metadata } from 'next';
import { getRepo } from '@/lib/repo';
import { FlashDealBoard } from '@/components/deals/FlashDealBoard';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Deals',
  description: 'Limited-quantity deals on PC parts. When the counter says one is left for you, it is reserved for you.'
};

export default async function DealsPage() {
  const deals = await getRepo().listFlashDeals({ includeUpcoming: true });
  return (
    <div className="container-hud py-10">
      <header className="mb-8">
        <h1 className="hud-title text-3xl md:text-4xl">Deals</h1>
        <p className="mt-2 max-w-2xl text-secondary">
          Limited-quantity prices on selected parts. Adding a deal to your cart holds it for 10 minutes while you check out — no overselling.
        </p>
      </header>
      <FlashDealBoard initial={deals} />
    </div>
  );
}
