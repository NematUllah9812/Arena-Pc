import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { HudCard } from '@/components/hud/HudCard';
import { STAGES } from '@/lib/engine/build-bay';
import { BUILD_BAY_STAGES } from '@/lib/types';

export const metadata: Metadata = { title: 'Rig Forge Live — Build Telemetry', description: 'Track your rig through all seven Build Bay stages — from bin lock to OCCT burn-in to freight.' };

async function lookup(formData: FormData) {
  'use server';
  const raw = String(formData.get('order') ?? '').trim().toUpperCase();
  const n = /^\d+$/.test(raw) ? `VL-ORD-${raw}` : raw;
  redirect(`/telemetry/${encodeURIComponent(n)}`);
}

export default function TelemetryLookup() {
  return (
    <div className="container-hud py-10 md:py-14">
      <header className="mb-10 flex flex-col gap-3">
        <span className="hud-eyebrow">RIG FORGE LIVE // BUILD BAY TELEMETRY</span>
        <h1 className="hud-title text-4xl md:text-6xl">Track Your Rig</h1>
        <p className="max-w-2xl text-secondary">Every stage is logged by a named technician with hard evidence — serial scans, BIOS revisions, thermal curves and carrier sync.</p>
      </header>
      <div className="grid gap-8 lg:grid-cols-[420px_1fr]">
        <HudCard innerClassName="p-6">
          <form action={lookup} className="flex flex-col gap-4">
            <label className="flex flex-col gap-2">
              <span className="hud-label">Order number</span>
              <input name="order" className="hud-input tabular text-lg" placeholder="VL-ORD-88412" required pattern="(VL-ORD-)?\d{5,8}" />
            </label>
            <button type="submit" className="btn-overclock">
              Open Telemetry
            </button>
            <p className="font-mono text-[0.65rem] text-muted">
              Demo feed: <a href="/telemetry/VL-ORD-88412" className="text-cryo hover:underline">VL-ORD-88412</a> (burned-in, verified) ·{' '}
              <a href="/telemetry/VL-ORD-88397" className="text-cryo hover:underline">VL-ORD-88397</a> (dispatched)
            </p>
          </form>
        </HudCard>
        <ol className="grid gap-px border border-hairline bg-hairline sm:grid-cols-2">
          {BUILD_BAY_STAGES.filter((s) => s !== 'DELIVERED').map((s) => (
            <li key={s} className="bg-chassis p-4">
              <p className="tabular font-mono text-xs text-volt">STAGE {String(STAGES[s].index).padStart(2, '0')}</p>
              <p className="mt-1 font-display text-sm font-semibold tracking-wide uppercase">{STAGES[s].label}</p>
              <p className="mt-1 text-xs text-secondary">{STAGES[s].customerTelemetry}</p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
