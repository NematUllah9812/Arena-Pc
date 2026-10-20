import { z } from 'zod';
import { getRepo } from '@/lib/repo';
import { json, limit } from '@/lib/api';

export const dynamic = 'force-dynamic';
const idsSchema = z.array(z.string().uuid()).min(1).max(60);

/** Price/stock refresh for cart lines: GET /api/products?ids=a,b,c */
export async function GET(req: Request) {
  const limited = await limit(req, 'products', 60, 60);
  if (limited) return limited;
  const parsed = idsSchema.safeParse((new URL(req.url).searchParams.get('ids') ?? '').split(',').filter(Boolean));
  if (!parsed.success) return json({ ok: false, error: 'INVALID_IDS' }, { status: 400 });
  return json({ ok: true, products: await getRepo().getProductsByIds(parsed.data) });
}
