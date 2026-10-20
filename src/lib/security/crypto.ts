import 'server-only';
import { buf, fromBase64Url, randomBytes, toBase64Url, utf8 } from './encoding';

/**
 * AES-256-GCM envelope for TOTP secrets at rest (admin_vault_users.totp_secret_encrypted).
 * Key = SHA-256(VAULT_ENCRYPTION_KEY) so any high-entropy string works.
 * Format: v1.<iv>.<ciphertext+tag> (base64url).
 */
async function vaultKey(): Promise<CryptoKey> {
  const raw = process.env.VAULT_ENCRYPTION_KEY || (process.env.NODE_ENV !== 'production' ? 'vortex-dev-only-vault-key' : '');
  if (!raw) throw new Error('VAULT_ENCRYPTION_KEY is not configured');
  const digest = await crypto.subtle.digest('SHA-256', buf(utf8(raw)));
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function sealSecret(plain: string): Promise<string> {
  const iv = randomBytes(12);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: buf(iv) }, await vaultKey(), buf(utf8(plain)));
  return `v1.${toBase64Url(iv)}.${toBase64Url(new Uint8Array(ct))}`;
}

export async function openSecret(sealed: string): Promise<string> {
  const [v, iv, ct] = sealed.split('.');
  if (v !== 'v1' || !iv || !ct) throw new Error('VAULT_CIPHERTEXT_MALFORMED');
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf(fromBase64Url(iv)) }, await vaultKey(), buf(fromBase64Url(ct)));
  return new TextDecoder().decode(pt);
}
