import { z } from 'zod';
import { getRepo } from '@/lib/repo';
import { json, readJson } from '@/lib/api';
import { requireAdminApi } from '@/lib/security/admin';
import { signInvite } from '@/lib/security/session';
import { CODENAME_RE } from '@/lib/security/vault';

export const dynamic = 'force-dynamic';
const schema = z.object({ codename: z.string().trim().toUpperCase(), role: z.enum(['OVERSEER', 'INVENTORY_COMMANDER', 'PRICING_OPS', 'LEAD_TECHNICIAN']) });

export async function POST(req: Request) {
  const auth = await requireAdminApi('vault');
  if ('error' in auth) return auth.error;
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success || !CODENAME_RE.test(parsed.data.codename)) return json({ ok: false, error: 'INVALID_CODENAME' }, { status: 400 });
  const repo = getRepo();
  if (await repo.getAdminByCodename(parsed.data.codename)) return json({ ok: false, error: 'CODENAME_TAKEN' }, { status: 409 });
  const token = await signInvite({ ...parsed.data, issuedBy: auth.admin.id });
  await repo.writeAudit({ admin_id: auth.admin.id, action_type: 'VAULT_INVITE_ISSUED', target_entity: 'admin_vault_users', target_id: null, previous_state: null, new_state: parsed.data, ip_address: auth.ip });
  return json({ ok: true, token });
}
