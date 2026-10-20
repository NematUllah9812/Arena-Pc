import { z } from 'zod';
import { getRepo } from '@/lib/repo';
import { json, readJson } from '@/lib/api';
import { requireAdminApi } from '@/lib/security/admin';

export const dynamic = 'force-dynamic';
const schema = z.object({ adminId: z.string().uuid(), locked: z.boolean() });

export async function POST(req: Request) {
  const auth = await requireAdminApi('vault');
  if ('error' in auth) return auth.error;
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) return json({ ok: false, error: 'INVALID_INPUT' }, { status: 400 });
  if (parsed.data.adminId === auth.admin.id) return json({ ok: false, error: 'CANNOT_LOCK_SELF' }, { status: 400 });
  const res = await getRepo().setAdminLocked(auth.admin.id, parsed.data.adminId, parsed.data.locked, auth.ip);
  return json(res, { status: res.ok ? 200 : 400 });
}
