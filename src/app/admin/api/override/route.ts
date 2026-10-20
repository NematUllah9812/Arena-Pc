import { z } from 'zod';
import { getRepo } from '@/lib/repo';
import { json, readJson } from '@/lib/api';
import { requireAdminApi } from '@/lib/security/admin';

export const dynamic = 'force-dynamic';
const schema = z.object({ productId: z.string().uuid(), minPriceCents: z.number().int().min(1) });

/** §7.4 Dual-admin control: an Overseer pre-authorises a below-floor price; a second operator consumes it (30-min TTL). */
export async function POST(req: Request) {
  const auth = await requireAdminApi('override');
  if ('error' in auth) return auth.error;
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) return json({ ok: false, error: 'INVALID_INPUT' }, { status: 400 });
  const res = await getRepo().issuePriceOverride(auth.admin.id, parsed.data.productId, parsed.data.minPriceCents, auth.ip);
  return json(res, { status: res.ok ? 200 : 422 });
}
