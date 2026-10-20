import { notFound } from 'next/navigation';
import { getRepo } from '@/lib/repo';
import { requireAdminPage } from '@/lib/security/admin';
import { nextStage, requiredFieldsFor, stageSequence, STAGES } from '@/lib/engine/build-bay';
import { CATEGORY_CODE, formatDateTime } from '@/lib/format';
import { AdminShell } from '@/components/admin/AdminShell';
import { FoundryConsole } from '@/components/admin/FoundryConsole';
import { HudCard } from '@/components/hud/HudCard';
import { TierBadge } from '@/components/hud/Badges';

export const dynamic = 'force-dynamic';

export default async function FoundryOrder({ params }: { params: Promise<{ orderNumber: string }> }) {
  const admin = await requireAdminPage('foundry');
  const { orderNumber } = await params;
  const repo = getRepo();
  const order = await repo.getOrderByNumber(decodeURIComponent(orderNumber));
  if (!order) notFound();
  const logs = await repo.listTelemetryLogs(order.id);
  const next = nextStage(order.fulfillment_type, order.includes_bios_preflash_service, order.current_stage);
  const seq = stageSequence(order.fulfillment_type, order.includes_bios_preflash_service);
  const a = order.shipping_address;

  return (
    <AdminShell admin={admin} active="/admin/foundry">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="hud-eyebrow">{order.fulfillment_type === 'PRO_BUILT_FOUNDRY_RIG' ? 'MODE B · PRO-BUILT' : 'MODE A · DIY'}</p>
          <h1 className="hud-title tabular text-3xl">{order.order_number}</h1>
        </div>
        <TierBadge tier={order.compatibility_confidence} />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_440px]">
        <div className="flex flex-col gap-6">
          <ol className="flex flex-wrap gap-2">
            {seq.map((s) => {
              const i = seq.indexOf(s);
              const cur = seq.indexOf(order.current_stage);
              return (
                <li key={s} className={`badge ${i < cur ? 'badge-verified' : i === cur ? 'badge-cryo' : 'badge-muted'}`}>
                  {STAGES[s].short}
                </li>
              );
            })}
          </ol>
          <HudCard innerClassName="p-5">
            <p className="hud-eyebrow mb-3">Pick list</p>
            <table className="data-grid w-full">
              <tbody>
                {order.manifest_snapshot.lines.map((l) => (
                  <tr key={l.product_id + (l.flash_deal_id ?? '')}>
                    <td className="font-mono text-xs text-muted">{CATEGORY_CODE[l.category]}</td>
                    <td className="font-mono text-xs">{l.sku}</td>
                    <td>{l.name}</td>
                    <td className="tabular text-right">×{l.quantity}</td>
                    <td className="font-mono text-xs text-volt">BIN {l.warehouse_bin}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {order.manifest_snapshot.compatibility?.issues.length ? (
              <ul className="mt-4 space-y-1.5">
                {order.manifest_snapshot.compatibility.issues.map((i) => (
                  <li key={i.code} className={`tier-${i.tier} tier-border border-l-2 bg-void px-3 py-2 text-xs`}>
                    <span className="tier-text font-mono">{i.code}</span> {i.title} — <span className="text-secondary">{i.remediation}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </HudCard>
          <HudCard innerClassName="p-5">
            <p className="hud-eyebrow mb-3">Telemetry log</p>
            <ol className="flex flex-col gap-2 font-mono text-xs">
              {logs.map((l) => (
                <li key={l.id} className="border-b border-hairline pb-2">
                  <span className="text-muted">{formatDateTime(l.logged_at)}</span> · <span className="text-volt">{STAGES[l.stage].short}</span> · {l.technician_code}
                  <pre className="mt-1 overflow-x-auto text-[0.62rem] whitespace-pre-wrap text-secondary">
                    {JSON.stringify({ ...l.telemetry_metrics, thermal_curve: l.telemetry_metrics.thermal_curve ? `${l.telemetry_metrics.thermal_curve.length} samples` : undefined })}
                  </pre>
                  {l.proof_screenshot_url ? (
                    <a href={l.proof_screenshot_url} target="_blank" rel="noopener" className="text-cryo hover:underline">
                      proof ↗
                    </a>
                  ) : null}
                </li>
              ))}
            </ol>
          </HudCard>
        </div>
        <div className="flex flex-col gap-6">
          {next ? (
            <FoundryConsole
              orderNumber={order.order_number}
              toStage={next}
              stageLabel={STAGES[next].label}
              requirement={STAGES[next].technicianRequirement}
              fields={requiredFieldsFor(next, order.fulfillment_type, order.includes_foam_gpu_brace)}
              defaultTech={order.assigned_technician_code ?? admin.codename}
              skus={order.manifest_snapshot.lines.map((l) => l.sku)}
            />
          ) : (
            <HudCard innerClassName="p-5">
              <p className="text-sm text-verified">Pipeline complete — delivered.</p>
            </HudCard>
          )}
          <HudCard innerClassName="p-5 text-sm">
            <p className="hud-eyebrow mb-2">Ship-to</p>
            <address className="not-italic text-secondary">
              {a.full_name}
              <br />
              {a.line1}
              {a.line2 ? (
                <>
                  <br />
                  {a.line2}
                </>
              ) : null}
              <br />
              {a.city}, {a.region} {a.postal_code}
              <br />
              {a.phone}
            </address>
            <p className="mt-2 font-mono text-xs text-muted">{order.customer_email}</p>
            {order.includes_foam_gpu_brace ? <p className="mt-3 font-mono text-xs text-cryo">⚑ Instapak foam brace required</p> : null}
            {order.requires_tech_clearance_check ? <p className="mt-1 font-mono text-xs text-tolerance">⚑ Manual clearance verification required</p> : null}
          </HudCard>
        </div>
      </div>
    </AdminShell>
  );
}
