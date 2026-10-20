import { buf, fromBase64Url, timingSafeEqual, toBase64Url, utf8 } from './encoding';

async function key(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', buf(utf8(secret)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function hmacSign(secret: string, message: string): Promise<string> {
  const sig = await crypto.subtle.sign('HMAC', await key(secret), buf(utf8(message)));
  return toBase64Url(new Uint8Array(sig));
}

export async function hmacVerify(secret: string, message: string, signature: string): Promise<boolean> {
  try {
    const raw = fromBase64Url(signature);
    // Canonical-encoding check: base64url's final char carries unused padding bits, so several
    // strings decode to the same MAC. Accept only the exact canonical form (no token malleability).
    if (raw.length !== 32 || toBase64Url(raw) !== signature) return false;
    return await crypto.subtle.verify('HMAC', await key(secret), buf(raw), buf(utf8(message)));
  } catch {
    return false;
  }
}

/** Secret used to sign cloak cookies (falls back to SESSION_SECRET). */
export function cloakSecret(): string | null {
  return process.env.ADMIN_CLOAK_COOKIE_SECRET || process.env.SESSION_SECRET || null;
}

export const CLOAK_COOKIE = '__vortex_cloak_sig';
export const CLOAK_TTL_SECONDS = 60 * 60 * 12;

/** Cloak cookie format: v1.<expiresEpoch>.<nonce>.<hmac> */
export async function mintCloakCookie(secret: string, nowMs = Date.now()): Promise<string> {
  const exp = Math.floor(nowMs / 1000) + CLOAK_TTL_SECONDS;
  const nonce = toBase64Url(crypto.getRandomValues(new Uint8Array(9)));
  const body = `v1.${exp}.${nonce}`;
  return `${body}.${await hmacSign(secret, `cloak:${body}`)}`;
}

export async function verifyCloakCookie(secret: string, value: string | undefined, nowMs = Date.now()): Promise<boolean> {
  if (!value) return false;
  const parts = value.split('.');
  if (parts.length !== 4 || parts[0] !== 'v1') return false;
  const exp = Number(parts[1]);
  if (!Number.isFinite(exp) || exp * 1000 < nowMs) return false;
  const body = parts.slice(0, 3).join('.');
  return hmacVerify(secret, `cloak:${body}`, parts[3]);
}

export { timingSafeEqual };
