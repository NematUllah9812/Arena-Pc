/**
 * RFC 6238 TOTP (HMAC-SHA1, 30s, 6 digits) on Web Crypto — usable from both
 * the Edge middleware (knock tokens) and Node route handlers (vault login).
 */
import { buf, randomBytes, timingSafeEqual } from './encoding';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Uint8Array {
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    value = (value << 5) | ALPHABET.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export async function totpAt(secretBase32: string, counter: number, digits = 6): Promise<string> {
  const key = await crypto.subtle.importKey('raw', buf(base32Decode(secretBase32)), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const msg = new Uint8Array(8);
  let c = counter;
  for (let i = 7; i >= 0; i--) {
    msg[i] = c & 0xff;
    c = Math.floor(c / 256);
  }
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, buf(msg)));
  const offset = mac[mac.length - 1] & 0x0f;
  const bin = ((mac[offset] & 0x7f) << 24) | (mac[offset + 1] << 16) | (mac[offset + 2] << 8) | mac[offset + 3];
  return (bin % 10 ** digits).toString().padStart(digits, '0');
}

/** Verify with ±window steps of clock drift. Returns the matched counter (for replay tracking) or null. */
export async function verifyTotp(secretBase32: string, token: string, window = 1, nowMs = Date.now()): Promise<number | null> {
  const t = (token || '').replace(/\s+/g, '');
  if (!/^\d{6}$/.test(t)) return null;
  const counter = Math.floor(nowMs / 1000 / 30);
  for (let w = -window; w <= window; w++) {
    if (timingSafeEqual(await totpAt(secretBase32, counter + w), t)) return counter + w;
  }
  return null;
}

export function otpauthUri(secretBase32: string, account: string, issuer = 'Vortex Labs Vault'): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secretBase32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}
