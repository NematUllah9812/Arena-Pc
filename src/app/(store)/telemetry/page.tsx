import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { STAGES } from '@/lib/engine/build-bay';
import { BUILD_BAY_STAGES } from '@/lib/types';

export const metadata: Metadata = { title: 'Track your order', description: 'See where your order is — from picking parts to assembly, testing and shipping.' };

async function lookup(formData: FormData) {
  'use server';
  const raw = String(formData.get('order') ?? '').trim().toUpperCase();
  const n = /^\d+$/.test(raw) ? `VL-ORD-${raw}` : raw;
  redirect(`/telemetry/${encodeURIComponent(n)}`);
}

export default function TelemetryLookup() {
  return (
    <div className="container-hud py-10">
      <header className="mb-8">
        <h1 className="hud-title text-3xl md:text-4xl">Track your order</h1>
        <p className="mt-2 max-w-2xl text-secondary">Enter your order number to see where it is — from picking parts to assembly, testing and shipping.</p>
      </header>
      <div className="grid gap-8 lg:grid-cols-[420px_1fr]">
        <div className="hud-card p-6">
          <form action={lookup} className="flex flex-col gap-4">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-secondary">Order number</span>
              <input name="order" className="hud-input tabular text-lg" placeholder="VL-ORD-88412" required pattern="(VL-ORD-)?\d{5,8}" />
            </label>
            <button type="submit" className="btn-overclock">
              Track order
            </button>
            <p className="text-xs text-muted">
              Example orders: <a href="/telemetry/VL-ORD-88412" className="text-volt hover:underline">VL-ORD-88412</a> (being tested) ·{' '}
              <a href="/telemetry/VL-ORD-88397" className="text-volt hover:underline">VL-ORD-88397</a> (shipped)
            </p>
          </form>
        </div>
        <ol className="grid gap-3 sm:grid-cols-2">
          {BUILD_BAY_STAGES.filter((s) => s !== 'DELIVERED').map((s) => (
            <li key={s} className="flex gap-3 rounded-xl border border-hairline bg-white p-4">
              <span className="tabular grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#eff6ff] text-sm font-semibold text-volt">{STAGES[s].index}</span>
              <div>
                <p className="text-sm font-semibold">{STAGES[s].label}</p>
                <p className="mt-1 text-sm text-secondary">{STAGES[s].customerTelemetry}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
