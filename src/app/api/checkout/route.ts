import { checkout, checkoutSchema } from '@/lib/services/checkout';
import { getCartSessionId } from '@/lib/services/cart-session';
import { json, limit, readJson } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const limited = await limit(req, 'checkout', 6, 60);
  if (limited) return limited;
  const parsed = checkoutSchema.safeParse(await readJson(req));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return json({ ok: false, error: 'INVALID_INPUT', detail: first ? `${first.path.join('.')}: ${first.message}` : 'Invalid input' }, { status: 400 });
  }
  const sid = await getCartSessionId(false);
  if (!sid) return json({ ok: false, error: 'RESERVATION_EXPIRED', detail: 'No active cart session. Re-lock your cart.' }, { status: 409 });
  const res = await checkout(sid, parsed.data);
  if (!res.ok) return json(res, { status: res.error === 'HARD_CONFLICT' ? 422 : 409 });
  const o = res.order;
  return json({ ok: true, order: { order_number: o.order_number, total_charged_cents: o.total_charged_cents, estimated_dispatch_date: o.estimated_dispatch_date, fulfillment_type: o.fulfillment_type } });
}
