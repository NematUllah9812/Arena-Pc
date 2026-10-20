import { z } from 'zod';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import type { AuthenticatorTransport } from '@simplewebauthn/server';
import { getRepo } from '@/lib/repo';
import { json, limit, readJson } from '@/lib/api';
import { openSecret } from '@/lib/security/crypto';
import { verifyTotp } from '@/lib/security/totp';
import { relyingParty, requestIp } from '@/lib/security/admin';
import { operatorIpAllowed, setPending, VAULT_DENIED } from '@/lib/security/vault';

export const dynamic = 'force-dynamic';
const schema = z.object({ codename: z.string().trim().toUpperCase().max(32), totp: z.string().regex(/^\d{6}$/) });

/** Factor 1+2 (codename + TOTP) → WebAuthn assertion challenge bound to a 5-minute pending cookie. */
export async function POST(req: Request) {
  const limited = await limit(req, 'vault-login', 5, 300);
  if (limited) return limited;
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) return json(VAULT_DENIED, { status: 401 });
  const repo = getRepo();
  const admin = await repo.getAdminByCodename(parsed.data.codename);
  const ip = await requestIp();
  // Constant-ish work regardless of whether the codename exists.
  const secret = admin ? await openSecret(admin.totp_secret_encrypted).catch(() => null) : null;
  const totpOk = secret ? (await verifyTotp(secret, parsed.data.totp, 1)) !== null : false;
  if (!admin || admin.is_locked || !totpOk || !operatorIpAllowed(admin.allowed_ips, ip)) {
    if (admin) await repo.writeAudit({ admin_id: admin.id, action_type: 'VAULT_LOGIN_FACTOR_REJECTED', target_entity: 'admin_vault_users', target_id: admin.id, previous_state: null, new_state: { totp_ok: totpOk, locked: admin.is_locked }, ip_address: ip });
    return json(VAULT_DENIED, { status: 401 });
  }
  const { rpID } = await relyingParty();
  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: [{ id: admin.webauthn_credential_id, transports: admin.webauthn_transports as AuthenticatorTransport[] }],
    userVerification: 'required',
    timeout: 60_000
  });
  await setPending({ sub: admin.id, codename: admin.codename, role: admin.role, challenge: options.challenge });
  return json({ ok: true, options });
}
