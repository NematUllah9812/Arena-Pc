import { verifyAuthenticationResponse, type AuthenticationResponseJSON, type AuthenticatorTransport } from '@simplewebauthn/server';
import { getRepo } from '@/lib/repo';
import { json, limit, readJson } from '@/lib/api';
import { fromBase64Url } from '@/lib/security/encoding';
import { relyingParty, requestIp } from '@/lib/security/admin';
import { startSession, takePending, VAULT_DENIED } from '@/lib/security/vault';

export const dynamic = 'force-dynamic';

/** Factor 3: hardware passkey assertion (user verification required) → Overseer session. */
export async function POST(req: Request) {
  const limited = await limit(req, 'vault-login-finish', 10, 300);
  if (limited) return limited;
  const pending = await takePending();
  const body = (await readJson(req)) as { response?: AuthenticationResponseJSON } | null;
  if (!pending?.sub || pending.enroll || !body?.response) return json(VAULT_DENIED, { status: 401 });
  const repo = getRepo();
  const admin = await repo.getAdminById(pending.sub);
  const ip = await requestIp();
  if (!admin || admin.is_locked || body.response.id !== admin.webauthn_credential_id) return json(VAULT_DENIED, { status: 401 });
  const { rpID, origin } = await relyingParty();
  try {
    const v = await verifyAuthenticationResponse({
      response: body.response,
      expectedChallenge: pending.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
      credential: {
        id: admin.webauthn_credential_id,
        publicKey: fromBase64Url(admin.webauthn_public_key) as Uint8Array<ArrayBuffer>,
        counter: admin.webauthn_sign_count,
        transports: admin.webauthn_transports as AuthenticatorTransport[]
      }
    });
    if (!v.verified) throw new Error('UNVERIFIED');
    await repo.recordAdminLogin(admin.id, v.authenticationInfo.newCounter);
  } catch (e) {
    await repo.writeAudit({ admin_id: admin.id, action_type: 'VAULT_PASSKEY_REJECTED', target_entity: 'admin_vault_users', target_id: admin.id, previous_state: null, new_state: { reason: (e as Error).message.slice(0, 120) }, ip_address: ip });
    return json(VAULT_DENIED, { status: 401 });
  }
  await repo.writeAudit({ admin_id: admin.id, action_type: 'VAULT_LOGIN', target_entity: 'admin_vault_users', target_id: admin.id, previous_state: null, new_state: { role: admin.role }, ip_address: ip });
  await startSession(admin);
  return json({ ok: true });
}
