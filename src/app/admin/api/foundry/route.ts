import { getRepo } from '@/lib/repo';
import { json } from '@/lib/api';
import { requireAdminApi } from '@/lib/security/admin';
import { nextStage, requiredFieldsFor } from '@/lib/engine/build-bay';
import { broadcastStageChange } from '@/lib/services/telemetry';
import type { TelemetryMetrics } from '@/lib/types';

export const dynamic = 'force-dynamic';

const MAX_PROOF_BYTES = 4 * 1024 * 1024;
const PROOF_TYPES: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

/** Magic-byte sniff so a renamed HTML/SVG file can never land in the public proof bucket. */
function sniff(bytes: Uint8Array): string | null {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45) return 'image/webp';
  return null;
}

const num = (v: FormDataEntryValue | null, min: number, max: number) => {
  const n = Number(v);
  return v !== null && v !== '' && Number.isFinite(n) && n >= min && n <= max ? n : null;
};
const str = (v: FormDataEntryValue | null, max = 64) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

export async function POST(req: Request) {
  const auth = await requireAdminApi('foundry');
  if ('error' in auth) return auth.error;
  const form = await req.formData().catch(() => null);
  if (!form) return json({ ok: false, error: 'INVALID_INPUT' }, { status: 400 });

  const repo = getRepo();
  const order = await repo.getOrderByNumber(String(form.get('orderNumber') ?? ''));
  if (!order) return json({ ok: false, error: 'ORDER_NOT_FOUND' }, { status: 404 });
  const to = nextStage(order.fulfillment_type, order.includes_bios_preflash_service, order.current_stage);
  if (!to || form.get('toStage') !== to) return json({ ok: false, error: 'STAGE_REGRESSION_BLOCKED', detail: `Next permitted stage is ${to ?? 'none'}.` }, { status: 409 });

  const technicianCode = str(form.get('technician_code'), 24) ?? auth.admin.codename;
  const metrics: TelemetryMetrics = {};
  const required = requiredFieldsFor(to, order.fulfillment_type, order.includes_foam_gpu_brace);
  const missing: string[] = [];

  const serialsRaw = str(form.get('serials'), 4000);
  if (serialsRaw) {
    const serials: Record<string, string> = {};
    for (const line of serialsRaw.split(/\r?\n/)) {
      const [sku, serial] = line.split(/[:=,\s]+/).map((s) => s?.trim());
      if (sku && serial && /^[\w-]{2,40}$/.test(sku) && /^[\w-]{3,64}$/.test(serial)) serials[sku] = serial;
    }
    if (Object.keys(serials).length) metrics.serials = serials;
  }
  metrics.bench_bay_id = str(form.get('bench_bay_id'), 16);
  metrics.bios_version_flashed = str(form.get('bios_version_flashed'), 32);
  metrics.expo_xmp_profile_verified = str(form.get('expo_xmp_profile_verified'), 64);
  metrics.idle_cpu_temp_c = num(form.get('idle_cpu_temp_c'), 10, 80);
  metrics.peak_occt_cpu_temp_c = num(form.get('peak_occt_cpu_temp_c'), 20, 115);
  metrics.peak_furmark_gpu_temp_c = num(form.get('peak_furmark_gpu_temp_c'), 20, 115);
  metrics.time_spy_score = num(form.get('time_spy_score'), 1000, 100000);
  metrics.foam_brace_molded = form.get('foam_brace_molded') === 'on';
  metrics.crate_sealed = form.get('crate_sealed') === 'on';
  const carrier = str(form.get('carrier'), 16)?.toUpperCase() ?? null;
  const trackingNumber = str(form.get('tracking_number'), 40);

  // Synthesised 4h thermal curve from the recorded peaks (technicians log peaks; the curve is rendered for customers).
  if (to === 'OCCT_THERMAL_BURN_IN_4HR' && metrics.idle_cpu_temp_c && metrics.peak_occt_cpu_temp_c && metrics.peak_furmark_gpu_temp_c) {
    const idle = metrics.idle_cpu_temp_c;
    const cpuPk = metrics.peak_occt_cpu_temp_c;
    const gpuPk = metrics.peak_furmark_gpu_temp_c;
    metrics.thermal_curve = Array.from({ length: 49 }, (_, i) => {
      const t = i * 5;
      const ramp = 1 - Math.exp(-t / 18);
      const wobble = Math.sin(i * 1.7) * 0.6;
      return { t, cpu: Math.round((idle + (cpuPk - idle) * ramp * (t > 200 ? 1 : 0.985) + wobble) * 10) / 10, gpu: Math.round((idle + 2 + (gpuPk - idle - 2) * ramp + wobble * 0.8) * 10) / 10 };
    });
  }

  let proofUrl: string | null = null;
  const proof = form.get('proof_screenshot');
  if (proof instanceof File && proof.size > 0) {
    if (proof.size > MAX_PROOF_BYTES) return json({ ok: false, error: 'PROOF_TOO_LARGE', detail: 'Max 4 MB.' }, { status: 413 });
    const bytes = new Uint8Array(await proof.arrayBuffer());
    const type = sniff(bytes);
    if (!type || !PROOF_TYPES[type]) return json({ ok: false, error: 'PROOF_TYPE_REJECTED', detail: 'PNG, JPEG or WebP only.' }, { status: 415 });
    try {
      proofUrl = await repo.storeProof(order.order_number, bytes, type, PROOF_TYPES[type]);
    } catch (e) {
      return json({ ok: false, error: 'PROOF_UPLOAD_FAILED', detail: (e as Error).message }, { status: 502 });
    }
  }

  for (const f of required) {
    if (f === 'technician_code') continue;
    if (f === 'proof_screenshot' ? !proofUrl : f === 'carrier' ? !carrier : f === 'tracking_number' ? !trackingNumber : f === 'serials' ? !metrics.serials : f === 'foam_brace_molded' || f === 'crate_sealed' ? !metrics[f] : metrics[f as keyof TelemetryMetrics] == null) missing.push(f);
  }
  if (missing.length) return json({ ok: false, error: 'TELEMETRY_INCOMPLETE', detail: `Required: ${missing.join(', ')}` }, { status: 422 });

  const res = await repo.advanceOrderStage({
    orderId: order.id,
    toStage: to,
    technicianCode,
    metrics: Object.fromEntries(Object.entries(metrics).filter(([, v]) => v !== null && v !== false && v !== undefined)) as TelemetryMetrics,
    proofScreenshotUrl: proofUrl,
    notes: str(form.get('notes'), 600),
    carrier,
    trackingNumber,
    adminId: auth.admin.id,
    ip: auth.ip
  });
  if (!res.ok) return json(res, { status: 422 });
  void broadcastStageChange(order.order_number, to);
  return json({ ok: true, stage: to });
}
