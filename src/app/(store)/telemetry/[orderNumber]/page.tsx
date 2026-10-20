import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPublicTelemetry } from '@/lib/services/telemetry';
import { STAGES } from '@/lib/engine/build-bay';
import { TelemetryTracker } from '@/components/telemetry/TelemetryTracker';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ orderNumber: string }> }): Promise<Metadata> {
  const { orderNumber } = await params;
  return { title: `Telemetry ${orderNumber.toUpperCase()}`, robots: { index: false, follow: false } };
}

export default async function TelemetryPage({ params, searchParams }: { params: Promise<{ orderNumber: string }>; searchParams: Promise<{ welcome?: string }> }) {
  const [{ orderNumber }, sp] = await Promise.all([params, searchParams]);
  const view = await getPublicTelemetry(decodeURIComponent(orderNumber));
  if (!view) notFound();
  return (
    <div className="container-hud py-10 md:py-14">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-3">
          <span className="hud-eyebrow">RIG FORGE LIVE // {STAGES[view.current_stage].label.toUpperCase()}</span>
          <h1 className="hud-title tabular text-4xl md:text-6xl">{view.order_number}</h1>
        </div>
      </header>
      <TelemetryTracker initial={view} welcome={sp.welcome === '1'} />
    </div>
  );
}
