import { getRepo } from '@/lib/repo';
import { getCartSessionId } from '@/lib/services/cart-session';
import { json, limit } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const limited = await limit(req, 'cart-release', 30, 60);
  if (limited) return limited;
  const sid = await getCartSessionId(false);
  if (!sid) return json({ ok: true, released: 0 });
  const released = await getRepo().releaseReservations(sid);
  return json({ ok: true, released });
}
