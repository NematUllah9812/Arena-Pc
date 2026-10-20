import 'server-only';
import { NextResponse } from 'next/server';
import { clientIp, rateLimit } from '@/lib/security/rate-limit';

export function json<T>(data: T, init: ResponseInit = {}) {
  return NextResponse.json(data, { ...init, headers: { 'cache-control': 'no-store', ...(init.headers ?? {}) } });
}

/** Apply a sliding-window rate limit keyed by route + client IP. Returns a 429 Response when exceeded. */
export async function limit(req: Request, bucket: string, max: number, windowSeconds: number): Promise<Response | null> {
  const ip = clientIp(req.headers);
  const r = await rateLimit(`${bucket}:${ip}`, max, windowSeconds);
  if (r.ok) return null;
  return json({ ok: false, error: 'RATE_LIMITED', detail: 'Too many requests. Cool down and retry.' }, { status: 429, headers: { 'retry-after': String(Math.max(1, r.resetSeconds)) } });
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    const text = await req.text();
    if (text.length > 64_000) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}
