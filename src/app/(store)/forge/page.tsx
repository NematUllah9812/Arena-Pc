import type { Metadata } from 'next';
import { getRepo } from '@/lib/repo';
import { ForgeBuilder } from '@/components/forge/ForgeBuilder';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'PC Builder',
  description: 'Build a custom gaming PC part by part. We check compatibility live — socket, memory, case clearance and power supply.'
};

export default async function ForgePage({ searchParams }: { searchParams: Promise<{ add?: string }> }) {
  const [{ add }, products] = await Promise.all([searchParams, getRepo().listProducts({ sort: 'price_asc' })]);
  return (
    <div className="container-hud py-10">
      <header className="mb-8">
        <h1 className="hud-title text-3xl md:text-4xl">PC Builder</h1>
        <p className="mt-2 max-w-2xl text-secondary">
          Choose each part and we&rsquo;ll check that everything fits and works together — from the processor socket to the case size and power supply.
        </p>
      </header>
      <ForgeBuilder products={products} initialAddId={add} />
    </div>
  );
}
