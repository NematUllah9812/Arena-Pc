import type { Metadata } from 'next';
import { getRepo } from '@/lib/repo';
import { ForgeBuilder } from '@/components/forge/ForgeBuilder';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Rig Forge — Custom PC Configurator',
  description: 'Configure a custom gaming PC with a 3-tier compatibility engine: socket, DDR generation, BIOS revision, GPU and radiator clearance, RAM/air-cooler interference and PSU transient headroom — verified live.'
};

export default async function ForgePage({ searchParams }: { searchParams: Promise<{ add?: string }> }) {
  const [{ add }, products] = await Promise.all([searchParams, getRepo().listProducts({ sort: 'price_asc' })]);
  return (
    <div className="container-hud py-10 md:py-14">
      <header className="mb-8 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
        <div className="flex flex-col gap-3">
          <span className="hud-eyebrow">RIG FORGE // COMPATIBILITY ENGINE V2</span>
          <h1 className="hud-title text-4xl md:text-6xl">
            Forge a <span className="text-volt">Rig</span>
          </h1>
          <p className="max-w-2xl text-secondary">
            Every candidate is pre-flighted against the parts you have already slotted — socket &amp; chipset, DDR generation, BIOS revision, physical clearance to the millimetre and PSU transient
            headroom. Green fits. Amber gets a technician&rsquo;s eyes. Red is blocked.
          </p>
        </div>
        <ul className="flex flex-wrap gap-2">
          <li className="badge badge-verified">Verified fit</li>
          <li className="badge badge-tolerance">Tight tolerance</li>
          <li className="badge badge-conflict">Hard conflict</li>
        </ul>
      </header>
      <ForgeBuilder products={products} initialAddId={add} />
    </div>
  );
}
