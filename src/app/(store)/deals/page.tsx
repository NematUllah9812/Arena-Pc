import type { Metadata } from 'next';
import { getRepo } from '@/lib/repo';
import { FlashDealBoard } from '@/components/deals/FlashDealBoard';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Flash Deals',
  description: 'Capped-quantity flash drops on overstock and leftover inventory. Atomic claim locking — if the counter says it is yours, it is yours.'
};

export default async function DealsPage() {
  const deals = await getRepo().listFlashDeals({ includeUpcoming: true });
  return (
    <div className="container-hud py-10 md:py-14">
      <header className="mb-10 grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
        <div className="flex flex-col gap-3">
          <span className="hud-eyebrow">LIQUIDATION // CAPPED CLAIMS</span>
          <h1 className="hud-title text-4xl md:text-6xl">
            Flash <span className="text-tungsten">Deals</span>
          </h1>
          <p className="max-w-2xl text-secondary">
            Overstock and leftover-bin SKUs at hard-capped quantities. Every claim is locked server-side with <code className="font-mono text-cryo">FOR UPDATE SKIP LOCKED</code> — no
            overselling, no &ldquo;sorry, it sold out after you paid&rdquo;.
          </p>
        </div>
        <ul className="grid grid-cols-3 gap-px border border-hairline bg-hairline text-center">
          {[
            ['10 MIN', 'Claim lock'],
            ['≥60%', 'Of cost floor'],
            ['0', 'Oversells']
          ].map(([v, l]) => (
            <li key={l} className="bg-chassis px-5 py-3">
              <p className="tabular text-lg text-tungsten">{v}</p>
              <p className="hud-label">{l}</p>
            </li>
          ))}
        </ul>
      </header>
      <FlashDealBoard initial={deals} />
    </div>
  );
}
