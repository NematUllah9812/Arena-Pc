import 'server-only';
import { cookies } from 'next/headers';

export const CART_SESSION_COOKIE = 'vx_cart_sid';

/** Opaque, httpOnly cart-session id. Clients can never choose (and thus hijack) another session's leases. */
export async function getCartSessionId(create: boolean): Promise<string | null> {
  const jar = await cookies();
  const existing = jar.get(CART_SESSION_COOKIE)?.value;
  if (existing && /^[a-f0-9-]{36}$/.test(existing)) return existing;
  if (!create) return null;
  const id = crypto.randomUUID();
  jar.set(CART_SESSION_COOKIE, id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7
  });
  return id;
}
