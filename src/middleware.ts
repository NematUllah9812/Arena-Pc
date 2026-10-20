import { NextResponse, type NextRequest } from 'next/server';
import { CLOAK_COOKIE, CLOAK_TTL_SECONDS, cloakSecret, mintCloakCookie, timingSafeEqual, verifyCloakCookie } from '@/lib/security/hmac';
import { verifyTotp } from '@/lib/security/totp';
import { SESSION_COOKIE, verifySession } from '@/lib/security/session';
import { clientIp } from '@/lib/security/rate-limit';

/**
 * §7.2 Stealth Overseer perimeter.
 *  1. Optional network allowlist (ADMIN_ALLOWED_IPS, comma-separated; '*' disables).
 *  2. Cloak: a signed, httpOnly cookie minted only after a valid `?knock=` (static secret or TOTP).
 *  3. Session: Overseer JWT (WebAuthn + TOTP) required for everything past the gate.
 * Any failure is rendered as the storefront 404 with HTTP 404 — the vault does not exist to the outside.
 */
const GATE_PATHS = ['/admin/gate', '/admin/api/vault/'];
const UNROUTED = '/_vx/signal-lost';
/** Hop-by-hop + encoding headers (fetch already decoded the body). */
const DROP_HEADERS = new Set(['content-length', 'content-encoding', 'transfer-encoding', 'connection', 'keep-alive', 'set-cookie', 'date']);

const HARDEN: Record<string, string> = {
  'x-frame-options': 'DENY',
  'x-content-type-options': 'nosniff',
  'x-robots-tag': 'noindex, nofollow, noarchive, nosnippet',
  'cache-control': 'no-store, max-age=0',
  'referrer-policy': 'no-referrer',
  'cross-origin-opener-policy': 'same-origin'
};

function harden<T extends NextResponse>(res: T): T {
  for (const [k, v] of Object.entries(HARDEN)) res.headers.set(k, v);
  return res;
}

/**
 * Indistinguishable 404: fetch the genuine global 404 (an unrouted path, so no middleware recursion)
 * and replay only the headers a real 404 carries — no rewrite header, no admin hardening headers.
 */
async function spoof404(req: NextRequest): Promise<Response> {
  if (req.nextUrl.pathname.startsWith('/admin/api/')) {
    return new Response('{"error":"Not Found"}', { status: 404, headers: { 'content-type': 'application/json' } });
  }
  try {
    const genuine = await fetch(new URL(UNROUTED, req.nextUrl.origin), {
      headers: { accept: req.headers.get('accept') ?? 'text/html', 'user-agent': req.headers.get('user-agent') ?? '', rsc: req.headers.get('rsc') ?? '' },
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(4000)
    });
    const headers = new Headers();
    genuine.headers.forEach((v, k) => {
      if (!DROP_HEADERS.has(k.toLowerCase())) headers.append(k, v);
    });
    return new Response(genuine.body, { status: 404, headers });
  } catch {
    const url = req.nextUrl.clone();
    url.pathname = UNROUTED;
    url.search = '';
    return NextResponse.rewrite(url, { status: 404 });
  }
}

function ipAllowed(ip: string): boolean {
  const raw = (process.env.ADMIN_ALLOWED_IPS ?? '').trim();
  if (!raw || raw === '*') return true;
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .some((rule) => rule === ip || (rule.endsWith('*') && ip.startsWith(rule.slice(0, -1))));
}

async function knockValid(knock: string): Promise<boolean> {
  if (!knock || knock.length > 128) return false;
  const staticSecret = process.env.ADMIN_STEALTH_KNOCK_SECRET;
  if (staticSecret && staticSecret.length >= 16 && timingSafeEqual(knock, staticSecret)) return true;
  const totpSecret = process.env.ADMIN_KNOCK_TOTP_SECRET;
  if (totpSecret && /^\d{6}$/.test(knock)) return (await verifyTotp(totpSecret, knock, 1)) !== null;
  return false;
}

export async function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;
  const secret = cloakSecret();
  if (!secret) return spoof404(req);
  if (!ipAllowed(clientIp(req.headers))) return spoof404(req);

  const knock = searchParams.get('knock');
  if (knock !== null) {
    if (!(await knockValid(knock))) return spoof404(req);
    const url = req.nextUrl.clone();
    url.pathname = '/admin/gate';
    url.search = '';
    const res = harden(NextResponse.redirect(url, 303));
    res.cookies.set(CLOAK_COOKIE, await mintCloakCookie(secret), {
      httpOnly: true,
      secure: req.nextUrl.protocol === 'https:',
      sameSite: 'strict',
      path: '/admin',
      maxAge: CLOAK_TTL_SECONDS
    });
    return res;
  }

  if (!(await verifyCloakCookie(secret, req.cookies.get(CLOAK_COOKIE)?.value))) return spoof404(req);

  const isGate = GATE_PATHS.some((p) => pathname === p || pathname.startsWith(p));
  if (isGate) return harden(NextResponse.next());

  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    if (pathname.startsWith('/admin/api/')) return harden(NextResponse.json({ error: 'OVERSEER_SESSION_REQUIRED' }, { status: 401 }));
    const url = req.nextUrl.clone();
    url.pathname = '/admin/gate';
    url.search = '';
    return harden(NextResponse.redirect(url));
  }
  return harden(NextResponse.next());
}

export const config = {
  matcher: ['/admin', '/admin/:path*']
};
