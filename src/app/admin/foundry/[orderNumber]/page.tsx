import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getRepo } from '@/lib/repo';
import { requireAdminPage } from '@/lib/security/admin';
import { nextStage, requiredFieldsFor, stageSequence, STAGES } from '@/lib/engine/build-bay';
import { CATEGORY_LABEL, formatDateTime, money } from '@/lib/format';
import { AdminPanel, AdminShell } from '@/components/admin/AdminShell';
import { FoundryConsole } from '@/components/admin/FoundryConsole';
import { TierBadge } from '@/components/hud/Badges';
import { CheckIcon } from '@/components/ui/Icons';

export const dynamic = 'force-dynamic';

const METRIC_LABELS: Record<string, string> = {
  bench_bay_id: 'Bench',
  bios_version_flashed: 'BIOS',
  expo_xmp_profile_verified: 'Memory profile',
  idle_cpu_temp_c: 'Idle CPU °C',
  peak_occt_cpu_temp_c: 'Max CPU °C',
  peak_furmark_gpu_temp_c: 'Max GPU °C',
  time_spy_score: '3DMark',
  carrier: 'Carrier',
  tracking_number: 'Tracking',
  foam_brace_molded: 'GPU foam',
  crate_sealed: 'Packed'
};

export async function generateMetadata({ params }: { params: Promise<{ orderNumber: string }> }) {
  return { title: `Order ${decodeURIComponent((await params).orderNumber)}` };
}

export default async function FoundryOrder({ params }: { params: Promise<{ orderNumber: string }> }) {
  const admin = await requireAdminPage('foundry');
  const { orderNumber } = await params;
  const repo = getRepo();
  const order = await repo.getOrderByNumber(decodeURIComponent(orderNumber));
  if (!order) notFound();
  const logs = await repo.listTelemetryLogs(order.id);
  const next = nextStage(order.fulfillment_type, order.includes_bios_preflash_service, order.current_stage);
  const seq = stageSequence(order.fulfillment_type, order.includes_bios_preflash_service);
  const cur = seq.indexOf(order.current_stage);
  const a = order.shipping_address;

  return (
    <AdminShell
      admin={admin}
      active="/admin/foundry"
      title={`Order ${order.order_number}`}
      description={`${order.fulfillment_type === 'PRO_BUILT_FOUNDRY_RIG' ? 'Built by us' : 'Parts only'} · placed ${formatDateTime(order.created_at)} · ${money(order.total_charged_cents)}`}
      actions={
        <>
          <Link href="/admin/foundry" className="btn-ghost size-sm">
            ‹ All orders
          </Link>
          <Link href={`/telemetry/${order.order_number}`} target="_blank" className="btn-ghost size-sm">
            Customer view
          </Link>
        </>
      }
    >
      <ol className="mb-6 flex flex-wrap gap-2">
        {seq.map((s, i) => (
          <li
            key={s}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${i < cur ? 'border-[#bbf7d0] bg-[#f0fdf4] text-verified' : i === cur ? 'border-volt bg-[#eff6ff] text-volt' : 'border-hairline bg-white text-muted'}`}
          >
            {i < cur ? <CheckIcon size={13} strokeWidth={2.4} /> : <span>{i + 1}.</span>} {STAGES[s].label}
          </li>
        ))}
      </ol>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="flex flex-col gap-6">
          <AdminPanel title="Pick list" action={<TierBadge tier={order.compatibility_confidence} compact />} flush>
            <div className="overflow-x-auto">
              <table className="data-grid">
                <thead>
                  <tr>
                    <th>Part</th>
                    <th>Name</th>
                    <th>SKU</th>
                    <th className="text-right">Qty</th>
                    <th>Bin</th>
                  </tr>
                </thead>
                <tbody>
                  {order.manifest_snapshot.lines.map((l) => (
                    <tr key={l.product_id + (l.flash_deal_id ?? '')}>
                      <td className="text-muted">{CATEGORY_LABEL[l.category]}</td>
                      <td>{l.name}</td>
                      <td className="text-xs text-secondary">{l.sku}</td>
                      <td className="tabular text-right">{l.quantity}</td>
                      <td className="whitespace-nowrap font-medium text-volt">{l.warehouse_bin}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {order.manifest_snapshot.compatibility?.issues.length ? (
              <ul className="space-y-2 border-t border-hairline p-5">
                {order.manifest_snapshot.compatibility.issues.map((i) => (
                  <li key={i.code} className={`tier-${i.tier} tier-border rounded-lg border-l-4 bg-white px-3 py-2 text-sm`}>
                    <span className="font-medium">{i.title}</span> — <span className="text-secondary">{i.remediation}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </AdminPanel>

          <AdminPanel title="History" flush>
            {logs.length ? (
              <ol className="divide-y divide-hairline">
                {logs.map((l) => (
                  <li key={l.id} className="px-5 py-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">{STAGES[l.stage].label}</span>
                      <span className="text-xs text-muted">
                        {formatDateTime(l.logged_at)} · {l.technician_code}
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {Object.entries(l.telemetry_metrics)
                        .filter(([k, v]) => METRIC_LABELS[k] && v != null && v !== false)
                        .map(([k, v]) => (
                          <span key={k} className="rounded-md bg-chassis px-2 py-0.5 text-xs text-secondary">
                            {METRIC_LABELS[k]}: {v === true ? 'Yes' : String(v)}
                          </span>
                        ))}
                      {l.telemetry_metrics.serials ? <span className="rounded-md bg-chassis px-2 py-0.5 text-xs text-secondary">{Object.keys(l.telemetry_metrics.serials).length} serials</span> : null}
                      {l.proof_screenshot_url ? (
                        <a href={l.proof_screenshot_url} target="_blank" rel="noopener" className="rounded-md px-2 py-0.5 text-xs text-volt hover:underline">
                          Test screenshot
                        </a>
                      ) : null}
                    </div>
                    {l.technician_notes ? <p className="mt-1.5 text-xs text-secondary">“{l.technician_notes}”</p> : null}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="p-5 text-sm text-muted">No updates logged yet.</p>
            )}
          </AdminPanel>
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
            <AdminPanel>
              <p className="flex items-center gap-1.5 text-sm font-medium text-verified"><CheckIcon size={16} strokeWidth={2.4} /> Delivered — nothing left to do.</p>
            </AdminPanel>
          )}
          <AdminPanel title="Ship to">
            <address className="text-sm not-italic leading-relaxed text-secondary">
              <span className="font-medium text-primary">{a.full_name}</span>
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
              <br />
              {order.customer_email}
            </address>
            {order.includes_foam_gpu_brace ? <p className="mt-3 rounded-lg bg-[#f0f9ff] px-3 py-2 text-xs text-secondary">Heavy GPU — add protective foam before shipping.</p> : null}
            {order.requires_tech_clearance_check ? <p className="mt-2 rounded-lg bg-[#fffbeb] px-3 py-2 text-xs text-secondary">Tight fit — check part clearance by hand.</p> : null}
          </AdminPanel>
        </div>
      </div>
    </AdminShell>
  );
}
