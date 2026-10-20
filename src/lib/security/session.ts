import { SignJWT, jwtVerify } from 'jose';
import { utf8 } from './encoding';

export const SESSION_COOKIE = '__vortex_overseer_session';
export const PENDING_COOKIE = '__vortex_vault_pending';
export const SESSION_TTL_SECONDS = 60 * 60 * 8;
export const PENDING_TTL_SECONDS = 60 * 5;

function secret(): Uint8Array | null {
  const s = process.env.SESSION_SECRET || (process.env.NODE_ENV !== 'production' ? 'vortex-dev-only-session-secret-change-me' : '');
  return s ? utf8(s) : null;
}

export interface SessionClaims {
  sub: string;
  role: string;
  codename: string;
  typ: 'overseer';
}

export interface PendingClaims {
  typ: 'pending';
  /** Present for login; absent for enrollment. */
  sub?: string;
  codename: string;
  role?: string;
  /** WebAuthn challenge bound to this browser. */
  challenge: string;
  /** Enrollment payload (sealed TOTP secret + invite id). */
  enroll?: { totpSealed: string; inviteId?: string; bootstrap?: boolean };
}

export async function signSession(claims: Omit<SessionClaims, 'typ'>): Promise<string> {
  const key = secret();
  if (!key) throw new Error('SESSION_SECRET is not configured');
  return new SignJWT({ role: claims.role, codename: claims.codename, typ: 'overseer' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setIssuer('vortex-vault')
    .setAudience('vortex-admin')
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(key);
}

export async function verifySession(token: string | undefined): Promise<SessionClaims | null> {
  const key = secret();
  if (!token || !key) return null;
  try {
    const { payload } = await jwtVerify(token, key, { issuer: 'vortex-vault', audience: 'vortex-admin', algorithms: ['HS256'] });
    if (payload.typ !== 'overseer' || !payload.sub) return null;
    return { sub: payload.sub, role: String(payload.role), codename: String(payload.codename), typ: 'overseer' };
  } catch {
    return null;
  }
}

export async function signPending(claims: Omit<PendingClaims, 'typ'>): Promise<string> {
  const key = secret();
  if (!key) throw new Error('SESSION_SECRET is not configured');
  return new SignJWT({ ...claims, typ: 'pending' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer('vortex-vault')
    .setAudience('vortex-pending')
    .setExpirationTime(`${PENDING_TTL_SECONDS}s`)
    .sign(key);
}

export async function verifyPending(token: string | undefined): Promise<PendingClaims | null> {
  const key = secret();
  if (!token || !key) return null;
  try {
    const { payload } = await jwtVerify(token, key, { issuer: 'vortex-vault', audience: 'vortex-pending', algorithms: ['HS256'] });
    if (payload.typ !== 'pending') return null;
    return payload as unknown as PendingClaims;
  } catch {
    return null;
  }
}

/** Invite tokens let an Overseer enroll a new operator (24h, role-bound). */
export async function signInvite(claims: { codename: string; role: string; issuedBy: string }): Promise<string> {
  const key = secret();
  if (!key) throw new Error('SESSION_SECRET is not configured');
  return new SignJWT({ ...claims, typ: 'invite' })
    .setProtectedHeader({ alg: 'HS256' })
    .setJti(crypto.randomUUID())
    .setIssuedAt()
    .setIssuer('vortex-vault')
    .setAudience('vortex-invite')
    .setExpirationTime('24h')
    .sign(key);
}

export async function verifyInvite(token: string | undefined): Promise<{ codename: string; role: string; issuedBy: string; jti: string } | null> {
  const key = secret();
  if (!token || !key) return null;
  try {
    const { payload } = await jwtVerify(token, key, { issuer: 'vortex-vault', audience: 'vortex-invite', algorithms: ['HS256'] });
    if (payload.typ !== 'invite' || !payload.jti) return null;
    return { codename: String(payload.codename), role: String(payload.role), issuedBy: String(payload.issuedBy), jti: payload.jti };
  } catch {
    return null;
  }
}
