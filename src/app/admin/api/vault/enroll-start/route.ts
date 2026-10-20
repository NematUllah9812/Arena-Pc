import { z } from 'zod';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { getRepo } from '@/lib/repo';
import { json, limit, readJson } from '@/lib/api';
import { sealSecret } from '@/lib/security/crypto';
import { timingSafeEqual } from '@/lib/security/encoding';
import { generateTotpSecret, otpauthUri } from '@/lib/security/totp';
import { verifyInvite } from '@/lib/security/session';
import { relyingParty } from '@/lib/security/admin';
import { CODENAME_RE, setPending } from '@/lib/security/vault';
import type { AdminRole } from '@/lib/types';

export const dynamic = 'force-dynamic';
const ROLES: AdminRole[] = ['OVERSEER', 'INVENTORY_COMMANDER', 'PRICING_OPS', 'LEAD_TECHNICIAN'];
const schema = z.object({ codename: z.string().trim().toUpperCase(), invite: z.string().max(2048).optional(), bootstrap: z.string().max(256).optional() });

/**
 * Operator enrollment. Two doors:
 *  - bootstrap: ADMIN_BOOTSTRAP_TOKEN, only while the vault has zero operators → OVERSEER.
 *  - invite: Overseer-signed, role-bound, codename-bound 24h token (single use via codename uniqueness).
 */
export async function POST(req: Request) {
  const limited = await limit(req, 'vault-enroll', 5, 600);
  if (limited) return limited;
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success || !CODENAME_RE.test(parsed.data.codename)) return json({ ok: false, error: 'INVALID_CODENAME', detail: 'Codename: 3–32 chars, A–Z, 0–9, _ or -, starting with a letter.' }, { status: 400 });
  const { codename, invite, bootstrap } = parsed.data;
  const repo = getRepo();

  let role: AdminRole | null = null;
  let isBootstrap = false;
  let inviteId: string | undefined;
  if (bootstrap) {
    const expected = process.env.ADMIN_BOOTSTRAP_TOKEN;
    if (expected && expected.length >= 16 && timingSafeEqual(bootstrap, expected) && (await repo.countAdmins()) === 0) {
      role = 'OVERSEER';
      isBootstrap = true;
    }
  } else if (invite) {
    const claims = await verifyInvite(invite);
    if (claims && claims.codename === codename && ROLES.includes(claims.role as AdminRole)) {
      role = claims.role as AdminRole;
      inviteId = claims.jti;
    }
  }
  if (!role) return json({ ok: false, error: 'ENROLLMENT_DENIED', detail: 'Invite or bootstrap token rejected.' }, { status: 403 });
  if (await repo.getAdminByCodename(codename)) return json({ ok: false, error: 'CODENAME_TAKEN', detail: 'That codename is already enrolled.' }, { status: 409 });

  const totpSecret = generateTotpSecret();
  const { rpID, rpName } = await relyingParty();
  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: codename,
    userDisplayName: `${codename} · ${role}`,
    userID: crypto.getRandomValues(new Uint8Array(16)),
    attestationType: 'none',
    authenticatorSelection: { residentKey: 'preferred', userVerification: 'required' },
    timeout: 120_000
  });
  await setPending({ codename, role, challenge: options.challenge, enroll: { totpSealed: await sealSecret(totpSecret), inviteId, bootstrap: isBootstrap } });
  return json({ ok: true, role, options, totp: { secret: totpSecret, uri: otpauthUri(totpSecret, codename) } });
}
