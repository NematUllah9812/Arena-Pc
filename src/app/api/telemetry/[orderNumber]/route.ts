import { getPublicTelemetry } from '@/lib/services/telemetry';
import { json, limit } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ orderNumber: string }> }) {
  const limited = await limit(req, 'telemetry', 60, 60);
  if (limited) return limited;
  const { orderNumber } = await params;
  const telemetry = await getPublicTelemetry(decodeURIComponent(orderNumber));
  if (!telemetry) return json({ ok: false, error: 'ORDER_NOT_FOUND' }, { status: 404 });
  return json({ ok: true, telemetry });
}
