import { z } from 'zod';
import { verifyRegistrationResponse, type RegistrationResponseJSON } from '@simplewebauthn/server';
import { getRepo } from '@/lib/repo';
import { json, limit, readJson } from '@/lib/api';
import { openSecret } from '@/lib/security/crypto';
import { toBase64Url } from '@/lib/security/encoding';
import { verifyTotp } from '@/lib/security/totp';
import { relyingParty, requestIp } from '@/lib/security/admin';
import { startSession, takePending } from '@/lib/security/vault';
import type { AdminRole } from '@/lib/types';

export const dynamic = 'force-dynamic';
const schema = z.object({ totp: z.string().regex(/^\d{6}$/), response: z.custom<RegistrationResponseJSON>((v) => typeof v === 'object' && v !== null && 'id' in v) });

export async function POST(req: Request) {
  const limited = await limit(req, 'vault-enroll-finish', 8, 600);
  if (limited) return limited;
  const pending = await takePending();
  const parsed = schema.safeParse(await readJson(req));
  if (!pending?.enroll || !pending.role || !parsed.success) return json({ ok: false, error: 'ENROLLMENT_EXPIRED', detail: 'Enrollment window closed. Restart.' }, { status: 401 });
  const repo = getRepo();
  const ip = await requestIp();

  const secret = await openSecret(pending.enroll.totpSealed);
  if ((await verifyTotp(secret, parsed.data.totp, 1)) === null) return json({ ok: false, error: 'TOTP_MISMATCH', detail: 'Authenticator code did not match. Restart enrollment.' }, { status: 401 });
  if (pending.enroll.bootstrap && (await repo.countAdmins()) > 0) return json({ ok: false, error: 'ENROLLMENT_DENIED' }, { status: 403 });

  const { rpID, origin } = await relyingParty();
  let info;
  try {
    const v = await verifyRegistrationResponse({ response: parsed.data.response, expectedChallenge: pending.challenge, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: true });
    if (!v.verified || !v.registrationInfo) throw new Error('UNVERIFIED');
    info = v.registrationInfo;
  } catch (e) {
    return json({ ok: false, error: 'PASSKEY_REJECTED', detail: (e as Error).message.slice(0, 160) }, { status: 401 });
  }

  const created = await repo.createAdmin({
    codename: pending.codename,
    role: pending.role as AdminRole,
    webauthnCredentialId: info.credential.id,
    webauthnPublicKey: toBase64Url(info.credential.publicKey),
    webauthnSignCount: info.credential.counter,
    webauthnTransports: info.credential.transports ?? [],
    totpSecretEncrypted: pending.enroll.totpSealed
  });
  if (!created.ok) return json({ ok: false, error: created.error }, { status: 409 });
  await repo.writeAudit({
    admin_id: created.value.id,
    action_type: pending.enroll.bootstrap ? 'VAULT_BOOTSTRAP_ENROLL' : 'VAULT_INVITE_ENROLL',
    target_entity: 'admin_vault_users',
    target_id: created.value.id,
    previous_state: null,
    new_state: { codename: created.value.codename, role: created.value.role, invite: pending.enroll.inviteId ?? null },
    ip_address: ip
  });
  await startSession(created.value);
  return json({ ok: true });
}
