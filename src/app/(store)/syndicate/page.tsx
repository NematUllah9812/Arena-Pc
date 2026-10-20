import type { Metadata } from 'next';
import { getRepo } from '@/lib/repo';
import { FEES } from '@/lib/config/company';
import { money } from '@/lib/format';
import { PackageCard } from '@/components/product/PackageCard';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Syndicate Package Rigs',
  description: 'Foundry-validated turnkey gaming rigs. Every Syndicate Package ships with the $149 Pro-Built assembly, cable routing, BIOS/EXPO tuning and 72-hour stress test included free.'
};

export default async function SyndicatePage() {
  const packages = await getRepo().listPackages();
  return (
    <div className="container-hud py-10 md:py-14">
      <header className="mb-10 flex flex-col gap-3">
        <span className="hud-eyebrow">SYNDICATE PACKAGE OFFERS // FOUNDRY VALIDATED</span>
        <h1 className="hud-title text-4xl md:text-6xl">Syndicate Rigs</h1>
        <p className="max-w-2xl text-secondary">
          Pre-validated bills of materials — every component pair cleared by the compatibility engine at <span className="text-verified">VERIFIED_FIT</span> or flagged tolerance-checked.
          The {money(FEES.PRO_BUILT_ASSEMBLY_CENTS)} Foundry assembly fee is <span className="text-volt">waived</span>.
        </p>
      </header>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        {packages.map((p) => (
          <PackageCard key={p.id} pkg={p} />
        ))}
      </div>
    </div>
  );
}
