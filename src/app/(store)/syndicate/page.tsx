import type { Metadata } from 'next';
import { getRepo } from '@/lib/repo';
import { FEES } from '@/lib/config/company';
import { money } from '@/lib/format';
import { PackageCard } from '@/components/product/PackageCard';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Prebuilt Gaming PCs',
  description: 'Ready-made gaming PCs with tested part combinations. Professional assembly and a 4-hour stress test are included free.'
};

export default async function SyndicatePage() {
  const packages = await getRepo().listPackages();
  return (
    <div className="container-hud py-10">
      <header className="mb-8">
        <h1 className="hud-title text-3xl md:text-4xl">Prebuilt gaming PCs</h1>
        <p className="mt-2 max-w-2xl text-secondary">
          Every part combination is tested to work together. Assembly ({money(FEES.PRO_BUILT_ASSEMBLY_CENTS)} value), cable management and a 4-hour stress test are included free.
        </p>
      </header>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {packages.map((p) => (
          <PackageCard key={p.id} pkg={p} />
        ))}
      </div>
    </div>
  );
}
