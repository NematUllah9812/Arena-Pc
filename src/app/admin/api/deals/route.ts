import { z } from 'zod';
import { getRepo } from '@/lib/repo';
import { json, readJson } from '@/lib/api';
import { requireAdminApi } from '@/lib/security/admin';

export const dynamic = 'force-dynamic';

const create = z
  .object({
    productId: z.string().uuid(),
    dealTitle: z.string().trim().min(3).max(80),
    dealPriceCents: z.number().int().min(100),
    maxClaims: z.number().int().min(1).max(500),
    startsAt: z.string().datetime({ offset: true }),
    expiresAt: z.string().datetime({ offset: true }),
    bannerAccentHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/)
  })
  .refine((d) => new Date(d.expiresAt) > new Date(d.startsAt), { message: 'Expiry must be after start' });

export async function POST(req: Request) {
  const auth = await requireAdminApi('deals');
  if ('error' in auth) return auth.error;
  const parsed = create.safeParse(await readJson(req));
  if (!parsed.success) return json({ ok: false, error: 'INVALID_INPUT', detail: parsed.error.issues[0]?.message }, { status: 400 });
  const res = await getRepo().createFlashDeal({ ...parsed.data, adminId: auth.admin.id, ip: auth.ip });
  return json(res, { status: res.ok ? 200 : 422 });
}

const toggle = z.object({ dealId: z.string().uuid(), active: z.boolean() });

export async function PATCH(req: Request) {
  const auth = await requireAdminApi('deals');
  if ('error' in auth) return auth.error;
  const parsed = toggle.safeParse(await readJson(req));
  if (!parsed.success) return json({ ok: false, error: 'INVALID_INPUT' }, { status: 400 });
  const res = await getRepo().setFlashDealActive(auth.admin.id, parsed.data.dealId, parsed.data.active, auth.ip);
  return json(res, { status: res.ok ? 200 : 422 });
}
