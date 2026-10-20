import { cartLinesSchema, reserveCart } from '@/lib/services/checkout';
import { getCartSessionId } from '@/lib/services/cart-session';
import { json, limit, readJson } from '@/lib/api';

export const dynamic = 'force-dynamic';

const MESSAGES: Record<string, string> = {
  INSUFFICIENT_STOCK: 'Not enough units on the shelf for this SKU.',
  FLASH_DEAL_DEPLETED: 'Flash deal claims are exhausted or the window has closed.',
  SKU_LOCKED_OR_UNAVAILABLE: 'This SKU is locked by another checkout or no longer listed — retry in a moment.',
  INVALID_QUANTITY: 'Quantity must be between 1 and 10.'
};

export async function POST(req: Request) {
  const limited = await limit(req, 'cart-reserve', 20, 60);
  if (limited) return limited;
  const parsed = cartLinesSchema.safeParse(await readJson(req));
  if (!parsed.success) return json({ ok: false, error: 'INVALID_CART', detail: parsed.error.issues[0]?.message }, { status: 400 });
  const sid = (await getCartSessionId(true))!;
  const res = await reserveCart(sid, parsed.data);
  if (!res.ok) return json({ ...res, detail: MESSAGES[res.error] ?? res.error }, { status: 409 });
  return json(res);
}
