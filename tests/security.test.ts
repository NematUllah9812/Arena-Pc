import { describe, expect, it } from 'vitest';
import { base32Decode, base32Encode, generateTotpSecret, totpAt, verifyTotp } from '@/lib/security/totp';
import { hmacSign, hmacVerify, mintCloakCookie, verifyCloakCookie } from '@/lib/security/hmac';
import { timingSafeEqual } from '@/lib/security/encoding';

describe('TOTP (RFC 6238)', () => {
  it('matches the RFC 6238 SHA-1 test vector at T=59s', async () => {
    const secret = base32Encode(new TextEncoder().encode('12345678901234567890'));
    // RFC vector 94287082 (8 digits) → last 6 digits 287082
    expect(await totpAt(secret, Math.floor(59 / 30), 6)).toBe('287082');
  });

  it('round-trips base32 and accepts ±1 step window', async () => {
    const s = generateTotpSecret();
    expect(base32Encode(base32Decode(s))).toBe(s);
    const now = Date.now();
    const code = await totpAt(s, Math.floor(now / 30000) - 1);
    expect(await verifyTotp(s, code, 1, now)).not.toBeNull();
    expect(await verifyTotp(s, code, 0, now)).toBeNull();
  });
});

describe('cloak cookie', () => {
  it('verifies, rejects tampering, wrong secret and expiry', async () => {
    const c = await mintCloakCookie('secret-a');
    expect(await verifyCloakCookie('secret-a', c)).toBe(true);
    expect(await verifyCloakCookie('secret-b', c)).toBe(false);
    // Flip a full-entropy character inside the signature.
    const sig = c.split('.')[3];
    const mid = sig.length >> 1;
    const flipped = sig.slice(0, mid) + (sig[mid] === 'A' ? 'B' : 'A') + sig.slice(mid + 1);
    expect(await verifyCloakCookie('secret-a', c.replace(sig, flipped))).toBe(false);
    expect(await verifyCloakCookie('secret-a', c, Date.now() + 13 * 3600 * 1000)).toBe(false);
    expect(await verifyCloakCookie('secret-a', undefined)).toBe(false);
  });
});

describe('hmac canonical encoding', () => {
  it('rejects non-canonical base64url variants of a valid MAC', async () => {
    const sig = await hmacSign('k', 'msg');
    expect(await hmacVerify('k', 'msg', sig)).toBe(true);
    // Last char of a 32-byte base64url MAC has 2 padding bits; toggling them keeps the bytes identical.
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    const idx = alphabet.indexOf(sig.at(-1)!);
    for (const pad of [1, 2, 3]) {
      const variant = sig.slice(0, -1) + alphabet[(idx & ~3) | pad];
      if (variant !== sig) expect(await hmacVerify('k', 'msg', variant)).toBe(false);
    }
  });
});

describe('timingSafeEqual', () => {
  it('compares correctly', () => {
    expect(timingSafeEqual('abc', 'abc')).toBe(true);
    expect(timingSafeEqual('abc', 'abd')).toBe(false);
    expect(timingSafeEqual('abc', 'abcd')).toBe(false);
  });
});
