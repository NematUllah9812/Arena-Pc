import 'server-only';
import { cookies } from 'next/headers';
import { PENDING_COOKIE, PENDING_TTL_SECONDS, SESSION_COOKIE, SESSION_TTL_SECONDS, signPending, signSession, verifyPending, type PendingClaims } from './session';

const secure = process.env.NODE_ENV === 'production';
export const CODENAME_RE = /^[A-Z][A-Z0-9_-]{2,31}$/;
export const VAULT_DENIED = { ok: false, error: 'VAULT_DENIED', detail: 'Credentials rejected.' } as const;

export async function setPending(claims: Omit<PendingClaims, 'typ'>) {
  (await cookies()).set(PENDING_COOKIE, await signPending(claims), { httpOnly: true, secure, sameSite: 'strict', path: '/admin', maxAge: PENDING_TTL_SECONDS });
}

export async function takePending(): Promise<PendingClaims | null> {
  const jar = await cookies();
  const claims = await verifyPending(jar.get(PENDING_COOKIE)?.value);
  jar.delete({ name: PENDING_COOKIE, path: '/admin' });
  return claims;
}

export async function startSession(admin: { id: string; role: string; codename: string }) {
  (await cookies()).set(SESSION_COOKIE, await signSession({ sub: admin.id, role: admin.role, codename: admin.codename }), {
    httpOnly: true,
    secure,
    sameSite: 'strict',
    path: '/admin',
    maxAge: SESSION_TTL_SECONDS
  });
}

export async function endSession() {
  const jar = await cookies();
  jar.delete({ name: SESSION_COOKIE, path: '/admin' });
  jar.delete({ name: PENDING_COOKIE, path: '/admin' });
}

/** Admin allowed_ips (per-operator) — empty list means any IP that passed the perimeter. */
export function operatorIpAllowed(allowed: string[], ip: string): boolean {
  if (!allowed?.length) return true;
  return allowed.some((rule) => rule === ip || (rule.includes('/') && cidrContains(rule, ip)));
}

function cidrContains(cidr: string, ip: string): boolean {
  const [base, bitsRaw] = cidr.split('/');
  const bits = Number(bitsRaw);
  const toInt = (s: string) => s.split('.').reduce((a, o) => (a << 8) + Number(o), 0) >>> 0;
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(base) || !/^\d+\.\d+\.\d+\.\d+$/.test(ip) || !(bits >= 0 && bits <= 32)) return false;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (toInt(base) & mask) === (toInt(ip) & mask);
}
