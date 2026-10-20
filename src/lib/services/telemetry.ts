import 'server-only';
import { getRepo } from '@/lib/repo';
import { stageSequence } from '@/lib/engine/build-bay';
import { firstName, maskEmail } from '@/lib/format';
import type { PublicTelemetryView } from '@/lib/types';

export const ORDER_NUMBER_RE = /^VL-ORD-\d{5,8}$/;

/** PII-minimised view: first name + masked email only; no address, phone or session ids. */
export async function getPublicTelemetry(orderNumber: string): Promise<PublicTelemetryView | null> {
  const normalized = orderNumber.toUpperCase();
  if (!ORDER_NUMBER_RE.test(normalized)) return null;
  const repo = getRepo();
  const order = await repo.getOrderByNumber(normalized);
  if (!order) return null;
  const logs = await repo.listTelemetryLogs(order.id);
  return {
    order_number: order.order_number,
    fulfillment_type: order.fulfillment_type,
    current_stage: order.current_stage,
    stage_sequence: stageSequence(order.fulfillment_type, order.includes_bios_preflash_service),
    assigned_technician_code: order.assigned_technician_code,
    estimated_dispatch_date: order.estimated_dispatch_date,
    carrier: order.carrier,
    carrier_tracking_number: order.carrier_tracking_number,
    compatibility_confidence: order.compatibility_confidence,
    requires_tech_clearance_check: order.requires_tech_clearance_check,
    includes_foam_gpu_brace: order.includes_foam_gpu_brace,
    includes_bios_preflash_service: order.includes_bios_preflash_service,
    customer_first_name: firstName(order.customer_name),
    masked_email: maskEmail(order.customer_email),
    manifest: order.manifest_snapshot,
    total_charged_cents: order.total_charged_cents,
    created_at: order.created_at,
    logs: logs.map((l) => ({ ...l, technician_notes: l.technician_notes }))
  };
}

/** Fire-and-forget Supabase Realtime broadcast so open trackers refresh instantly. */
export async function broadcastStageChange(orderNumber: string, stage: string): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  try {
    await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ messages: [{ topic: `telemetry:${orderNumber}`, event: 'stage', payload: { stage, at: new Date().toISOString() } }] }),
      signal: AbortSignal.timeout(3000)
    });
  } catch {
    /* polling fallback covers it */
  }
}
