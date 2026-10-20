import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPublicTelemetry } from '@/lib/services/telemetry';
import { STAGES } from '@/lib/engine/build-bay';
import { TelemetryTracker } from '@/components/telemetry/TelemetryTracker';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ orderNumber: string }> }): Promise<Metadata> {
  const { orderNumber } = await params;
  return { title: `Order ${orderNumber.toUpperCase()}`, robots: { index: false, follow: false } };
}

export default async function TelemetryPage({ params, searchParams }: { params: Promise<{ orderNumber: string }>; searchParams: Promise<{ welcome?: string }> }) {
  const [{ orderNumber }, sp] = await Promise.all([params, searchParams]);
  const view = await getPublicTelemetry(decodeURIComponent(orderNumber));
  if (!view) notFound();
  return (
    <div className="container-hud py-10">
      <header className="mb-8">
        <p className="text-sm text-muted">Order status · {STAGES[view.current_stage].label}</p>
        <h1 className="hud-title tabular mt-1 text-3xl md:text-4xl">Order {view.order_number}</h1>
      </header>
      <TelemetryTracker initial={view} welcome={sp.welcome === '1'} />
    </div>
  );
}
