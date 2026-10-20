import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPublicTelemetry } from '@/lib/services/telemetry';
import { STAGES } from '@/lib/engine/build-bay';
import { COMPANY } from '@/lib/config/company';
import { CATEGORY_LABEL, formatDate, formatDateTime, money } from '@/lib/format';
import { ThermalCurve } from '@/components/telemetry/ThermalCurve';
import { PrintButton } from './PrintButton';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'System Blueprint', robots: { index: false } };

export default async function BlueprintPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;
  const v = await getPublicTelemetry(decodeURIComponent(orderNumber));
  if (!v) notFound();
  const burn = v.logs.filter((l) => l.stage === 'OCCT_THERMAL_BURN_IN_4HR').at(-1);
  const bios = v.logs.filter((l) => l.stage === 'BIOS_FLASH_AND_EXPO_TUNING').at(-1);
  const serials = Object.assign({}, ...v.logs.map((l) => l.telemetry_metrics.serials ?? {})) as Record<string, string>;
  const c = v.manifest.compatibility;

  return (
    <div className="container-hud max-w-4xl py-10 print:max-w-none print:py-0">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <a href={`/telemetry/${v.order_number}`} className="hud-label hover:text-volt">
          ← Back to telemetry
        </a>
        <PrintButton />
      </div>
      <article className="blueprint hud-panel p-8 print:border-0 print:p-0">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b border-hairline pb-6">
          <div>
            <p className="font-mono text-xs tracking-[0.2em] text-volt">{COMPANY.fullBrand}</p>
            <h1 className="hud-title mt-2 text-3xl">System Blueprint</h1>
            <p className="tabular mt-1 font-mono text-sm">{v.order_number}</p>
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1 font-mono text-xs">
            <dt className="text-muted">Issued</dt>
            <dd>{formatDate(v.created_at)}</dd>
            <dt className="text-muted">Mode</dt>
            <dd>{v.fulfillment_type === 'PRO_BUILT_FOUNDRY_RIG' ? 'Pro-Built Foundry Rig' : 'DIY Component Kit'}</dd>
            <dt className="text-muted">Technician</dt>
            <dd>{v.assigned_technician_code ?? '—'}</dd>
            <dt className="text-muted">Confidence</dt>
            <dd>{v.compatibility_confidence.replace('_', ' ')}</dd>
          </dl>
        </header>

        <section className="py-6">
          <h2 className="hud-eyebrow mb-3">Bill of Materials</h2>
          <table className="spec-table">
            <thead>
              <tr>
                <th>Slot</th>
                <th>Component</th>
                <th>SKU</th>
                <th>Serial</th>
                <th className="text-right">Qty</th>
              </tr>
            </thead>
            <tbody>
              {v.manifest.lines.map((l) => (
                <tr key={l.product_id + (l.flash_deal_id ?? '')}>
                  <td>{CATEGORY_LABEL[l.category]}</td>
                  <td>{l.name}</td>
                  <td className="font-mono text-xs">{l.sku}</td>
                  <td className="font-mono text-xs">{serials[l.sku] ?? '—'}</td>
                  <td className="text-right">{l.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="grid gap-6 border-t border-hairline py-6 md:grid-cols-3">
          <div>
            <h2 className="hud-eyebrow mb-2">Power</h2>
            <p className="tabular font-mono text-sm">Base {c?.estimated_base_wattage ?? '—'} W</p>
            <p className="tabular font-mono text-sm">Peak transient {c?.estimated_peak_transient_wattage ?? '—'} W</p>
            <p className="tabular font-mono text-sm">PSU target {c?.recommended_psu_wattage ?? '—'} W</p>
          </div>
          <div>
            <h2 className="hud-eyebrow mb-2">Firmware</h2>
            <p className="font-mono text-sm">BIOS {bios?.telemetry_metrics.bios_version_flashed ?? 'Factory'}</p>
            <p className="font-mono text-sm">{bios?.telemetry_metrics.expo_xmp_profile_verified ?? 'Memory profile: JEDEC'}</p>
          </div>
          <div>
            <h2 className="hud-eyebrow mb-2">Burn-In</h2>
            {burn ? (
              <>
                <p className="tabular font-mono text-sm">CPU peak {burn.telemetry_metrics.peak_occt_cpu_temp_c} °C</p>
                <p className="tabular font-mono text-sm">GPU peak {burn.telemetry_metrics.peak_furmark_gpu_temp_c} °C</p>
                <p className="tabular font-mono text-sm">Time Spy {burn.telemetry_metrics.time_spy_score?.toLocaleString()}</p>
              </>
            ) : (
              <p className="font-mono text-sm text-muted">{v.fulfillment_type === 'PRO_BUILT_FOUNDRY_RIG' ? 'Pending' : 'N/A — DIY kit'}</p>
            )}
          </div>
        </section>

        {burn?.telemetry_metrics.thermal_curve?.length ? (
          <section className="border-t border-hairline py-6">
            <h2 className="hud-eyebrow mb-3">OCCT Thermal Curve</h2>
            <ThermalCurve points={burn.telemetry_metrics.thermal_curve} height={200} />
          </section>
        ) : null}

        {c?.issues.length ? (
          <section className="border-t border-hairline py-6">
            <h2 className="hud-eyebrow mb-3">Engine Notes</h2>
            <ul className="space-y-1 text-sm">
              {c.issues.map((i) => (
                <li key={i.code}>
                  <span className="font-mono text-xs">{i.code}</span> — {i.title}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="border-t border-hairline py-6">
          <h2 className="hud-eyebrow mb-3">Chain of Custody</h2>
          <ol className="space-y-1 font-mono text-xs">
            {v.logs.map((l) => (
              <li key={l.id}>
                {formatDateTime(l.logged_at)} · {STAGES[l.stage].label} · {l.technician_code}
              </li>
            ))}
          </ol>
        </section>

        <footer className="flex flex-wrap justify-between gap-4 border-t border-hairline pt-6 font-mono text-[0.65rem] text-muted">
          <span>
            {COMPANY.legalName} · {COMPANY.flagship.street}, {COMPANY.flagship.city}, {COMPANY.flagship.region} {COMPANY.flagship.postalCode}
          </span>
          <span>
            RMA {COMPANY.contacts.support.email} · {COMPANY.contacts.support.phone} · Total {money(v.total_charged_cents)}
          </span>
        </footer>
      </article>
    </div>
  );
}
